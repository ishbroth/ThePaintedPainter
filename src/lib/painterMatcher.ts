// ============================================================================
// Painter Matcher
// ============================================================================
// Given a job context + guaranteed price, pick the painters who:
//   - Are actually within a real service radius of the job (by ZIP distance,
//     not ZIP-prefix guesswork — a 3-digit prefix match/mismatch says almost
//     nothing about how far away someone actually is)
//   - Match the job's specialty needs (cabinets, exterior, etc.)
//   - Would plausibly bid within a reasonable range of the guaranteed price
//     (deterministic — based on their rate tier, NOT random)
//
// Selection rules (per user spec):
//   - Aim for at least 2, preferably 4 painters shown, bracketing the
//     guaranteed price with one above and one below when possible.
//   - If many painters cluster in a tight range (±10%), show them all.
//   - Hard-exclude painters whose price falls wildly outside (>30% above
//     the guaranteed price).
//   - The "mystery pool" (for fanning out the guaranteed-price job) is every
//     painter in the reasonably-close set.
//   - If NO painter is within the service radius, `top` and `mysteryPool`
//     come back empty — the caller shows a "we'll find you one" message
//     rather than a wrong-side-of-the-country painter list.
//
// TODO: once the painter intake form is built, replace the sidecar
// MATCH_PROFILES with painter.intakeProfile fields so each painter's pricing
// reflects what they actually told us.
// ============================================================================

import type { EstimatorContext } from './types';
import { fakePainters, type FakePainter } from './fakePainters';
import { zipDistanceMiles } from './geo/distance';

/** A painter must be within this many miles of the job to be shown at all. */
const SERVICE_RADIUS_MILES = 50;

// ===== Match criteria (sidecar — not on FakePainter itself) =====
// Keyed by painter id. Anything missing falls back to sensible defaults derived
// from the painter's existing fields (crew_size, years_experience, rating, etc.).

interface PainterMatchProfile {
  /** Rate tier relative to market: budget (-10%), standard (0%), premium (+10-15%). */
  rateTier?: 'budget' | 'standard' | 'premium';
  /** Min job size ($) this painter will bid on. */
  minJobSize?: number;
  /** Max job size ($) this painter comfortably handles. */
  maxJobSize?: number;
  /** Specialties (keywords matched against job context). */
  specialties?: string[];
  /** Fraction 0-1: how often this painter bids at/below market. Higher = more likely to accept guaranteed price. */
  acceptRate?: number;
}

const MATCH_PROFILES: Record<string, PainterMatchProfile> = {
  // Deliberately sparse — everything else falls back to heuristics below.
  // Update these (or feed via future conversations) as real data arrives.
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890': { // Manhattan Brush Co (NY)
    rateTier: 'premium',
    minJobSize: 2500,
    maxJobSize: 250000,
    specialties: ['luxury', 'historic', 'apartment', 'commercial'],
    acceptRate: 0.35,
  },
  'b2c3d4e5-f6a7-8901-bcde-f12345678901': { // SoCal Pro (LA)
    rateTier: 'standard',
    minJobSize: 1200,
    maxJobSize: 80000,
    specialties: ['exterior', 'stucco', 'cabinet', 'deck'],
    acceptRate: 0.65,
  },
};

// ===== Defaults when a painter has no explicit profile =====

function profileFor(p: FakePainter): Required<PainterMatchProfile> {
  const explicit = MATCH_PROFILES[p.id] ?? {};

  // Derive defaults from existing fields
  const defaultTier: PainterMatchProfile['rateTier'] =
    p.rating >= 4.8 && p.years_experience >= 15
      ? 'premium'
      : p.rating >= 4.5
      ? 'standard'
      : 'budget';

  const defaultAccept =
    defaultTier === 'budget' ? 0.75 : defaultTier === 'standard' ? 0.55 : 0.3;

  return {
    rateTier: explicit.rateTier ?? defaultTier,
    minJobSize: explicit.minJobSize ?? (p.crew_size >= 8 ? 2000 : 800),
    maxJobSize: explicit.maxJobSize ?? (p.crew_size >= 8 ? 100000 : 40000),
    specialties: explicit.specialties ?? deriveSpecialties(p),
    acceptRate: explicit.acceptRate ?? defaultAccept,
  };
}

function deriveSpecialties(p: FakePainter): string[] {
  const s: string[] = [];
  const svc = p.services.map((x) => x.toLowerCase());
  if (svc.some((x) => x.includes('cabinet'))) s.push('cabinet');
  if (svc.some((x) => x.includes('exterior'))) s.push('exterior');
  if (svc.some((x) => x.includes('interior'))) s.push('interior');
  if (svc.some((x) => x.includes('commercial'))) s.push('commercial');
  if (svc.some((x) => x.includes('deck') || x.includes('stain'))) s.push('deck');
  if (svc.some((x) => x.includes('drywall'))) s.push('drywall_repair');
  if (svc.some((x) => x.includes('wallpaper'))) s.push('wallpaper');
  if (svc.some((x) => x.includes('power') || x.includes('pressure'))) s.push('powerwash');
  if (svc.some((x) => x.includes('stucco'))) s.push('stucco');
  return s;
}

// ===== Scoring =====

export interface PainterMatch {
  painter: FakePainter;
  score: number;
  reasons: string[];
  /** Deterministic price they'd likely charge for this job. */
  painterPrice: number;
  /** Distance from guaranteed price as a signed fraction (-0.05 = 5% below, +0.10 = 10% above). */
  priceDelta: number;
  /** Straight-line miles from the job's ZIP, or null if either ZIP couldn't be resolved. */
  distanceMiles: number | null;
}

export interface MatchResult {
  /** Painters shown in the hotwire-style list, bracketing the guaranteed price. */
  top: PainterMatch[];
  /** Pool the guaranteed-price job fans out to if the user picks Mystery Painter. */
  mysteryPool: PainterMatch[];
  /** Guaranteed price (10% below market). */
  guaranteedPrice: number;
  /** Market price (the raw estimator total / 0.9). */
  marketPrice: number;
}

// Per-painter price tier relative to market.
// TODO: replace with real rate data from painter intake form.
const TIER_PRICE_FACTOR = {
  budget: 0.92,
  standard: 1.0,
  premium: 1.12,
} as const;

// Selection tuning knobs.
const PRICE_CLOSE_FRACTION = 0.10;   // painters within ±10% are considered "clustered close"
const PRICE_HARD_CEILING = 0.30;     // hard-drop painters >30% above guaranteed price
const PRICE_HARD_FLOOR = -0.40;      // hard-drop painters >40% below guaranteed (too cheap is suspicious)
const TARGET_MIN = 2;
const TARGET_IDEAL = 4;

export function matchPainters(
  ctx: EstimatorContext,
  marketPrice: number,
  guaranteedPrice: number,
): MatchResult {
  const jobSpecialties = jobSpecialtiesFromCtx(ctx);

  // 1. Score & price every painter (deterministic).
  const scored: PainterMatch[] = fakePainters.map((p) => {
    const profile = profileFor(p);
    const reasons: string[] = [];
    let score = 0;

    const distanceMiles = ctx.zipCode ? zipDistanceMiles(ctx.zipCode, p.zip_code) : null;

    // Area match (heavy weight) — real distance, not ZIP-prefix guesswork.
    if (distanceMiles !== null && distanceMiles <= SERVICE_RADIUS_MILES) {
      score += 50 - Math.min(distanceMiles, 40); // closer painters within the radius score higher
      reasons.push(distanceMiles < 5 ? 'right in your area' : `~${Math.round(distanceMiles)} mi away`);
    } else if (ctx.state && p.state.toLowerCase() === ctx.state.toLowerCase()) {
      // Doesn't pass the service-radius gate below, but still worth a small
      // score bump in case nobody in the whole roster is actually close.
      score += 10;
      reasons.push(`${p.state}-based`);
    }

    // Specialty match
    const overlaps = profile.specialties.filter((s) => jobSpecialties.includes(s));
    if (overlaps.length > 0) {
      score += overlaps.length * 10;
      reasons.push(`specializes in ${overlaps.slice(0, 2).join(' & ')}`);
    }

    // Job-size fit
    if (marketPrice >= profile.minJobSize && marketPrice <= profile.maxJobSize) {
      score += 12;
    } else if (marketPrice < profile.minJobSize) {
      score -= 8;
      reasons.push(`below their usual minimum`);
    } else {
      score += 3;
      reasons.push('handles large projects');
    }

    // Quality signal
    score += p.rating * 5;
    score += Math.min(p.review_count / 10, 15);

    // Deterministic price
    const painterPrice = Math.round(marketPrice * TIER_PRICE_FACTOR[profile.rateTier]);
    const priceDelta = (painterPrice - guaranteedPrice) / guaranteedPrice;

    return { painter: p, score, reasons, painterPrice, priceDelta, distanceMiles };
  });

  // 2. Area gate: painter must actually be within the service radius of the
  //    job. No wrong-side-of-the-country results — if nobody qualifies, the
  //    caller shows a "we'll find you one" message instead of an empty or
  //    (worse) irrelevant list.
  const serviceable = scored.filter(
    (m) => m.distanceMiles !== null && m.distanceMiles <= SERVICE_RADIUS_MILES,
  );

  // 3. Price gate: drop painters whose price falls wildly outside the guaranteed price.
  const inBand = serviceable.filter(
    (m) => m.priceDelta <= PRICE_HARD_CEILING && m.priceDelta >= PRICE_HARD_FLOOR,
  );

  // 4. Pick the display set: bracket the guaranteed price.
  //    Prefer at least one below, at least one above, aim for 4 total.
  const below = inBand
    .filter((m) => m.painterPrice <= guaranteedPrice)
    .sort((a, b) => b.painterPrice - a.painterPrice); // closest below first
  const above = inBand
    .filter((m) => m.painterPrice > guaranteedPrice)
    .sort((a, b) => a.painterPrice - b.painterPrice); // closest above first

  // If many painters are clustered tight (±PRICE_CLOSE_FRACTION), show them all.
  const clustered = inBand.filter((m) => Math.abs(m.priceDelta) <= PRICE_CLOSE_FRACTION);
  let top: PainterMatch[];

  if (clustered.length >= TARGET_IDEAL) {
    top = [...clustered].sort((a, b) => a.painterPrice - b.painterPrice);
  } else {
    // Interleave above/below: nearest below, nearest above, next below, next above, ...
    top = [];
    let bi = 0, ai = 0;
    while (top.length < TARGET_IDEAL && (bi < below.length || ai < above.length)) {
      if (bi < below.length) top.push(below[bi++]);
      if (top.length >= TARGET_IDEAL) break;
      if (ai < above.length) top.push(above[ai++]);
    }
    // Backfill with best-score leftovers to hit TARGET_MIN if the bracket is lopsided.
    if (top.length < TARGET_MIN) {
      const shownIds = new Set(top.map((m) => m.painter.id));
      const leftovers = inBand
        .filter((m) => !shownIds.has(m.painter.id))
        .sort((a, b) => Math.abs(a.priceDelta) - Math.abs(b.priceDelta));
      while (top.length < TARGET_MIN && leftovers.length > 0) {
        top.push(leftovers.shift()!);
      }
    }
    // Display sorted by price ascending — easy to scan low-to-high.
    top.sort((a, b) => a.painterPrice - b.painterPrice);
  }

  // 5. Mystery pool = everyone in the price band who passes the serviceable gate.
  //    If the user picks the guaranteed price, the job fans out to all of them.
  const mysteryPool = inBand;

  return { top, mysteryPool, guaranteedPrice, marketPrice };
}

function jobSpecialtiesFromCtx(ctx: EstimatorContext): string[] {
  const s: string[] = [];
  if (ctx.projectType === 'interior' || ctx.projectType === 'both') s.push('interior');
  if (ctx.projectType === 'exterior' || ctx.projectType === 'both') s.push('exterior');
  if (ctx.cabinets && ctx.cabinets !== 'none') s.push('cabinet');
  if (ctx.deck && ctx.deck !== 'none') s.push('deck');
  if (ctx.prepWork.includes('wallpaper_removal')) s.push('wallpaper');
  if (ctx.prepWork.includes('power_washing')) s.push('powerwash');
  if (ctx.prepWork.includes('drywall_repair') || ctx.drywallRepairExtent !== 'minor') s.push('drywall_repair');
  if (ctx.sidingType === 'stucco') s.push('stucco');
  if (ctx.propertyType === 'commercial') s.push('commercial');
  if (ctx.projectCondition === 'new_construction' || ctx.projectCondition === 'renovation') s.push('drywall_repair');
  return s;
}
