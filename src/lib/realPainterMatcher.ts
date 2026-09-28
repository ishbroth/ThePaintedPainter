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

/** A painter must be within this many miles of the job to be shown/notified. */
export const SERVICE_RADIUS_MILES = 50;

/** Cap on how many painters a "mystery painter" job fans out to. */
export const MYSTERY_BROADCAST_CAP = 25;

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
export async function fetchNearbyPainters(ctx: EstimatorContext): Promise<RealPainterMatch[]> {
  const { data, error } = await supabase
    .from('painters')
    .select('id, company_name, owner_name, email, phone, city, state, zip_code, years_in_business, crew_size, service_types')
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

  const scored: RealPainterMatch[] = (data as RealPainter[]).map((painterRow) => {
    const rating = ratingsById[painterRow.id];
    const painter: RealPainter = { ...painterRow, avgRating: rating?.avg_rating ?? 0, reviewCount: rating?.review_count ?? 0 };
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

    return { painter, distanceMiles, reasons };
  });

  return scored
    .filter((m) => m.distanceMiles !== null && m.distanceMiles <= SERVICE_RADIUS_MILES)
    .sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity));
}
