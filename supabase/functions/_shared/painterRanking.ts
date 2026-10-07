// The painters shown to a customer for a project, ranked, priced, and signed.
//
// Shared by painter-results (the results page) and the decline fallback (the
// "next best 3" email), so both always agree on who qualifies and in what order.
//
// Everything sensitive stays here: a painter's pricing answers, email, phone and
// license/policy numbers never leave the server. See painter-results for the
// full description of the hotel-style card this feeds.

import { zipDistanceMiles } from './geo.ts'
import { estimatePainterPrice } from './painterPricing.ts'
import { cleanExternalReviews, type ExternalReview } from './externalReviews.ts'
import { evaluateAvailability, todayIso, type CustomerTiming } from './availability.ts'
import { estimateDayRange } from './duration.ts'
import { signPrice } from './priceToken.ts'

// deno-lint-ignore no-explicit-any
type Supabase = any

export const SERVICE_RADIUS_MILES = 50
const MAX_PHOTOS_PER_CARD = 8
/** Cheapest nearby painter is shown at baseline*(1-this), priciest at baseline*(1+this); the rest spread evenly between. */
export const MAX_PRICE_SPREAD = 0.07
/** How long a displayed price can be claimed (the "price locked" countdown, now enforced server-side). */
export const DEFAULT_HOLD_MS = 45 * 60 * 1000

export interface RankedPainter {
  id: string
  companyName: string
  city: string
  state: string
  distanceMiles: number
  price: number
  /** Signed proof this price came from us — required to claim it. */
  priceToken: string
  rating: { average: number | null; count: number }
  external: ExternalReview[]
  photos: string[]
  reasons: string[]
  /** Set when the painter is booked until later than today (only shown for flexible customers / dates that fit). */
  availableFrom: string | null
}

export interface RankResult {
  painters: RankedPainter[]
  mystery: { price: number; priceToken: string }
  holdUntil: number
  duration: { days: number; low: number; high: number }
}

function jobSpecialties(ctx: Record<string, unknown>): string[] {
  const s: string[] = []
  if (ctx.projectType === 'interior' || ctx.projectType === 'both') s.push('interior')
  if (ctx.projectType === 'exterior' || ctx.projectType === 'both') s.push('exterior')
  if (ctx.cabinets && ctx.cabinets !== 'none') s.push('cabinet')
  if (ctx.deck && ctx.deck !== 'none') s.push('deck')
  if (ctx.propertyType === 'commercial') s.push('commercial')
  return s
}

/**
 * Each painter's own projected price for this job becomes a small deviation from
 * the baseline by RANK among the painters competing for it: lowest gets
 * -MAX_PRICE_SPREAD, highest +MAX_PRICE_SPREAD, the rest evenly between (the
 * median lands on the baseline for an odd count). Painters with no pricing, or a
 * lone painter, get no deviation. Ties share a rank.
 */
export function priceDeviations(projected: (number | null)[]): number[] {
  const priced = projected
    .map((p, i) => ({ p, i }))
    .filter((x): x is { p: number; i: number } => x.p !== null)
    .sort((a, b) => a.p - b.p)
  const out = projected.map(() => 0)
  const n = priced.length
  if (n < 2) return out
  let k = 0
  while (k < n) {
    let j = k
    while (j + 1 < n && priced[j + 1].p === priced[k].p) j++
    const position = (k + j) / 2 / (n - 1)
    const deviation = (position - 0.5) * 2 * MAX_PRICE_SPREAD
    for (let t = k; t <= j; t++) out[priced[t].i] = deviation
    k = j + 1
  }
  return out
}

export function timingFromCtx(ctx: Record<string, unknown>): CustomerTiming {
  return {
    startDate: typeof ctx.startDate === 'string' && ctx.startDate ? ctx.startDate : null,
    endDate: typeof ctx.endDate === 'string' && ctx.endDate ? ctx.endDate : null,
    flexible: ctx.datesFlexible === true,
    timeline: typeof ctx.timeline === 'string' ? ctx.timeline : null,
  }
}

export async function rankPainters(
  supabase: Supabase,
  supabaseUrl: string,
  ctx: Record<string, unknown>,
  baseTotal: number,
  opts: { exclude?: string[]; holdUntilMs?: number; limit?: number } = {},
): Promise<RankResult> {
  const zip = String(ctx.zipCode ?? '')
  const holdUntil = opts.holdUntilMs ?? Date.now() + DEFAULT_HOLD_MS
  const duration = estimateDayRange(baseTotal)
  const mystery = { price: Math.round(baseTotal), priceToken: await signPrice('mystery', baseTotal, zip, holdUntil) }

  const { data: rows, error } = await supabase
    .from('painters')
    .select('id, user_id, company_name, city, state, zip_code, service_types, external_reviews, leads_paused, paused_until, blackout_dates, price_1br_full, price_3br_walls, price_3br_trim_doors, price_3br_ceilings, price_5br_full, price_5br_cabinets')
    .eq('status', 'approved')
    .eq('verified', true)
  if (error) throw error

  const excluded = new Set(opts.exclude ?? [])
  const timing = timingFromCtx(ctx)
  const today = todayIso()

  // Nearby, not excluded, and available for what the customer asked — nearest first.
  const nearby = (rows ?? [])
    .filter((p: { id: string }) => !excluded.has(p.id))
    .map((p: Record<string, unknown>) => ({ p, distance: zipDistanceMiles(zip, p.zip_code as string) }))
    .filter((x: { distance: number | null }): x is { p: Record<string, unknown>; distance: number } => x.distance !== null && x.distance <= SERVICE_RADIUS_MILES)
    .map((x: { p: Record<string, unknown>; distance: number }) => ({ ...x, avail: evaluateAvailability(x.p as never, timing, duration.days, today) }))
    .filter((x: { avail: { show: boolean } }) => x.avail.show)
    .sort((a: { distance: number }, b: { distance: number }) => a.distance - b.distance)

  if (nearby.length === 0) return { painters: [], mystery, holdUntil, duration }

  // Private price estimate per painter -> rank-based deviation from the baseline.
  const projected = nearby.map(({ p }: { p: Record<string, unknown> }) => {
    const v = [p.price_1br_full, p.price_3br_walls, p.price_3br_trim_doors, p.price_3br_ceilings, p.price_5br_full, p.price_5br_cabinets]
    if (v.some((x) => x === null || !(Number(x) > 0))) return null
    try {
      const price = estimatePainterPrice(
        {
          baseline: {
            price1BRFull: Number(p.price_1br_full), price3BRWalls: Number(p.price_3br_walls), price3BRTrimDoors: Number(p.price_3br_trim_doors),
            price3BRCeilings: Number(p.price_3br_ceilings), price5BRFull: Number(p.price_5br_full), price5BRCabinets: Number(p.price_5br_cabinets),
          },
        } as never,
        ctx,
        {},
      )
      return isFinite(price) && price > 0 ? price : null
    } catch {
      return null
    }
  })
  const deviations = priceDeviations(projected)

  // Ratings on The Painted Painter (reviews are keyed by the painter's auth user id).
  const userIds = nearby.map(({ p }: { p: Record<string, unknown> }) => p.user_id).filter(Boolean) as string[]
  const ratings = new Map<string, { sum: number; count: number }>()
  if (userIds.length > 0) {
    const { data: reviews } = await supabase.from('reviews').select('painter_id, rating').in('painter_id', userIds)
    for (const r of reviews ?? []) {
      const cur = ratings.get(r.painter_id) ?? { sum: 0, count: 0 }
      cur.sum += r.rating
      cur.count += 1
      ratings.set(r.painter_id, cur)
    }
  }

  // Portfolio photos, newest first, a handful per painter.
  const photos = new Map<string, string[]>()
  const { data: portfolio } = await supabase
    .from('painter_portfolio')
    .select('painter_id, storage_path')
    .in('painter_id', nearby.map(({ p }: { p: Record<string, unknown> }) => p.id))
    .order('created_at', { ascending: false })
  for (const row of portfolio ?? []) {
    const list = photos.get(row.painter_id) ?? []
    if (list.length < MAX_PHOTOS_PER_CARD) list.push(`${supabaseUrl}/storage/v1/object/public/painter-portfolio/${row.storage_path}`)
    photos.set(row.painter_id, list)
  }

  const wanted = jobSpecialties(ctx)
  const ranked: RankedPainter[] = []
  for (let i = 0; i < nearby.length; i++) {
    const { p, distance, avail } = nearby[i] as { p: Record<string, unknown>; distance: number; avail: { availableFrom: string | null } }
    const reasons: string[] = [distance < 5 ? 'right in your area' : `~${Math.round(distance)} mi away`]
    const overlaps = ((p.service_types as string[]) ?? []).filter((s) => wanted.some((w) => s.toLowerCase().includes(w)))
    if (overlaps.length > 0) reasons.push(`specializes in ${overlaps.slice(0, 2).join(' & ')}`)

    const r = p.user_id ? ratings.get(p.user_id as string) : undefined
    const price = Math.round(baseTotal * (1 + deviations[i]))
    ranked.push({
      id: p.id as string,
      companyName: p.company_name as string,
      city: p.city as string,
      state: p.state as string,
      distanceMiles: Math.round(distance),
      price,
      priceToken: await signPrice(p.id as string, price, zip, holdUntil),
      rating: { average: r ? Math.round((r.sum / r.count) * 10) / 10 : null, count: r?.count ?? 0 },
      external: cleanExternalReviews(p.external_reviews),
      photos: photos.get(p.id as string) ?? [],
      reasons,
      availableFrom: avail.availableFrom,
    })
  }

  return { painters: opts.limit ? ranked.slice(0, opts.limit) : ranked, mystery, holdUntil, duration }
}
