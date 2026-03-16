import type { EstimatorContext, EstimateBreakdown } from './types';

// ===== Painter Baseline Prices =====

export interface PainterBaseline {
  price1BRFull: number;       // Empty 1BR: walls, ceilings, trim, doors + kitchen cabinets
  price3BRWalls: number;      // 3BR home: walls only
  price3BRTrimDoors: number;  // 3BR home: trim & doors only
  price3BRCeilings: number;   // 3BR home: ceilings only
  price5BRFull: number;       // 5BR 3,500 sqft: walls, ceilings, trim, doors
  price5BRCabinets: number;   // 5BR 3,500 sqft: kitchen cabinets only
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

// ===== Reference Specs =====
// 1BR ~ 600 sqft, 3BR ~ 1,500 sqft, 5BR ~ 3,500 sqft

const REF_SQFT = {
  oneBR: 600,
  threeBR: 1500,
  fiveBR: 3500,
};

// ===== Estimate Painter Price for a Given Project =====

export function estimatePainterPrice(
  painter: PainterProfile,
  ctx: EstimatorContext,
  _aiEstimate: EstimateBreakdown
): number {
  const b = painter.baseline;
  const sqft = ctx.squareFeet || 1500;

  let estimatedPrice = 0;

  if (ctx.projectType === 'interior' || ctx.projectType === 'both') {
    estimatedPrice += interpolateInteriorPrice(b, ctx, sqft);
  }

  if (ctx.projectType === 'exterior' || ctx.projectType === 'both') {
    estimatedPrice += interpolateExteriorPrice(b, ctx, sqft);
  }

  // Cabinet add-on (separate from walls/ceilings/trim)
  if (ctx.cabinets !== 'none' && ctx.cabinetLocations.length > 0) {
    estimatedPrice += interpolateCabinetPrice(b, ctx, sqft);
  }

  // Condition/complexity multipliers
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
  if ((ctx.stories || 1) > 1 && (ctx.projectType === 'exterior' || ctx.projectType === 'both')) {
    multiplier *= 1 + ((ctx.stories || 1) - 1) * 0.12;
  }

  return Math.round(estimatedPrice * multiplier);
}

// ===== Interior Price Interpolation =====
// We now have component-level pricing from the 3BR baseline:
//   walls, trim/doors, ceilings each separately, plus a full-scope 1BR and 5BR.

function interpolateInteriorPrice(
  b: PainterBaseline,
  ctx: EstimatorContext,
  sqft: number
): number {
  // Derive the painter's per-sqft rates from their 3BR answers (1500 sqft reference)
  const wallsPerSqft = b.price3BRWalls / REF_SQFT.threeBR;
  const trimDoorsPerSqft = b.price3BRTrimDoors / REF_SQFT.threeBR;
  const ceilingsPerSqft = b.price3BRCeilings / REF_SQFT.threeBR;

  // For scaling validation, we also have the full 5BR rate
  // 5BR full = walls + ceilings + trim + doors at 3500 sqft
  const fiveFullPerSqft = b.price5BRFull / REF_SQFT.fiveBR;
  // Derived sum of components at 3BR scale
  const threeFullPerSqft = wallsPerSqft + trimDoorsPerSqft + ceilingsPerSqft;

  // Scale factor: how much cheaper per-sqft does the painter get on larger homes?
  // Compare their 5BR full rate vs. the sum of 3BR components
  const efficiencyRatio = threeFullPerSqft > 0
    ? fiveFullPerSqft / threeFullPerSqft
    : 0.85; // default: ~15% cheaper per sqft on large homes

  // Determine which components the customer needs
  const hasWalls = ctx.interiorWalls !== 'no';
  const hasCeilings = ctx.interiorCeilings === 'yes';
  const hasTrim = ctx.interiorTrim === 'yes' || ctx.interiorDoors !== 'none';

  // Build component price at 3BR (1500 sqft) reference rate
  let componentRate = 0;
  if (hasWalls) componentRate += wallsPerSqft;
  if (hasCeilings) componentRate += ceilingsPerSqft;
  if (hasTrim) componentRate += trimDoorsPerSqft;

  // Scale for actual sqft with efficiency curve
  let scaledRate = componentRate;
  if (sqft > REF_SQFT.threeBR) {
    // Blend toward the large-home efficiency ratio as sqft increases
    const t = Math.min((sqft - REF_SQFT.threeBR) / (REF_SQFT.fiveBR - REF_SQFT.threeBR), 1);
    const blendedEfficiency = 1 + t * (efficiencyRatio - 1);
    scaledRate = componentRate * blendedEfficiency;
  } else if (sqft < REF_SQFT.threeBR) {
    // Smaller homes: slightly higher per-sqft (less efficient)
    // Cross-reference with 1BR full price for validation
    // 1BR full includes walls + ceilings + trim + doors + cabinets
    // Subtract cabinet value to get just painting components
    const oneBRPaintOnly = b.price1BRFull - b.price5BRCabinets * 0.7; // small kitchen ~70% of large
    const oneBRPerSqft = oneBRPaintOnly / REF_SQFT.oneBR;
    const threePerSqft = threeFullPerSqft;

    // Small-home premium ratio
    const smallPremium = threePerSqft > 0 ? oneBRPerSqft / threePerSqft : 1.15;
    const t = Math.min((REF_SQFT.threeBR - sqft) / (REF_SQFT.threeBR - REF_SQFT.oneBR), 1);
    const blendedPremium = 1 + t * (smallPremium - 1);
    scaledRate = componentRate * blendedPremium;
  }

  let price = scaledRate * sqft;

  // Adjust for room fraction
  if (ctx.interiorScope === 'specific_rooms' && ctx.selectedRooms.length > 0) {
    const roomFraction = Math.min(ctx.selectedRooms.length / 8, 1);
    price *= roomFraction;
  }

  // Add extras (stairways, closets) using the painter's general rate level
  const generalRate = threeFullPerSqft > 0
    ? (wallsPerSqft + trimDoorsPerSqft + ceilingsPerSqft) / threeFullPerSqft
    : 1;

  if (ctx.stairways === 'yes') {
    price += (ctx.stairwayCount || 1) * 400 * generalRate;
  }
  if (ctx.closets !== 'none') {
    price += (ctx.closetCount || 2) * 250 * generalRate;
  }

  return price;
}

// ===== Cabinet Price Interpolation =====

function interpolateCabinetPrice(
  b: PainterBaseline,
  ctx: EstimatorContext,
  sqft: number
): number {
  // We have two cabinet data points: 1BR (small kitchen bundled) and 5BR (large kitchen standalone)
  // Use 5BR cabinets as the primary reference for a kitchen cabinet job
  const largeCabinetPrice = b.price5BRCabinets;

  // Derive small kitchen price from 1BR full minus painting components
  const oneBRPaintOnly = Math.max(
    b.price1BRFull - largeCabinetPrice * 0.7,
    b.price1BRFull * 0.6
  );
  const smallCabinetPrice = b.price1BRFull - oneBRPaintOnly;

  let total = 0;
  for (const loc of ctx.cabinetLocations) {
    if (loc === 'kitchen') {
      // Interpolate between small and large kitchen based on home size
      const t = Math.min(Math.max((sqft - REF_SQFT.oneBR) / (REF_SQFT.fiveBR - REF_SQFT.oneBR), 0), 1);
      total += smallCabinetPrice + t * (largeCabinetPrice - smallCabinetPrice);
    } else if (loc === 'bathroom') {
      total += largeCabinetPrice * 0.45;
    } else if (loc === 'laundry') {
      total += largeCabinetPrice * 0.35;
    }
  }

  return total;
}

// ===== Exterior Price Interpolation =====
// We no longer have direct exterior baselines, so we extrapolate from
// interior rates with a standard interior-to-exterior ratio.

function interpolateExteriorPrice(
  b: PainterBaseline,
  ctx: EstimatorContext,
  sqft: number
): number {
  // Derive exterior rate from interior data using industry ratio:
  // Exterior typically costs ~1.2x the walls-only interior rate
  const interiorWallRate = b.price3BRWalls / REF_SQFT.threeBR;
  const exteriorBaseRate = interiorWallRate * 1.2;

  // Trim adds ~15% on exterior
  const hasTrim = ctx.exteriorTrim === 'yes';
  const rate = hasTrim ? exteriorBaseRate * 1.15 : exteriorBaseRate;

  let price = rate * sqft;

  // Partial exterior
  if (ctx.exteriorScope === 'partial') {
    price *= 0.55;
  }

  // Repairs surcharge
  const needsRepairs =
    ctx.prepWork.includes('wood_rot') ||
    ctx.prepWork.includes('drywall_repair') ||
    ctx.exteriorCondition === 'poor';
  if (needsRepairs) {
    price *= 1.25;
  }

  // Extras
  if (ctx.fence === 'yes') {
    const fenceFt = ctx.fenceLinearFeet || 100;
    price += fenceFt * 4.5 * (interiorWallRate / (b.price3BRWalls / REF_SQFT.threeBR));
  }
  if (ctx.deck === 'yes') {
    price += 700 * (interiorWallRate / (b.price3BRWalls / REF_SQFT.threeBR));
  }

  return price;
}

// ===== Generate Painter Matches =====

export interface PainterMatch {
  painter: PainterProfile;
  estimatedPrice: number;
  priceRange: { low: number; high: number };
  matchScore: number;
}

export function generatePainterMatches(
  painters: PainterProfile[],
  ctx: EstimatorContext,
  aiEstimate: EstimateBreakdown
): PainterMatch[] {
  return painters
    .map((painter) => {
      const price = estimatePainterPrice(painter, ctx, aiEstimate);

      let score = 50;

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

      if (painter.yearsInBusiness >= 10) score += 10;
      else if (painter.yearsInBusiness >= 5) score += 5;

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

export function calculateGuaranteedPrice(
  matches: PainterMatch[],
  aiEstimate: EstimateBreakdown
): { guaranteedPrice: number; eligiblePainterCount: number } {
  if (matches.length === 0) {
    return { guaranteedPrice: aiEstimate.total, eligiblePainterCount: 0 };
  }

  const prices = matches.map((m) => m.estimatedPrice).sort((a, b) => a - b);
  const medianIdx = Math.floor(prices.length / 2);
  const medianPrice = prices[medianIdx];
  const guaranteedPrice = Math.round(medianPrice * 0.95);

  const eligible = matches.filter(
    (m) => guaranteedPrice >= m.priceRange.low && guaranteedPrice <= m.priceRange.high * 1.1
  ).length;

  return {
    guaranteedPrice: Math.max(guaranteedPrice, aiEstimate.lowRange),
    eligiblePainterCount: Math.max(eligible, 1),
  };
}
