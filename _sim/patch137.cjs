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

// ---- shared helper: kept lines add up to the payout; lines the customer took off are listed too, in the same scale, and not counted
fs.writeFileSync('supabase/functions/_shared/priceBreakdown.ts', `// The itemized price the customer saw, as the painter should see it: every amount scaled so the lines that are still in the price add up to
// the painter's payout (the customer's price minus the platform's commission). The painter never sees the customer-facing amounts or the
// commission. Items the customer took off the price are listed too (marked removed, at what they would have added in the same scale),
// so the painter can suggest them when they start talking. The lines come from the customer's browser, so they are only trusted for their
// wording and their relative sizes.

export interface BreakdownLine {
  description: string
  amount: number
  removed?: boolean
}

export function painterBreakdown(raw: unknown, payout: number): BreakdownLine[] {
  if (!Array.isArray(raw) || !isFinite(payout) || payout <= 0) return []
  const kept: BreakdownLine[] = []
  const removed: BreakdownLine[] = []
  for (const item of raw.slice(0, 60)) {
    const description = typeof item?.description === 'string' ? item.description.replace(/\\s+/g, ' ').trim().slice(0, 90) : ''
    const amount = typeof item?.amount === 'number' && isFinite(item.amount) ? item.amount : 0
    if (!description || amount <= 0) continue
    if (item?.removed === true) removed.push({ description, amount, removed: true })
    else kept.push({ description, amount })
  }
  const total = kept.reduce((sum, l) => sum + l.amount, 0)
  if (kept.length === 0 || total <= 0) return []
  const scale = payout / total
  const scaled = kept.map((l) => ({ description: l.description, amount: Math.round(l.amount * scale * 100) / 100 }))
  // rounding to cents can leave a cent or two over or under: the largest line takes the difference so the lines add up exactly
  const diff = Math.round((payout - scaled.reduce((sum, l) => sum + l.amount, 0)) * 100) / 100
  if (diff !== 0) {
    const biggest = scaled.reduce((best, l) => (l.amount > best.amount ? l : best), scaled[0])
    biggest.amount = Math.round((biggest.amount + diff) * 100) / 100
  }
  const gone = removed.slice(0, 20).map((l) => ({ description: l.description, amount: Math.round(l.amount * scale * 100) / 100, removed: true }))
  return [...scaled, ...gone]
}
`);

// ---- submit-quote-claim: request type
{
  const o = load('supabase/functions/submit-quote-claim/index.ts');
  rep(o, "  breakdown?: { description: string; amount: number }[]\n", "  breakdown?: { description: string; amount: number; removed?: boolean }[]\n");
  rep(o, "/** The itemized price the customer saw: [{ description, amount }]. Shown to the painter scaled to their payout. */", "/** The itemized price the customer saw: [{ description, amount, removed? }] (removed = the customer took it off). Shown to the painter scaled to their payout. */");
  save('supabase/functions/submit-quote-claim/index.ts', o);
}
{
  const o = load('supabase/functions/_shared/offers.ts');
  rep(o, "breakdown?: { description: string; amount: number }[] }", "breakdown?: { description: string; amount: number; removed?: boolean }[] }");
  save('supabase/functions/_shared/offers.ts', o);
}
{
  const o = load('supabase/functions/claim-job/index.ts');
  rep(o, "breakdown?: { description: string; amount: number }[] }", "breakdown?: { description: string; amount: number; removed?: boolean }[] }");
  save('supabase/functions/claim-job/index.ts', o);
}
// ---- email
{
  const o = load('supabase/functions/send-email/index.ts');
  rep(o, "const breakdown = Array.isArray(data.breakdown) ? (data.breakdown as { description: string; amount: number }[]) : []", "const breakdown = Array.isArray(data.breakdown) ? (data.breakdown as { description: string; amount: number; removed?: boolean }[]) : []");
  rep(o, "          <p style=\"margin: 0 0 8px; font-size: 13px; color: #6b7280;\">Amounts are your payout for each part of the job.</p>", "          <p style=\"margin: 0 0 8px; font-size: 13px; color: #6b7280;\">Amounts are your payout for each part of the job.${breakdown.some((l) => l.removed) ? ' Struck-through items are ones the customer took off: you are welcome to suggest them when you talk.' : ''}</p>");
  rep(o, "${breakdown.map((l) => `<tr><td style=\"padding: 4px 0; color: #374151;\">${escapeHtml(l.description)}</td><td style=\"padding: 4px 0; text-align: right; color: #111827;\">${money(l.amount)}</td></tr>`).join('')}", "${breakdown.map((l) => l.removed ? `<tr><td style=\"padding: 4px 0; color: #9ca3af; text-decoration: line-through;\">${escapeHtml(l.description)}</td><td style=\"padding: 4px 0; text-align: right; color: #9ca3af; text-decoration: line-through;\">${money(l.amount)}</td></tr>` : `<tr><td style=\"padding: 4px 0; color: #374151;\">${escapeHtml(l.description)}</td><td style=\"padding: 4px 0; text-align: right; color: #111827;\">${money(l.amount)}</td></tr>`).join('')}");
  save('supabase/functions/send-email/index.ts', o);
}
// ---- accept page
{
  const o = load('src/pages/painter/AcceptJob.tsx');
  rep(o, "breakdown?: { description: string; amount: number }[];", "breakdown?: { description: string; amount: number; removed?: boolean }[];");
  rep(o, "              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 8px' }}>Amounts are your payout for each part of the job.</p>", "              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 8px' }}>\n                Amounts are your payout for each part of the job.\n                {preview.breakdown.some((l) => l.removed) && ' Struck-through items are ones the customer took off: you are welcome to suggest them when you talk.'}\n              </p>");
  rep(o, "                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0', fontSize: '0.92rem' }}>\n                  <span style={{ color: 'var(--text-secondary)' }}>{line.description}</span>\n                  <span style={{ color: 'var(--text-primary)' }}>", "                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0', fontSize: '0.92rem', ...(line.removed ? { textDecoration: 'line-through', opacity: 0.55 } : {}) }}>\n                  <span style={{ color: 'var(--text-secondary)' }}>{line.description}</span>\n                  <span style={{ color: 'var(--text-primary)' }}>");
  save('src/pages/painter/AcceptJob.tsx', o);
}
// ---- the customer's browser: kept lines plus what was taken off
{
  const o = load('src/pages/QuoteResults.tsx');
  rep(o, "          breakdown={estimate.lineItems.map((l) => ({ description: l.description, amount: l.amount }))}\n", `          breakdown={[
            ...estimate.lineItems.map((l) => ({ description: l.description, amount: l.amount })),
            // what the customer took off the price, so the painter can suggest it
            ...(view?.rows ?? []).filter((r) => r.removed).map((r) => ({ description: r.label, amount: r.amount, removed: true })),
            ...(view?.rooms ?? []).filter((r) => r.removed).map((r) => ({ description: \`\${r.label} (room)\`, amount: Math.abs(r.change), removed: true })),
          ]}
`);
  rep(o, "  breakdown: { description: string; amount: number }[];\n  resumeState: unknown;", "  breakdown: { description: string; amount: number; removed?: boolean }[];\n  resumeState: unknown;");
  save('src/pages/QuoteResults.tsx', o);
}
console.log('ok');
