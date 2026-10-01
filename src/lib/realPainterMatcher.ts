// ============================================================================
// Real painter matcher
// ============================================================================
// Finds actual approved/verified painters (from the `painters` table) within
// service range of a job, for the "claim your price" flow. This is a flat
// guaranteed-price marketplace — painters accept or they don't, there's no
// bidding — so unlike the marketing/browse painter list (fakePainters.ts),
// this has no simulated pricing: every matched painter is offered the same
// guaranteed price (minus commission).
// ============================================================================

import type { EstimatorContext } from './types';
import { supabase } from './supabase';
import { zipDistanceMiles } from './geo/distance';
import { calculateEstimate } from './estimateEngine';
import { estimatePainterPrice, type PainterProfile } from './painterPricingEngine';

/** A painter must be within this many miles of the job to be shown/notified. */
export const SERVICE_RADIUS_MILES = 50;

/** Cap on how many painters a "mystery painter" job fans out to. */
export const MYSTERY_BROADCAST_CAP = 25;

/**
 * Largest swing from the baseline price, in either direction. The cheapest
 * nearby painter is shown at baseline * (1 - MAX_PRICE_SPREAD), the priciest at
 * baseline * (1 + MAX_PRICE_SPREAD), and everyone else is spread evenly between.
 * Kept small on purpose: it's "same job, slightly different price", not a bidding war.
 */
export const MAX_PRICE_SPREAD = 0.07;

interface PainterPricingColumns {
  price_1br_full: number | null;
  price_3br_walls: number | null;
  price_3br_trim_doors: number | null;
  price_3br_ceilings: number | null;
  price_5br_full: number | null;
  price_5br_cabinets: number | null;
}

export interface RealPainter {
  id: string;
  company_name: string;
  owner_name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  zip_code: string;
  years_in_business: number | null;
  crew_size: number | null;
  service_types: string[];
  avgRating: number;
  reviewCount: number;
}

export interface RealPainterMatch {
  painter: RealPainter;
  distanceMiles: number | null;
  reasons: string[];
  /** Guaranteed price shown for (and charged if the customer picks) this painter. */
  price: number;
}

function jobSpecialtiesFromCtx(ctx: EstimatorContext): string[] {
  const s: string[] = [];
  if (ctx.projectType === 'interior' || ctx.projectType === 'both') s.push('interior');
  if (ctx.projectType === 'exterior' || ctx.projectType === 'both') s.push('exterior');
  if (ctx.cabinets && ctx.cabinets !== 'none') s.push('cabinet');
  if (ctx.deck && ctx.deck !== 'none') s.push('deck');
  if (ctx.propertyType === 'commercial') s.push('commercial');
  return s;
}

/** Fetch every approved/verified painter within service range of the job's ZIP, nearest first. */
export async function fetchNearbyPainters(ctx: EstimatorContext, baseTotal: number): Promise<RealPainterMatch[]> {
  const { data, error } = await supabase
    .from('painters')
    .select('id, company_name, owner_name, email, phone, city, state, zip_code, years_in_business, crew_size, service_types, price_1br_full, price_3br_walls, price_3br_trim_doors, price_3br_ceilings, price_5br_full, price_5br_cabinets')
    .eq('verified', true)
    .eq('status', 'approved');

  if (error || !data) {
    console.error('Failed to fetch painters:', error);
    return [];
  }

  const painterIds = data.map((p) => p.id);
  const ratingsById: Record<string, { avg_rating: number; review_count: number }> = {};
  if (painterIds.length > 0) {
    const { data: ratings } = await supabase
      .from('painter_ratings')
      .select('painter_id, avg_rating, review_count')
      .in('painter_id', painterIds);
    for (const r of ratings ?? []) {
      ratingsById[r.painter_id] = { avg_rating: r.avg_rating, review_count: r.review_count };
    }
  }

  const jobSpecialties = jobSpecialtiesFromCtx(ctx);
  const platformEstimate = calculateEstimate(ctx);

  const scored = (data as Array<Omit<RealPainter, 'avgRating' | 'reviewCount'> & PainterPricingColumns>).map((row) => {
    const { price_1br_full, price_3br_walls, price_3br_trim_doors, price_3br_ceilings, price_5br_full, price_5br_cabinets, ...painterFields } = row;
    const rating = ratingsById[row.id];
    const painter: RealPainter = { ...painterFields, avgRating: rating?.avg_rating ?? 0, reviewCount: rating?.review_count ?? 0 };
    const distanceMiles = ctx.zipCode ? zipDistanceMiles(ctx.zipCode, painter.zip_code) : null;
    const reasons: string[] = [];

    if (distanceMiles !== null) {
      reasons.push(distanceMiles < 5 ? 'right in your area' : `~${Math.round(distanceMiles)} mi away`);
    }

    const overlaps = (painter.service_types ?? []).filter((s) =>
      jobSpecialties.includes(s.toLowerCase()),
    );
    if (overlaps.length > 0) {
      reasons.push(`specializes in ${overlaps.slice(0, 2).join(' & ')}`);
    }

    const projectedPrice = projectPainterPrice(painter, ctx, platformEstimate, {
      price_1br_full, price_3br_walls, price_3br_trim_doors, price_3br_ceilings, price_5br_full, price_5br_cabinets,
    });

    return { painter, distanceMiles, reasons, projectedPrice };
  });

  const nearby = scored
    .filter((m) => m.distanceMiles !== null && m.distanceMiles <= SERVICE_RADIUS_MILES)
    .sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity));

  const deviations = priceDeviations(nearby.map((m) => m.projectedPrice));

  // Order stays nearest-first; only the displayed price varies.
  return nearby.map(({ projectedPrice: _projected, ...m }, i) => ({
    ...m,
    price: Math.round(baseTotal * (1 + deviations[i])),
  }));
}

/**
 * Turns each painter's own projected price for this job into a small deviation
 * from the baseline, by RANK among the painters competing for it:
 *   - the lowest projected price gets -MAX_PRICE_SPREAD,
 *   - the highest gets +MAX_PRICE_SPREAD,
 *   - everyone in between is spread evenly (the median painter lands on the
 *     baseline exactly when the count is odd),
 *   - painters with no pricing on file, or a lone painter, get no deviation.
 * Rank (not raw dollars) means 3 painters or 22 behave the same way, and one
 * outlier can't drag everybody else's price around. Ties share a rank.
 */
export function priceDeviations(projected: (number | null)[]): number[] {
  const priced = projected
    .map((p, i) => ({ p, i }))
    .filter((x): x is { p: number; i: number } => x.p !== null)
    .sort((a, b) => a.p - b.p);
  const out = projected.map(() => 0);
  const n = priced.length;
  if (n < 2) return out;

  let k = 0;
  while (k < n) {
    let j = k;
    while (j + 1 < n && priced[j + 1].p === priced[k].p) j++;
    const position = (k + j) / 2 / (n - 1); // 0 = cheapest, 1 = priciest
    const deviation = (position - 0.5) * 2 * MAX_PRICE_SPREAD;
    for (let t = k; t <= j; t++) out[priced[t].i] = deviation;
    k = j + 1;
  }
  return out;
}

function projectPainterPrice(
  painter: RealPainter,
  ctx: EstimatorContext,
  platformEstimate: ReturnType<typeof calculateEstimate>,
  p: PainterPricingColumns,
): number | null {
  const values = [p.price_1br_full, p.price_3br_walls, p.price_3br_trim_doors, p.price_3br_ceilings, p.price_5br_full, p.price_5br_cabinets];
  if (values.some((v) => v === null || !(v > 0))) return null;
  try {
    const profile = {
      id: painter.id,
      baseline: {
        price1BRFull: p.price_1br_full!,
        price3BRWalls: p.price_3br_walls!,
        price3BRTrimDoors: p.price_3br_trim_doors!,
        price3BRCeilings: p.price_3br_ceilings!,
        price5BRFull: p.price_5br_full!,
        price5BRCabinets: p.price_5br_cabinets!,
      },
    } as PainterProfile;
    const price = estimatePainterPrice(profile, ctx, platformEstimate);
    return isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}
