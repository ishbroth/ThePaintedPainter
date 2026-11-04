const fs = require('fs');
function load(f) {
  const t = fs.readFileSync(f, 'utf8');
  return { crlf: t.includes('\r\n'), t: t.split('\r\n').join('\n') };
}
function save(f, o) {
  fs.writeFileSync(f, o.crlf ? o.t.split('\n').join('\r\n') : o.t);
}
function rep(o, a, b, label) {
  if (!o.t.includes(a)) throw new Error('NF ' + (label || a.slice(0, 70)));
  o.t = o.t.replace(a, () => b);
}
const read = (f) => fs.readFileSync(f, 'utf8').split('\r\n').join('\n');

// ---- send-email
{
  const o = load('supabase/functions/send-email/index.ts');
  rep(o, "  claim_received: 'We received your request — your price is locked',", "  claim_received: 'We received your request — your price is locked',\n  no_painter_alert: 'A job needs a painter',\n  claim_searching: 'We\\'re finding a painter for you',\n  no_painter_closed: 'We couldn\\'t find a painter this time',");
  rep(o, "    case 'claim_received':\n", read('_sim/snip_emails.txt') + "    case 'claim_received':\n");
  rep(o, "isInternal && type === 'new_review' && rawData?.subject", "isInternal && (type === 'new_review' || type === 'no_painter_alert') && rawData?.subject");
  save('supabase/functions/send-email/index.ts', o);
}

// ---- submit-quote-claim
{
  const o = load('supabase/functions/submit-quote-claim/index.ts');
  rep(o, "import { painterBreakdown } from '../_shared/priceBreakdown.ts'", "import { painterBreakdown } from '../_shared/priceBreakdown.ts'\nimport { ADMIN_EMAIL } from '../_shared/adminLink.ts'\n\nconst formatUsd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)");
  // the old dead end becomes a flag
  const a = o.t.indexOf("    if (notifiedPainters.length === 0) {\n      return new Response(\n        JSON.stringify({ error: 'No eligible painters found in your area yet.");
  const b = o.t.indexOf("    // --------------------------------------------------------------------\n    // Create the job record");
  if (a < 0 || b < 0) throw new Error('dead end');
  o.t = o.t.slice(0, a) + "    // Nobody in range yet (only the first-available choice can get here): the job is kept and a painter is found for it\n    const searching = notifiedPainters.length === 0\n\n" + o.t.slice(b);
  rep(o, "        status: 'offer_sent',\n        offer_sent_at: new Date().toISOString(),", "        status: searching ? 'searching_painter' : 'offer_sent',\n        offer_sent_at: new Date().toISOString(),");
  rep(o, "    // --------------------------------------------------------------------\n    // Email each notified painter the masked job offer", read('_sim/snip_claim.txt') + "    // --------------------------------------------------------------------\n    // Email each notified painter the masked job offer");
  save('supabase/functions/submit-quote-claim/index.ts', o);
}

// ---- the daily sweep
{
  const o = load('supabase/functions/send-reminders/index.ts');
  rep(o, "  // ---- date_nudge: accepted, no date after 24h ----", read('_sim/snip_sweep.txt') + "  // ---- date_nudge: accepted, no date after 24h ----");
  rep(o, "//   complete_nudge  confirmed job started 2+ days ago         -> painter (\"mark completed\")", "//   complete_nudge  confirmed job started 2+ days ago         -> painter (\"mark completed\")\n//   no_painter_expired  a job nobody in the area took within 48 hours -> job closed, customer told (nothing charged)");
  save('supabase/functions/send-reminders/index.ts', o);
}

// ---- customers see the job while it is being found
{
  const o = load('supabase/functions/get-my-projects/index.ts');
  rep(o, ".in('status', ['offer_sent', 'painter_accepted', 'confirmed', 'completed', 'needs_new_painter'])", ".in('status', ['offer_sent', 'searching_painter', 'painter_accepted', 'confirmed', 'completed', 'needs_new_painter'])");
  save('supabase/functions/get-my-projects/index.ts', o);
}
{
  const o = load('src/pages/customer/CustomerProjects.tsx');
  rep(o, "  offer_sent: 'Finding a Painter',", "  offer_sent: 'Finding a Painter',\n  searching_painter: 'Finding a Painter',");
  rep(o, "  offer_sent: 'bg-gray-500/20 text-[var(--text-secondary)] border-gray-500/40',", "  offer_sent: 'bg-gray-500/20 text-[var(--text-secondary)] border-gray-500/40',\n  searching_painter: 'bg-gray-500/20 text-[var(--text-secondary)] border-gray-500/40',");
  rep(o, "const STEP_INDEX: Record<string, number> = { offer_sent: 0,", "const STEP_INDEX: Record<string, number> = { offer_sent: 0, searching_painter: 0,");
  save('src/pages/customer/CustomerProjects.tsx', o);
}
console.log('ok');
