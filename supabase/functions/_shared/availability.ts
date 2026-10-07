// Is a painter available for what the customer asked for?
//
// A painter says "I'm booked" three ways (profile > Availability):
//   * Pause leads, no "until" date  -> hidden from every search.
//   * Pause until a date            -> blocked from today through that date.
//   * Blackout date ranges          -> blocked for those ranges.
// Painters with dates stay in results, but only for customers whose dates fit:
//   * customer gave specific dates      -> hidden if they overlap a blocked range
//   * customer wants ASAP / this month  -> hidden if the painter can't start in time
//   * customer's dates are flexible     -> always shown, tagged "available from <date>"

export interface DateRange { start: string; end: string }

export interface PainterAvailabilityFields {
  leads_paused: boolean | null
  paused_until: string | null
  blackout_dates: unknown
}

export interface CustomerTiming {
  startDate?: string | null
  endDate?: string | null
  flexible?: boolean
  timeline?: string | null
}

const DAY = 86_400_000
const ISO = /^\d{4}-\d{2}-\d{2}$/

export const toMs = (iso: string): number => Date.parse(`${iso}T00:00:00Z`)
export const toIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
export const addDays = (iso: string, n: number): string => toIso(toMs(iso) + n * DAY)
export const todayIso = (): string => toIso(Date.now())
export const isIsoDate = (v: unknown): v is string => typeof v === 'string' && ISO.test(v) && !isNaN(toMs(v))

function cleanRanges(raw: unknown): DateRange[] {
  if (!Array.isArray(raw)) return []
  const out: DateRange[] = []
  for (const r of raw) {
    const s = (r as DateRange)?.start
    const e = (r as DateRange)?.end
    if (isIsoDate(s) && isIsoDate(e) && e >= s) out.push({ start: s, end: e })
  }
  return out
}

/** Ranges the painter is NOT available, future-only and sorted. */
export function blockedRanges(p: PainterAvailabilityFields, today: string): DateRange[] {
  const ranges = cleanRanges(p.blackout_dates)
  if (p.leads_paused && isIsoDate(p.paused_until)) ranges.push({ start: today, end: p.paused_until })
  return ranges.filter((r) => r.end >= today).sort((a, b) => a.start.localeCompare(b.start))
}

/** Paused with no 'until' date: hidden from every search (blackout dates don't change that; they apply when leads are on). */
export function isSimplePause(p: PainterAvailabilityFields, _today: string): boolean {
  return !!p.leads_paused && !isIsoDate(p.paused_until)
}

/** Earliest date on/after today that isn't blocked. */
export function availableFrom(p: PainterAvailabilityFields, today: string): string {
  let d = today
  for (const r of blockedRanges(p, today)) {
    if (d >= r.start && d <= r.end) d = addDays(r.end, 1)
  }
  return d
}

const overlaps = (aStart: string, aEnd: string, b: DateRange) => aStart <= b.end && aEnd >= b.start

export function evaluateAvailability(
  p: PainterAvailabilityFields,
  timing: CustomerTiming,
  durationDays: number,
  today: string = todayIso(),
): { show: boolean; availableFrom: string | null } {
  if (isSimplePause(p, today)) return { show: false, availableFrom: null }

  const from = availableFrom(p, today)
  const tag = from > today ? from : null

  // Flexible customers see everyone who isn't simply paused; the tag tells them when the painter is free.
  if (timing.flexible) return { show: true, availableFrom: tag }

  const blocked = blockedRanges(p, today)

  if (isIsoDate(timing.startDate)) {
    const start = timing.startDate < today ? today : timing.startDate
    const end = isIsoDate(timing.endDate) && timing.endDate >= start
      ? timing.endDate
      : addDays(start, Math.max(1, durationDays) - 1)
    return { show: !blocked.some((r) => overlaps(start, end, r)), availableFrom: tag }
  }

  if (timing.timeline === 'asap') return { show: from <= addDays(today, 14), availableFrom: tag }
  if (timing.timeline === 'this_month') return { show: from <= addDays(today, 30), availableFrom: tag }
  return { show: true, availableFrom: tag }
}

/** Monday-Friday days in [start, end], inclusive. */
export function workingDaysBetween(start: string, end: string): number {
  let n = 0
  for (let ms = toMs(start); ms <= toMs(end); ms += DAY) {
    const dow = new Date(ms).getUTCDay()
    if (dow !== 0 && dow !== 6) n++
  }
  return n
}

/** The date a job ends if work starts on `start` and takes `days` working days (start counts as day 1; weekends skipped). */
export function addWorkingDays(start: string, days: number): string {
  let ms = toMs(start)
  // If the start itself falls on a weekend, work begins the next working day.
  while ([0, 6].includes(new Date(ms).getUTCDay())) ms += DAY
  let left = Math.max(1, days) - 1
  while (left > 0) {
    ms += DAY
    const dow = new Date(ms).getUTCDay()
    if (dow !== 0 && dow !== 6) left--
  }
  return toIso(ms)
}
