// The itemized price the customer saw, as the painter should see it: every amount scaled so the lines that are still in the price add up to
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
    const description = typeof item?.description === 'string' ? item.description.replace(/\s+/g, ' ').trim().slice(0, 90) : ''
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
