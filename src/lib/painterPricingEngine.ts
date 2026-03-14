import type { EstimatorContext, EstimateBreakdown } from './types';

// ===== Painter Baseline Prices =====

export interface PainterBaseline {
  price1BRRental: number;      // Empty 1BR: ceilings, walls, trim, doors
  price3BRWalls: number;       // 3BR home: walls only
  priceKitchenCabinets: number; // Kitchen cabinets, large home
  priceExterior1500: number;    // Exterior 1,500 sqft: siding, trim, doors
  priceExterior3500: number;    // Exterior 3,500 sqft: with repairs
}

export interface PainterProfile {
  id: string;
  companyName: string;
  ownerName: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  website: string;
  yearsInBusiness: number;
  crewSize: number;
  hasLicense: boolean;
  licenseNumber: string;
  isInsured: boolean;
  isBonded: boolean;
  certifications: string[];
  serviceTypes: string[];
  offersWarranty: boolean;
  warrantyLength: string;
  offersEstimates: boolean;
  baseline: PainterBaseline;
}

// ===== Reference Project Specs =====
// These define what the 5 baseline scenarios represent in terms of estimator units

const REFERENCE_PROJECTS = {
  // 1BR rental: ~600 sqft, full interior (walls, ceilings, trim, doors ~5 doors)
  oneBR: { sqft: 600, interiorFraction: 1.0, hasCeilings: true, hasTrim: true, doorCount: 5, isExterior: false },
  // 3BR walls only: ~1500 sqft, walls only
  threeBR: { sqft: 1500, interiorFraction: 1.0, hasCeilings: false, hasTrim: false, doorCount: 0, isExterior: false },
  // Kitchen cabinets (large): standalone cabinet job
  cabinets: { isCabinetJob: true },
  // Exterior 1500 sqft: siding, trim, doors
  ext1500: { sqft: 1500, isExterior: true, hasRepairs: false },
  // Exterior 3500 sqft: with repairs
  ext3500: { sqft: 3500, isExterior: true, hasRepairs: true },
};

// ===== Estimate Painter Price for a Given Project =====

export function estimatePainterPrice(
  painter: PainterProfile,
  ctx: EstimatorContext,
  aiEstimate: EstimateBreakdown
): number {
  const baseline = painter.baseline;

  // Calculate the AI's own estimate for each reference project to get painter-to-AI ratios
  const painterRatios = calculatePainterRatios(baseline);

  // Determine the most relevant reference projects based on the user's actual project
  const projectType = ctx.projectType;
  const sqft = ctx.squareFeet || 1500;

  let estimatedPrice = 0;

  if (projectType === 'interior' || projectType === 'both') {
    estimatedPrice += interpolateInteriorPrice(baseline, painterRatios, ctx, sqft);
  }

  if (projectType === 'exterior' || projectType === 'both') {
    estimatedPrice += interpolateExteriorPrice(baseline, painterRatios, ctx, sqft);
  }

  // Cabinet add-on
  if (ctx.cabinets !== 'none' && ctx.cabinetLocations.length > 0) {
    const cabinetRatio = painterRatios.cabinetRatio;
    // Scale from kitchen cabinets baseline based on which cabinets
    let cabinetFactor = 0;
    for (const loc of ctx.cabinetLocations) {
      if (loc === 'kitchen') cabinetFactor += 1.0;
      if (loc === 'bathroom') cabinetFactor += 0.5;
      if (loc === 'laundry') cabinetFactor += 0.4;
    }
    estimatedPrice += baseline.priceKitchenCabinets * cabinetFactor * cabinetRatio;
  }

  // Apply condition/complexity multipliers (same factors the AI uses)
  let multiplier = 1.0;

  if (ctx.occupancy === 'furnished' || ctx.occupancy === 'occupied') {
    multiplier *= 1.03;
  }
  if (ctx.exteriorCondition === 'poor') {
    multiplier *= 1.15;
  } else if (ctx.exteriorCondition === 'fair') {
    multiplier *= 1.07;
  }
  if (ctx.interiorColorChange === 'dramatic') {
    multiplier *= 1.05;
  }
  if ((ctx.stories || 1) > 1 && (projectType === 'exterior' || projectType === 'both')) {
    multiplier *= 1 + ((ctx.stories || 1) - 1) * 0.12;
  }

  return Math.round(estimatedPrice * multiplier);
}

// ===== Painter-to-AI Ratios =====
// Compares what the painter charges for reference projects vs. what the AI would charge

function calculatePainterRatios(baseline: PainterBaseline) {
  // AI reference prices for the 5 scenarios (based on PRICING config)
  // These are approximate AI prices for each reference scenario
  const aiRef = {
    oneBR: 600 * 2.25 + 600 * 0.45 + 600 * 0.27 + 5 * 175, // walls + ceilings + trim + doors = ~2,657
    threeBR: 1500 * 2.25, // walls only = 3,375
    cabinets: 2250, // kitchen cabinets fixed price
    ext1500: 1500 * 2.70 + 1500 * 0.36 + 225, // body + trim + entry door = 4,815
    ext3500: 3500 * 2.70 + 3500 * 0.36 + 225 + 3500 * 2.70 * 0.25, // + 25% repair surcharge = 12,540 approx
  };

  return {
    interiorFullRatio: baseline.price1BRRental / aiRef.oneBR,
    interiorWallsRatio: baseline.price3BRWalls / aiRef.threeBR,
    cabinetRatio: baseline.priceKitchenCabinets / aiRef.cabinets,
    exteriorRatio: baseline.priceExterior1500 / aiRef.ext1500,
    exteriorRepairRatio: baseline.priceExterior3500 / aiRef.ext3500,
  };
}

// ===== Interior Price Interpolation =====

function interpolateInteriorPrice(
  baseline: PainterBaseline,
  ratios: ReturnType<typeof calculatePainterRatios>,
  ctx: EstimatorContext,
  sqft: number
): number {
  // Determine if project is more like "full interior" or "walls only"
  const hasFullScope =
    ctx.interiorCeilings === 'yes' ||
    ctx.interiorTrim === 'yes' ||
    ctx.interiorDoors !== 'none';

  // Base ratio: blend between full-interior and walls-only ratios
  const ratio = hasFullScope
    ? ratios.interiorFullRatio * 0.7 + ratios.interiorWallsRatio * 0.3
    : ratios.interiorWallsRatio * 0.8 + ratios.interiorFullRatio * 0.2;

  // Scale by square footage relative to reference
  // 1BR = 600 sqft, 3BR = 1500 sqft
  const refSqft = hasFullScope ? 600 : 1500;
  const sqftScale = sqft / refSqft;

  // Base price from the most relevant reference
  const refPrice = hasFullScope ? baseline.price1BRRental : baseline.price3BRWalls;

  // Scale non-linearly (larger spaces are more efficient per sqft)
  const scaleFactor = sqftScale < 1
    ? sqftScale
    : 1 + (sqftScale - 1) * 0.85; // diminishing returns on larger spaces

  let price = refPrice * scaleFactor;

  // Adjust for room fraction (specific rooms vs whole house)
  if (ctx.interiorScope === 'specific_rooms' && ctx.selectedRooms.length > 0) {
    const roomFraction = Math.min(ctx.selectedRooms.length / 8, 1); // rough fraction
    price *= roomFraction;
  }

  // Add extras not captured in base (stairways, closets, etc.)
  if (ctx.stairways === 'yes') {
    price += (ctx.stairwayCount || 1) * 400 * ratio;
  }
  if (ctx.closets !== 'none') {
    price += (ctx.closetCount || 2) * 250 * ratio;
  }

  return price;
}

// ===== Exterior Price Interpolation =====

function interpolateExteriorPrice(
  baseline: PainterBaseline,
  ratios: ReturnType<typeof calculatePainterRatios>,
  ctx: EstimatorContext,
  sqft: number
): number {
  // Determine if project needs repairs
  const needsRepairs =
    ctx.prepWork.includes('wood_rot') ||
    ctx.prepWork.includes('drywall_repair') ||
    ctx.exteriorCondition === 'poor';

  // Use repair or standard ratio
  const ratio = needsRepairs
    ? ratios.exteriorRepairRatio * 0.6 + ratios.exteriorRatio * 0.4
    : ratios.exteriorRatio;

  // Interpolate between 1500 and 3500 sqft reference points
  let price: number;
  if (sqft <= 1500) {
    price = baseline.priceExterior1500 * (sqft / 1500);
  } else if (sqft >= 3500) {
    price = baseline.priceExterior3500 * (sqft / 3500) * (needsRepairs ? 1.0 : 0.8);
  } else {
    // Linear interpolation between the two reference points
    const t = (sqft - 1500) / (3500 - 1500);
    const refLow = needsRepairs ? baseline.priceExterior1500 * 1.15 : baseline.priceExterior1500;
    const refHigh = needsRepairs ? baseline.priceExterior3500 : baseline.priceExterior3500 * 0.85;
    price = refLow + t * (refHigh - refLow);
  }

  // Partial exterior
  if (ctx.exteriorScope === 'partial') {
    price *= 0.55;
  }

  // Add extras
  if (ctx.fence === 'yes') {
    const fenceFt = ctx.fenceLinearFeet || 100;
    price += fenceFt * 4.5 * ratio;
  }
  if (ctx.deck === 'yes') {
    price += 700 * ratio;
  }

  return price;
}

// ===== Generate Painter Matches =====

export interface PainterMatch {
  painter: PainterProfile;
  estimatedPrice: number;
  priceRange: { low: number; high: number };
  matchScore: number; // 0-100, how well this painter fits the project
}

export function generatePainterMatches(
  painters: PainterProfile[],
  ctx: EstimatorContext,
  aiEstimate: EstimateBreakdown
): PainterMatch[] {
  return painters
    .map((painter) => {
      const price = estimatePainterPrice(painter, ctx, aiEstimate);

      // Match score based on: location proximity, service coverage, experience
      let score = 50; // base

      // ZIP code match
      if (painter.zipCode.substring(0, 3) === ctx.zipCode.substring(0, 3)) {
        score += 20;
      }
      if (painter.serviceTypes.some((s) => {
        if (ctx.projectType === 'interior' || ctx.projectType === 'both') {
          return s.includes('Interior');
        }
        if (ctx.projectType === 'exterior' || ctx.projectType === 'both') {
          return s.includes('Exterior');
        }
        return false;
      })) {
        score += 15;
      }

      // Experience bonus
      if (painter.yearsInBusiness >= 10) score += 10;
      else if (painter.yearsInBusiness >= 5) score += 5;

      // Credentials bonus
      if (painter.hasLicense) score += 5;
      if (painter.isInsured) score += 5;
      if (painter.isBonded) score += 3;
      if (painter.offersWarranty) score += 2;

      score = Math.min(score, 100);

      return {
        painter,
        estimatedPrice: price,
        priceRange: {
          low: Math.round(price * 0.92),
          high: Math.round(price * 1.08),
        },
        matchScore: score,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

// ===== Guaranteed Price Calculation =====
// The "Hotwire" price: lowest price at which at least one painter would likely accept

export function calculateGuaranteedPrice(
  matches: PainterMatch[],
  aiEstimate: EstimateBreakdown
): { guaranteedPrice: number; eligiblePainterCount: number } {
  if (matches.length === 0) {
    return { guaranteedPrice: aiEstimate.total, eligiblePainterCount: 0 };
  }

  // Find the price at which multiple painters fall within range
  // Use the AI estimate as the anchor, then find painters near or below it
  const prices = matches.map((m) => m.estimatedPrice).sort((a, b) => a - b);

  // Guaranteed price = slightly below the median painter price to ensure competition
  const medianIdx = Math.floor(prices.length / 2);
  const medianPrice = prices[medianIdx];

  // Set guaranteed price at 95% of median (incentive to accept)
  const guaranteedPrice = Math.round(medianPrice * 0.95);

  // Count how many painters' ranges include this price
  const eligible = matches.filter(
    (m) => guaranteedPrice >= m.priceRange.low && guaranteedPrice <= m.priceRange.high * 1.1
  ).length;

  return {
    guaranteedPrice: Math.max(guaranteedPrice, aiEstimate.lowRange), // don't go below AI low range
    eligiblePainterCount: Math.max(eligible, 1),
  };
}
