// Checks for the rules behind in-app messaging (supabase/functions/_shared/jobMessages.ts): who may message, when, what is accepted,
// and how fast. The edge function uses these same functions, so what passes here is what the server enforces.
//
//   npm run check:messaging

import {
  MAX_MESSAGE_LENGTH, RATE_LIMIT_COUNT, RATE_LIMIT_WINDOW_MS, canReadMessages, canSendMessages, cleanMessageBody, firstName, isRateLimited,
  participantRole, snippet, threadLink, type CallerIdentity, type JobForMessaging,
} from '../supabase/functions/_shared/jobMessages.ts';

let failures = 0;
let passed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++;
  else { failures++; console.error(`FAIL: ${name}${detail ? ` (${detail})` : ''}`); }
}

const JOB: JobForMessaging = { id: 'job-1', status: 'confirmed', scheduled_date: '2026-12-01', customer_id: 'cust-1', customer_email: 'pat@example.com', accepted_by: 'painter-1', completed_at: null };
const CUSTOMER: CallerIdentity = { userId: 'cust-1', confirmedEmail: 'pat@example.com' };
const PAINTER_USER: CallerIdentity = { userId: 'user-painter-1', confirmedEmail: 'crew@paint.example' };
const STRANGER: CallerIdentity = { userId: 'someone-else', confirmedEmail: 'other@example.com' };

// ---- who is on the job ----
check('the painter who accepted the job is the painter', participantRole(JOB, PAINTER_USER, { id: 'painter-1' }) === 'painter');
check('the customer on the job is the customer', participantRole(JOB, CUSTOMER, null) === 'customer');
check('another painter is nobody', participantRole(JOB, PAINTER_USER, { id: 'painter-2' }) === null);
check('a stranger is nobody', participantRole(JOB, STRANGER, null) === null);
check('a painter who was only offered the job (not accepted_by) is nobody', participantRole({ ...JOB, accepted_by: null }, PAINTER_USER, { id: 'painter-1' }) === null);
const guestJob = { ...JOB, customer_id: null };
check('a guest claim matches the customer by confirmed email', participantRole(guestJob, { userId: 'new-account', confirmedEmail: 'PAT@example.com ' }, null) === 'customer');
check('an unconfirmed email proves nothing', participantRole(guestJob, { userId: 'new-account', confirmedEmail: null }, null) === null);
check('a different email is nobody', participantRole(guestJob, STRANGER, null) === null);
check('an account job is not claimable by email', participantRole(JOB, { userId: 'impostor', confirmedEmail: 'pat@example.com' }, null) === null);

// ---- when messaging is open ----
check('a confirmed, scheduled job can be messaged', canSendMessages(JOB));
for (const status of ['offer_sent', 'searching_painter', 'painter_accepted', 'needs_new_painter', 'cancelled', 'expired', 'completed']) {
  check(`no sending while the job is ${status}`, !canSendMessages({ ...JOB, status }));
}
check('no sending without a scheduled date', !canSendMessages({ ...JOB, scheduled_date: null }));
check('a confirmed job can be read', canReadMessages(JOB));
check('a painter_accepted job cannot be read', !canReadMessages({ ...JOB, status: 'painter_accepted' }));
const now = new Date('2027-01-01T00:00:00Z');
check('a recently completed job stays readable', canReadMessages({ ...JOB, status: 'completed', completed_at: '2026-12-20T00:00:00Z' }, now));
check('a long-completed job is no longer readable', !canReadMessages({ ...JOB, status: 'completed', completed_at: '2026-01-01T00:00:00Z' }, now));
check('a completed job is never writable', !canSendMessages({ ...JOB, status: 'completed' }));

// ---- what is accepted ----
const ok = cleanMessageBody('  Hi there!\r\n\r\n\r\n\r\nSee you Monday.  ');
check('whitespace is trimmed and blank runs collapsed', ok.ok && ok.body === 'Hi there!\n\nSee you Monday.', JSON.stringify(ok));
check('control characters are dropped', (() => { const r = cleanMessageBody('a\u0000b\u0007c‮d'); return r.ok && r.body === 'abcd'; })());
check('markup is kept as plain text (the pages never render it as HTML)', (() => { const r = cleanMessageBody('<img src=x onerror=alert(1)>'); return r.ok && r.body === '<img src=x onerror=alert(1)>'; })());
check('an empty message is refused', !cleanMessageBody('   \n  ').ok);
check('a non-string is refused', !cleanMessageBody({ body: 'x' }).ok && !cleanMessageBody(undefined).ok && !cleanMessageBody(42).ok);
check('exactly the limit is accepted', cleanMessageBody('x'.repeat(MAX_MESSAGE_LENGTH)).ok);
check('one over the limit is refused', !cleanMessageBody('x'.repeat(MAX_MESSAGE_LENGTH + 1)).ok);
check('emoji and accents survive', (() => { const r = cleanMessageBody('Gracias! 😀 café'); return r.ok && r.body === 'Gracias! 😀 café'; })());

// ---- how fast ----
const at = new Date('2026-12-01T12:00:00Z');
const justNow = Array.from({ length: RATE_LIMIT_COUNT }, (_, i) => new Date(at.getTime() - i * 1000).toISOString());
check('the limit is reached at the cap', isRateLimited(justNow, at));
check('one under the cap is fine', !isRateLimited(justNow.slice(1), at));
const old = justNow.map(() => new Date(at.getTime() - RATE_LIMIT_WINDOW_MS - 60_000).toISOString());
check('old messages do not count', !isRateLimited(old, at));

// ---- the notification ----
check('the preview is one short line', snippet('Line one\n\nline   two ' + 'x'.repeat(300)).length <= 110 && !snippet('a\nb').includes('\n'));
check('a short message is previewed whole', snippet('See you at 8') === 'See you at 8');
check('the painter is sent to the painter projects page with the thread open', threadLink('painter', 'abc') === '/painter/dashboard/projects?messages=abc');
check('the customer is sent to the customer projects page with the thread open', threadLink('customer', 'abc') === '/customer/dashboard/projects?messages=abc');
check('a job id cannot break out of the link', !threadLink('painter', 'a&b=c#x').includes('&b=') && !threadLink('painter', 'a&b=c#x').includes('#'));
check('only a first name goes in a title', firstName('Pat  Lee Smith', 'Your client') === 'Pat' && firstName('', 'Your client') === 'Your client' && firstName(null, 'x') === 'x');

console.log(`${passed} checks passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
