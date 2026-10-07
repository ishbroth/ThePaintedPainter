// How long a painting job should take, from its price.
//
// Deliberately simple and deterministic so the browser (shown to the customer)
// and the server (used to sanity-check a painter's dates) always agree.
// The same formula lives in src/lib/duration.ts — keep the two identical.
//
//   labor hours  = price * LABOR_SHARE / LABOR_RATE_PER_HOUR
//   working days = labor hours / (HOURS_PER_DAY * crew size), rounded up, at least 1

export const LABOR_SHARE = 0.6 // roughly 60% of a painting price is labor
export const LABOR_RATE_PER_HOUR = 50 // blended $/crew-hour that portion buys
export const HOURS_PER_DAY = 8
export const DEFAULT_CREW = 2

export function laborHoursFor(total: number): number {
  return (total * LABOR_SHARE) / LABOR_RATE_PER_HOUR
}

export function estimateWorkingDays(total: number, crewSize: number | null = DEFAULT_CREW): number {
  const crew = Math.max(1, Math.round(crewSize || DEFAULT_CREW))
  return Math.max(1, Math.ceil(laborHoursFor(total) / (HOURS_PER_DAY * crew)))
}

/** A believable range to show a customer ("about 2-3 working days"). */
export function estimateDayRange(total: number): { days: number; low: number; high: number } {
  const days = estimateWorkingDays(total)
  return { days, low: Math.max(1, Math.floor(days * 0.8)), high: Math.max(days, Math.ceil(days * 1.3)) }
}
