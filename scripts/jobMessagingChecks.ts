// Checks for the rules behind in-app messaging (supabase/functions/_shared/jobMessages.ts): who may message, when, what is accepted,
// and how fast. The edge function uses these same functions, so what passes here is what the server enforces.
//
//   npm run check:messaging

import {
  MAX_MESSAGE_LENGTH, MAX_REPORT_DETAILS, RATE_LIMIT_COUNT, RATE_LIMIT_WINDOW_MS, REPORT_LIMIT_PER_DAY, REPORT_REASONS, REPORT_SNAPSHOT_MESSAGES,
  blockedByRole, canReadMessages, canSendMessages, cleanMessageBody, cleanReport, firstName, isBlocked, isRateLimited, isReportLimited,
  participantRole, reportSnapshot, snippet, threadLink, type CallerIdentity, type JobForMessaging,
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

// ---- block ----
const blockedByCustomer = { ...JOB, customer_blocked_messages: true };
const blockedByPainter = { ...JOB, painter_blocked_messages: true };
check('a job nobody blocked is not blocked (missing flags count as off)', !isBlocked(JOB) && !isBlocked({ ...JOB, customer_blocked_messages: null, painter_blocked_messages: false }));
check('a block by the customer stops sending', isBlocked(blockedByCustomer) && !canSendMessages(blockedByCustomer));
check('a block by the painter stops sending', isBlocked(blockedByPainter) && !canSendMessages(blockedByPainter));
check('a block stops BOTH sides from sending (the sender is the same check)', !canSendMessages(blockedByCustomer) && !canSendMessages(blockedByPainter));
check('a blocked thread can still be read', canReadMessages(blockedByCustomer) && canReadMessages(blockedByPainter));
check('a blocked thread that is completed follows the 90-day read window', canReadMessages({ ...blockedByCustomer, status: 'completed', completed_at: '2026-12-20T00:00:00Z' }, now) && !canReadMessages({ ...blockedByCustomer, status: 'completed', completed_at: '2026-01-01T00:00:00Z' }, now));
check('a block does not open an unconfirmed job', !canReadMessages({ ...blockedByCustomer, status: 'painter_accepted' }));
check('each side only owns its own block', blockedByRole(blockedByCustomer, 'customer') && !blockedByRole(blockedByCustomer, 'painter') && blockedByRole(blockedByPainter, 'painter') && !blockedByRole(blockedByPainter, 'customer'));
check('both sides blocking, then one lifting theirs, is still blocked', (() => { const both = { ...JOB, customer_blocked_messages: true, painter_blocked_messages: true }; return isBlocked({ ...both, customer_blocked_messages: false }) && !canSendMessages({ ...both, customer_blocked_messages: false }); })());
check('lifting the only block reopens the job', canSendMessages({ ...blockedByCustomer, customer_blocked_messages: false }));

// ---- report ----
for (const reason of REPORT_REASONS) check(`reason ${reason} is accepted`, cleanReport(reason, undefined).ok);
check('an unknown reason is refused', !cleanReport('boring', undefined).ok && !cleanReport(undefined, undefined).ok && !cleanReport(5, undefined).ok);
check('a prototype name is not a reason', !cleanReport('constructor', undefined).ok && !cleanReport('__proto__', undefined).ok);
check('the note is optional and empty means none', (() => { const r = cleanReport('spam', '   '); return r.ok && r.details === null; })() && (() => { const r = cleanReport('spam', null); return r.ok && r.details === null; })());
check('the note is trimmed and cleaned', (() => { const r = cleanReport('other', '  rude \u0000 text\r\n  '); return r.ok && r.details === 'rude  text'; })());
check('a note at the limit is accepted and one over is refused', cleanReport('other', 'x'.repeat(MAX_REPORT_DETAILS)).ok && !cleanReport('other', 'x'.repeat(MAX_REPORT_DETAILS + 1)).ok);
check('a note that is not text is refused', !cleanReport('other', { a: 1 }).ok);
const reportsNow = new Date('2026-12-01T12:00:00Z');
const manyReports = Array.from({ length: REPORT_LIMIT_PER_DAY }, (_, i) => new Date(reportsNow.getTime() - i * 60000).toISOString());
check('the report limit is reached at the cap', isReportLimited(manyReports, reportsNow));
check('one under the report cap is fine', !isReportLimited(manyReports.slice(1), reportsNow));
check('reports from over a day ago do not count', !isReportLimited(manyReports.map(() => new Date(reportsNow.getTime() - 90000000).toISOString()), reportsNow));
const thread = Array.from({ length: 40 }, (_, i) => ({ sender_role: (i % 2 ? 'painter' : 'customer') as 'painter' | 'customer', body: `m${i}`, created_at: `2026-12-01T00:${String(i).padStart(2, '0')}:00Z` }));
const snap = reportSnapshot(thread);
check('the snapshot keeps only the latest messages, oldest first', snap.length === REPORT_SNAPSHOT_MESSAGES && snap[snap.length - 1].body === 'm39' && snap[0].body === `m${40 - REPORT_SNAPSHOT_MESSAGES}`);
check('the snapshot of a short thread is the whole thread', reportSnapshot(thread.slice(0, 3)).length === 3 && reportSnapshot([]).length === 0);

console.log(`${passed} checks passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
