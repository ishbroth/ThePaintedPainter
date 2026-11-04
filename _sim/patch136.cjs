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

// ---- shared helper: the painter's view of the price breakdown
fs.writeFileSync('supabase/functions/_shared/priceBreakdown.ts', `// The itemized price the customer saw, as the painter should see it: every amount scaled so the lines add up to the painter's payout
// (the customer's price minus the platform's commission). The painter never sees the customer-facing amounts or the commission.
// The lines come from the customer's browser, so they are only trusted for their wording and their relative sizes.

export interface BreakdownLine {
  description: string
  amount: number
}

export function painterBreakdown(raw: unknown, payout: number): BreakdownLine[] {
  if (!Array.isArray(raw) || !isFinite(payout) || payout <= 0) return []
  const lines: BreakdownLine[] = []
  for (const item of raw.slice(0, 40)) {
    const description = typeof item?.description === 'string' ? item.description.replace(/\\s+/g, ' ').trim().slice(0, 90) : ''
    const amount = typeof item?.amount === 'number' && isFinite(item.amount) ? item.amount : 0
    if (description && amount > 0) lines.push({ description, amount })
  }
  const total = lines.reduce((sum, l) => sum + l.amount, 0)
  if (lines.length === 0 || total <= 0) return []
  const scaled = lines.map((l) => ({ description: l.description, amount: Math.round((l.amount / total) * payout * 100) / 100 }))
  // rounding to cents can leave a cent or two over or under: the largest line takes the difference so the lines add up exactly
  const diff = Math.round((payout - scaled.reduce((sum, l) => sum + l.amount, 0)) * 100) / 100
  if (diff !== 0) {
    const biggest = scaled.reduce((best, l) => (l.amount > best.amount ? l : best), scaled[0])
    biggest.amount = Math.round((biggest.amount + diff) * 100) / 100
  }
  return scaled
}
`);

// ---- submit-quote-claim
{
  const o = load('supabase/functions/submit-quote-claim/index.ts');
  rep(o, "import { cleanConversation, conversationRejected, conversationNote } from '../_shared/conversationLog.ts'", "import { cleanConversation, conversationRejected, conversationNote } from '../_shared/conversationLog.ts'\nimport { painterBreakdown } from '../_shared/priceBreakdown.ts'");
  rep(o, "  conversation?: string[]\n", "  conversation?: string[]\n  /** The itemized price the customer saw: [{ description, amount }]. Shown to the painter scaled to their payout. */\n  breakdown?: { description: string; amount: number }[]\n");
  rep(o, "    const painterPayoutAmount = Math.round(guaranteedPrice * (1 - COMMISSION_RATE) * 100) / 100\n", "    const painterPayoutAmount = Math.round(guaranteedPrice * (1 - COMMISSION_RATE) * 100) / 100\n    const breakdown = painterBreakdown(body.breakdown, painterPayoutAmount)\n");
  rep(o, "        project_summary: { qa, timeline, timelineLabel, conversation },", "        project_summary: { qa, timeline, timelineLabel, conversation, breakdown },");
  rep(o, "              conversation,\n              conversationNote: conversationNote(conversation),\n              photos: photos ?? [],", "              conversation,\n              conversationNote: conversationNote(conversation),\n              breakdown,\n              photos: photos ?? [],");
  save('supabase/functions/submit-quote-claim/index.ts', o);
}
// ---- re-sent offers
{
  const o = load('supabase/functions/_shared/offers.ts');
  rep(o, "project_summary: { qa?: unknown[]; timelineLabel?: string; conversation?: string[] } | null", "project_summary: { qa?: unknown[]; timelineLabel?: string; conversation?: string[]; breakdown?: { description: string; amount: number }[] } | null");
  rep(o, "        conversation: job.project_summary?.conversation ?? [],\n", "        conversation: job.project_summary?.conversation ?? [],\n        breakdown: job.project_summary?.breakdown ?? [],\n");
  save('supabase/functions/_shared/offers.ts', o);
}
// ---- the accept page's preview
{
  const o = load('supabase/functions/claim-job/index.ts');
  rep(o, "qa?: { question: string; answer: string }[]; conversation?: string[] }", "qa?: { question: string; answer: string }[]; conversation?: string[]; breakdown?: { description: string; amount: number }[] }");
  rep(o, "        conversation: summary.conversation ?? [],\n", "        conversation: summary.conversation ?? [],\n        breakdown: summary.breakdown ?? [],\n");
  save('supabase/functions/claim-job/index.ts', o);
}
// ---- the offer email
{
  const o = load('supabase/functions/send-email/index.ts');
  rep(o, "      // every reply the customer typed, in order, so the painter can judge for themselves\n", `      // what the price covers, line by line, in the painter's own payout amounts
      const breakdown = Array.isArray(data.breakdown) ? (data.breakdown as { description: string; amount: number }[]) : []
      const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
      const breakdownHtml = breakdown.length > 0
        ? \`
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-weight: 600; margin-bottom: 4px;">What this job includes</p>
          <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">Amounts are your payout for each part of the job.</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            \${breakdown.map((l) => \`<tr><td style="padding: 4px 0; color: #374151;">\${escapeHtml(l.description)}</td><td style="padding: 4px 0; text-align: right; color: #111827;">\${money(l.amount)}</td></tr>\`).join('')}
          </table>
        \`
        : ''

      // every reply the customer typed, in order, so the painter can judge for themselves
`);
  rep(o, "        ${qaHtml}\n        ${conversationHtml}", "        ${qaHtml}\n        ${breakdownHtml}\n        ${conversationHtml}");
  save('supabase/functions/send-email/index.ts', o);
}
// ---- the painter's accept page
{
  const o = load('src/pages/painter/AcceptJob.tsx');
  rep(o, "  conversation?: string[];\n", "  conversation?: string[];\n  /** What the price covers, line by line, in the painter's payout amounts. */\n  breakdown?: { description: string; amount: number }[];\n");
  rep(o, "          {preview.conversation && preview.conversation.length > 0 && (", `          {preview.breakdown && preview.breakdown.length > 0 && (
            <div style={card}>
              <p style={{ color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 4px' }}>What this job includes</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 8px' }}>Amounts are your payout for each part of the job.</p>
              {preview.breakdown.map((line, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0', fontSize: '0.92rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{line.description}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(line.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {preview.conversation && preview.conversation.length > 0 && (`);
  save('src/pages/painter/AcceptJob.tsx', o);
}
// ---- the customer's browser sends the breakdown with the claim
{
  const o = load('src/pages/QuoteResults.tsx');
  rep(o, "          conversation={state.userMessages ?? state.transcript.split('\\n').filter(Boolean)}\n", "          conversation={state.userMessages ?? state.transcript.split('\\n').filter(Boolean)}\n          breakdown={estimate.lineItems.map((l) => ({ description: l.description, amount: l.amount }))}\n");
  rep(o, "  conversation,\n  resumeState,\n  onPriceExpired,", "  conversation,\n  breakdown,\n  resumeState,\n  onPriceExpired,");
  rep(o, "  conversation: string[];\n  resumeState: unknown;", "  conversation: string[];\n  breakdown: { description: string; amount: number }[];\n  resumeState: unknown;");
  rep(o, "          qa: buildResponseSummary(ctx),\n          conversation,", "          qa: buildResponseSummary(ctx),\n          conversation,\n          breakdown,");
  save('src/pages/QuoteResults.tsx', o);
}
console.log('ok');
