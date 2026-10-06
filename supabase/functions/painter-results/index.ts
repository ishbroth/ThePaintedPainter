// supabase/functions/painter-results/index.ts
//
// Supabase Edge Function: the painters shown to a customer for their project
//
// Replaces the browser reading the painters table directly (which exposed every
// painter's email, phone, license/policy numbers and pricing answers to anyone).
// Everything sensitive stays here: this finds approved painters within range of
// the job's ZIP, works out each one's price from their private pricing answers,
// and returns ONLY what a customer browsing results should see — a hotel-listing
// style card:
//   company name, city, how far, price, rating on The Painted Painter, ratings the
//   painter reports from Google/Yelp/Facebook (with links), portfolio photos.
// Fuller detail (credentials, crew, reviews…) is fetched on demand by painter-detail.
//
// POST { ctx: <estimator context>, baseTotal: number }
//
// Deploy:
//   supabase functions deploy painter-results --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { zipDistanceMiles } from '../_shared/geo.ts'
import { estimatePainterPrice } from '../_shared/painterPricing.ts'
import { cleanExternalReviews } from '../_shared/externalReviews.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SERVICE_RADIUS_MILES = 50
const MAX_PHOTOS_PER_CARD = 8
/** Cheapest nearby painter is shown at baseline*(1-this), priciest at baseline*(1+this); the rest spread evenly between. */
const MAX_PRICE_SPREAD = 0.07

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
function priceDeviations(projected: (number | null)[]): number[] {
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server is not configured' }, 500)

    const { ctx, baseTotal } = await req.json() as { ctx?: Record<string, unknown>; baseTotal?: number }
    const zip = String(ctx?.zipCode ?? '')
    if (!ctx || !/^\d{5}$/.test(zip)) return json({ error: 'A 5-digit ZIP code is required' }, 400)
    if (typeof baseTotal !== 'number' || !isFinite(baseTotal) || baseTotal < 100 || baseTotal > 250000) return json({ error: 'Invalid price' }, 400)

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: rows, error } = await supabase
      .from('painters')
      .select('id, user_id, company_name, city, state, zip_code, service_types, external_reviews, price_1br_full, price_3br_walls, price_3br_trim_doors, price_3br_ceilings, price_5br_full, price_5br_cabinets')
      .eq('status', 'approved')
      .eq('verified', true)
    if (error) throw error

    // Nearby painters, nearest first.
    const nearby = (rows ?? [])
      .map((p) => ({ p, distance: zipDistanceMiles(zip, p.zip_code) }))
      .filter((x): x is { p: typeof x.p; distance: number } => x.distance !== null && x.distance <= SERVICE_RADIUS_MILES)
      .sort((a, b) => a.distance - b.distance)

    if (nearby.length === 0) return json({ painters: [] })

    // Private price estimate per painter -> rank-based deviation from the baseline.
    const projected = nearby.map(({ p }) => {
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
    const userIds = nearby.map(({ p }) => p.user_id).filter(Boolean) as string[]
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
      .in('painter_id', nearby.map(({ p }) => p.id))
      .order('created_at', { ascending: false })
    for (const row of portfolio ?? []) {
      const list = photos.get(row.painter_id) ?? []
      if (list.length < MAX_PHOTOS_PER_CARD) list.push(`${supabaseUrl}/storage/v1/object/public/painter-portfolio/${row.storage_path}`)
      photos.set(row.painter_id, list)
    }

    const wanted = jobSpecialties(ctx)
    const painters = nearby.map(({ p, distance }, i) => {
      const reasons: string[] = [distance < 5 ? 'right in your area' : `~${Math.round(distance)} mi away`]
      const overlaps = (p.service_types ?? []).filter((s: string) => wanted.some((w) => s.toLowerCase().includes(w)))
      if (overlaps.length > 0) reasons.push(`specializes in ${overlaps.slice(0, 2).join(' & ')}`)

      const r = p.user_id ? ratings.get(p.user_id) : undefined
      return {
        id: p.id,
        companyName: p.company_name,
        city: p.city,
        state: p.state,
        distanceMiles: Math.round(distance),
        price: Math.round(baseTotal * (1 + deviations[i])),
        rating: { average: r ? Math.round((r.sum / r.count) * 10) / 10 : null, count: r?.count ?? 0 },
        external: cleanExternalReviews(p.external_reviews),
        photos: photos.get(p.id) ?? [],
        reasons,
      }
    })

    return json({ painters })
  } catch (error) {
    console.error('Error in painter-results:', error)
    return json({ error: 'Could not load painters' }, 500)
  }
})
