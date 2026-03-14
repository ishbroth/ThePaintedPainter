import type { EstimatorContext, EstimateBreakdown, EstimateLineItem } from './types';
import { PRICING } from './pricingConfig';

export function calculateEstimate(ctx: EstimatorContext): EstimateBreakdown {
  const lineItems: EstimateLineItem[] = [];
  const sqft = ctx.squareFeet || 1500; // fallback estimate
  const roomFraction = getRoomFraction(ctx);

  // ===== INTERIOR =====
  if (ctx.projectType === 'interior' || ctx.projectType === 'both') {
    const interiorSqft = sqft * roomFraction;

    // Walls
    if (ctx.interiorWalls !== 'no') {
      lineItems.push({
        category: 'Interior',
        description: 'Interior Walls',
        amount: interiorSqft * PRICING.perSqFt.interiorBase,
      });
    }

    // Accent walls
    if (ctx.accentWalls === 'yes') {
      lineItems.push({
        category: 'Interior',
        description: 'Accent Walls',
        amount: interiorSqft * PRICING.perSqFt.colorChange * 0.3,
      });
    }

    // Ceilings
    if (ctx.interiorCeilings === 'yes') {
      lineItems.push({
        category: 'Interior',
        description: 'Ceilings',
        amount: interiorSqft * PRICING.perSqFt.ceilings,
      });
    }

    // Trim & Baseboards
    if (ctx.interiorTrim === 'yes') {
      lineItems.push({
        category: 'Interior',
        description: 'Trim & Baseboards',
        amount: interiorSqft * PRICING.perSqFt.trim,
      });
    }
    if (ctx.baseboards === 'yes' && ctx.interiorTrim !== 'yes') {
      lineItems.push({
        category: 'Interior',
        description: 'Baseboards',
        amount: interiorSqft * PRICING.perSqFt.baseboards,
      });
    }

    // Crown molding
    if (ctx.crownMolding === 'yes') {
      lineItems.push({
        category: 'Interior',
        description: 'Crown Molding',
        amount: interiorSqft * PRICING.perSqFt.crownMolding,
      });
    }

    // Wainscoting
    if (ctx.wainscoting === 'yes') {
      lineItems.push({
        category: 'Interior',
        description: 'Wainscoting / Paneling',
        amount: interiorSqft * PRICING.perSqFt.wainscoting,
      });
    }

    // Doors
    if (ctx.interiorDoors !== 'none') {
      const doorCount = ctx.doorCount || estimateDoorCount(ctx);
      const doorTypes = ctx.doorTypes.length > 0 ? ctx.doorTypes : ['standard'];
      let doorTotal = 0;

      for (const type of doorTypes) {
        const countForType = Math.ceil(doorCount / doorTypes.length);
        switch (type) {
          case 'french':
            doorTotal += countForType * PRICING.perUnit.frenchDoor;
            break;
          case 'closet':
            doorTotal += countForType * PRICING.perUnit.closetDoor;
            break;
          case 'pocket':
            doorTotal += countForType * PRICING.perUnit.pocketDoor;
            break;
          default:
            doorTotal += countForType * PRICING.perUnit.interiorDoor;
        }
      }

      lineItems.push({
        category: 'Interior',
        description: `Interior Doors (${doorCount})`,
        amount: doorTotal,
      });

      // Door frames
      if (ctx.doorFrames === 'yes') {
        lineItems.push({
          category: 'Interior',
          description: 'Door Frames & Casings',
          amount: doorCount * 45,
        });
      }
    }

    // Windows
    if (ctx.interiorWindows !== 'none') {
      const winCount = ctx.windowCount || estimateWindowCount(ctx);
      const winTypes = ctx.windowTypes.length > 0 ? ctx.windowTypes : ['single'];
      let winTotal = 0;

      for (const type of winTypes) {
        const countForType = Math.ceil(winCount / winTypes.length);
        switch (type) {
          case 'double_hung':
            winTotal += countForType * PRICING.perUnit.windowDoubleHung;
            break;
          case 'french_pane':
            winTotal += countForType * PRICING.perUnit.windowFrenchPane;
            break;
          case 'bay':
            winTotal += countForType * PRICING.perUnit.windowBay;
            break;
          default:
            winTotal += countForType * PRICING.perUnit.windowSingle;
        }
      }

      lineItems.push({
        category: 'Interior',
        description: `Window Frames/Sills (${winCount})`,
        amount: winTotal,
      });
    }

    // Cabinets
    if (ctx.cabinets !== 'none') {
      const locations = ctx.cabinetLocations.length > 0 ? ctx.cabinetLocations : ['kitchen'];
      for (const loc of locations) {
        switch (loc) {
          case 'kitchen':
            lineItems.push({ category: 'Interior', description: 'Kitchen Cabinets', amount: PRICING.fixed.kitchenCabinets });
            break;
          case 'bathroom':
            lineItems.push({ category: 'Interior', description: 'Bathroom Cabinets', amount: PRICING.fixed.bathroomCabinets });
            break;
          case 'laundry':
            lineItems.push({ category: 'Interior', description: 'Laundry Cabinets', amount: PRICING.fixed.laundryCabinets });
            break;
        }
      }
    }

    // Closets
    if (ctx.closets !== 'none') {
      const closetCount = ctx.closetCount || 2;
      if (ctx.closets === 'standard') {
        lineItems.push({ category: 'Interior', description: `Closets (${closetCount})`, amount: closetCount * PRICING.fixed.standardCloset });
      } else if (ctx.closets === 'walkin') {
        lineItems.push({ category: 'Interior', description: `Walk-in Closets (${closetCount})`, amount: closetCount * PRICING.fixed.walkInCloset });
      } else if (ctx.closets === 'both') {
        const half = Math.ceil(closetCount / 2);
        lineItems.push({ category: 'Interior', description: `Standard Closets (${half})`, amount: half * PRICING.fixed.standardCloset });
        lineItems.push({ category: 'Interior', description: `Walk-in Closets (${closetCount - half})`, amount: (closetCount - half) * PRICING.fixed.walkInCloset });
      }
    }

    // Stairways
    if (ctx.stairways === 'yes') {
      const stairCount = ctx.stairwayCount || 1;
      let stairMultiplier = 1.0;
      if (ctx.stairwayDetails === 'walls_and_railings') stairMultiplier = 1.3;
      if (ctx.stairwayDetails === 'full') stairMultiplier = 1.6;

      lineItems.push({
        category: 'Interior',
        description: `Stairways (${stairCount})`,
        amount: stairCount * PRICING.fixed.stairway * stairMultiplier,
      });
    }

    // Interior shutters
    if (ctx.interiorShutters === 'yes') {
      lineItems.push({
        category: 'Interior',
        description: 'Interior Shutters',
        amount: 8 * PRICING.perUnit.exteriorShutterPer, // estimate 8 shutters
      });
    }

    // Color change
    if (ctx.interiorColorChange === 'different') {
      lineItems.push({
        category: 'Interior',
        description: 'Color Change (extra coat)',
        amount: interiorSqft * PRICING.perSqFt.colorChange,
      });
    }
  }

  // ===== EXTERIOR =====
  if (ctx.projectType === 'exterior' || ctx.projectType === 'both') {
    // Siding / body
    lineItems.push({
      category: 'Exterior',
      description: 'Exterior Body / Siding',
      amount: sqft * PRICING.perSqFt.exteriorBase * (ctx.exteriorScope === 'partial' ? 0.5 : 1),
    });

    // Trim/fascia
    if (ctx.exteriorTrim === 'yes') {
      lineItems.push({
        category: 'Exterior',
        description: 'Exterior Trim & Fascia',
        amount: sqft * PRICING.perSqFt.exteriorTrim,
      });
    }

    // Soffits/eaves
    if (ctx.soffitsEaves === 'yes') {
      lineItems.push({
        category: 'Exterior',
        description: 'Soffits & Eaves',
        amount: sqft * PRICING.perSqFt.soffitsEaves,
      });
    }

    // Shutters
    if (ctx.exteriorShutters === 'yes') {
      const shutterCount = ctx.exteriorShutterCount || 8;
      lineItems.push({
        category: 'Exterior',
        description: `Exterior Shutters (${shutterCount})`,
        amount: shutterCount * PRICING.perUnit.exteriorShutterPer,
      });
    }

    // Garage door
    if (ctx.garageDoor === 'single') {
      lineItems.push({ category: 'Exterior', description: 'Garage Door (Single)', amount: PRICING.fixed.garageDoorSingle });
    } else if (ctx.garageDoor === 'double') {
      lineItems.push({ category: 'Exterior', description: 'Garage Door (Double)', amount: PRICING.fixed.garageDoorDouble });
    }

    // Entry door
    if (ctx.entryDoor === 'yes') {
      lineItems.push({ category: 'Exterior', description: 'Entry Door', amount: PRICING.fixed.entryDoor });
    }

    // Railings
    if (ctx.railings === 'yes') {
      switch (ctx.railingType) {
        case 'simple':
          lineItems.push({ category: 'Exterior', description: 'Railings (Simple)', amount: PRICING.fixed.railingsSimple });
          break;
        case 'spindles':
          lineItems.push({ category: 'Exterior', description: 'Railings (Spindles)', amount: PRICING.fixed.railingsSpindles });
          break;
        case 'both':
          lineItems.push({ category: 'Exterior', description: 'Railings (Multiple Types)', amount: PRICING.fixed.railingsBoth });
          break;
        default:
          lineItems.push({ category: 'Exterior', description: 'Railings', amount: PRICING.fixed.railingsSimple });
      }
    }

    // Balconies
    if (ctx.balconies === 'yes') {
      const balcCount = ctx.balconyCount || 1;
      lineItems.push({ category: 'Exterior', description: `Balconies (${balcCount})`, amount: balcCount * PRICING.fixed.balcony });
    }

    // Deck
    if (ctx.deck === 'yes') {
      const deckSqft = PRICING.deckSizes[ctx.deckSize as keyof typeof PRICING.deckSizes] || PRICING.deckSizes.medium;
      lineItems.push({ category: 'Exterior', description: 'Deck', amount: deckSqft * PRICING.perUnit.deckPerSqFt });
    }

    // Fence
    if (ctx.fence === 'yes') {
      const fenceFt = ctx.fenceLinearFeet || 100;
      lineItems.push({ category: 'Exterior', description: `Fence (${fenceFt} ft)`, amount: fenceFt * PRICING.perUnit.fencePerLinearFt });
    }

    // Gutters
    if (ctx.gutters === 'yes') {
      lineItems.push({ category: 'Exterior', description: 'Gutters & Downspouts', amount: sqft * PRICING.perSqFt.guttersDownspouts });
    }

    // Foundation
    if (ctx.foundation === 'yes') {
      lineItems.push({ category: 'Exterior', description: 'Foundation Walls', amount: (sqft * 0.15) * PRICING.perSqFt.foundationWalls });
    }

    // Exterior windows
    if (ctx.exteriorWindows !== 'none') {
      const extWinCount = ctx.exteriorWindowCount || estimateWindowCount(ctx);
      lineItems.push({
        category: 'Exterior',
        description: `Exterior Window Trim (${extWinCount})`,
        amount: extWinCount * PRICING.perUnit.exteriorWindowTrim,
      });
    }

    // Overhangs
    if (ctx.overhangs === 'yes') {
      lineItems.push({ category: 'Exterior', description: 'Overhangs / Patio Covers', amount: sqft * 0.12 * PRICING.perSqFt.soffitsEaves });
    }

    // Multi-story
    if ((ctx.stories || 1) > 1) {
      const extraStories = (ctx.stories || 1) - 1;
      lineItems.push({
        category: 'Exterior',
        description: `Multi-story Access (${ctx.stories} stories)`,
        amount: sqft * PRICING.perSqFt.multiStoryPerStory * extraStories,
      });
    }

    // Access restrictions
    if (ctx.accessRestrictions === 'some' || ctx.accessRestrictions === 'significant') {
      const factor = ctx.accessRestrictions === 'significant' ? 2 : 1;
      lineItems.push({
        category: 'Exterior',
        description: 'Access Restriction Surcharge',
        amount: sqft * PRICING.perSqFt.accessRestriction * factor,
      });
    }

    // Exterior color change
    if (ctx.exteriorColorChange === 'different') {
      lineItems.push({
        category: 'Exterior',
        description: 'Exterior Color Change',
        amount: sqft * PRICING.perSqFt.colorChange,
      });
    }
  }

  // ===== PREP WORK =====
  if (ctx.prepWork.includes('power_washing')) {
    lineItems.push({ category: 'Prep Work', description: 'Power Washing', amount: PRICING.fixed.powerWashing });
  }
  if (ctx.prepWork.includes('lead_test')) {
    lineItems.push({ category: 'Prep Work', description: 'Lead Paint Testing', amount: PRICING.fixed.leadPaintTest });
  }
  if (ctx.prepWork.includes('wallpaper_removal')) {
    const rooms = ctx.wallpaperRooms || 1;
    lineItems.push({ category: 'Prep Work', description: `Wallpaper Removal (${rooms} rooms)`, amount: rooms * PRICING.fixed.wallpaperRemovalPerRoom });
  }
  if (ctx.prepWork.includes('popcorn_removal')) {
    const rooms = ctx.popcornCeilingRooms || 1;
    lineItems.push({ category: 'Prep Work', description: `Popcorn Ceiling Removal (${rooms} rooms)`, amount: rooms * PRICING.fixed.popcornCeilingPerRoom });
  }

  // ===== SUBTOTAL =====
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

  // ===== MULTIPLIERS =====
  const multipliers: { label: string; factor: number }[] = [];

  // High-cost area
  if (ctx.isHighCostArea) {
    multipliers.push({ label: 'High-Cost Area Adjustment', factor: PRICING.multipliers.highCostZip });
  }

  // Commercial
  if (ctx.propertyType === 'commercial') {
    multipliers.push({ label: 'Commercial Property', factor: PRICING.multipliers.commercial });
  }

  // Furnished
  if (ctx.occupancy === 'furnished' || ctx.occupancy === 'occupied') {
    multipliers.push({ label: 'Furnished / Occupied', factor: PRICING.multipliers.furnished });
  }

  // Condition (exterior)
  if (ctx.exteriorCondition === 'poor') {
    multipliers.push({ label: 'Poor Exterior Condition', factor: PRICING.multipliers.poorCondition });
  } else if (ctx.exteriorCondition === 'fair') {
    multipliers.push({ label: 'Fair Exterior Condition', factor: PRICING.multipliers.fairCondition });
  }

  // Dramatic color change
  if (ctx.interiorColorChange === 'dramatic') {
    multipliers.push({ label: 'Dramatic Color Change', factor: PRICING.multipliers.dramaticColorChange });
  }

  // Prep-based multipliers
  if (ctx.prepWork.includes('drywall_repair')) {
    if (ctx.drywallRepairExtent === 'major') {
      multipliers.push({ label: 'Major Drywall Repair', factor: PRICING.multipliers.majorRepair });
    } else if (ctx.drywallRepairExtent === 'moderate') {
      multipliers.push({ label: 'Moderate Repairs', factor: PRICING.multipliers.minorRepair });
    }
  }
  if (ctx.prepWork.includes('wood_rot')) {
    if (ctx.woodRotExtent === 'major') {
      multipliers.push({ label: 'Major Wood Rot Repair', factor: PRICING.multipliers.majorRepair });
    } else if (ctx.woodRotExtent === 'moderate') {
      multipliers.push({ label: 'Moderate Wood Rot', factor: PRICING.multipliers.minorRepair });
    }
  }

  // Terse user padding
  if (ctx.responseStyle === 'terse') {
    multipliers.push({ label: 'Estimate Padding (fewer details)', factor: PRICING.multipliers.terseUserPadding });
  }

  // Apply multipliers
  const combinedMultiplier = multipliers.reduce((m, item) => m * item.factor, 1);
  const total = Math.round(subtotal * combinedMultiplier);

  // ===== CONFIDENCE =====
  const { confidence, confidenceNote, lowPct, highPct } = calculateConfidence(ctx);

  return {
    lineItems,
    subtotal: Math.round(subtotal),
    multipliers,
    total,
    lowRange: Math.round(total * (1 - lowPct)),
    highRange: Math.round(total * (1 + highPct)),
    confidence,
    confidenceNote,
  };
}

// ===== Running Estimate =====

export function getRunningEstimate(ctx: EstimatorContext): number | null {
  if (!ctx.squareFeet && !ctx.projectType) return null;
  const estimate = calculateEstimate(ctx);
  return estimate.total;
}

// ===== Format Currency =====

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ===== Helpers =====

function getRoomFraction(ctx: EstimatorContext): number {
  if (ctx.projectType === 'exterior') return 0;
  if (ctx.interiorScope === 'whole_house' || ctx.interiorScope === '') return 1;

  if (ctx.selectedRooms.length === 0) return 0.5;

  let fraction = 0;
  for (const room of ctx.selectedRooms) {
    fraction += PRICING.roomSqFtPercentages[room] || 0.05;
  }
  return Math.min(fraction, 1);
}

function estimateDoorCount(ctx: EstimatorContext): number {
  if (ctx.interiorDoors === 'all') return Math.round((ctx.squareFeet || 1500) / 200);
  if (ctx.interiorDoors === 'some') return 4;
  return 0;
}

function estimateWindowCount(ctx: EstimatorContext): number {
  return Math.round((ctx.squareFeet || 1500) / 150);
}

function calculateConfidence(ctx: EstimatorContext): {
  confidence: 'low' | 'medium' | 'high';
  confidenceNote: string;
  lowPct: number;
  highPct: number;
} {
  const q = ctx.answeredQuestions;

  if (q >= PRICING.confidence.high.minQuestions && ctx.responseStyle !== 'terse') {
    return {
      confidence: 'high',
      confidenceNote: 'High confidence - detailed information provided.',
      lowPct: PRICING.confidence.high.lowPct,
      highPct: PRICING.confidence.high.highPct,
    };
  }

  if (q >= PRICING.confidence.medium.minQuestions) {
    return {
      confidence: 'medium',
      confidenceNote: 'Medium confidence - a site visit will refine the estimate.',
      lowPct: PRICING.confidence.medium.lowPct,
      highPct: PRICING.confidence.medium.highPct,
    };
  }

  return {
    confidence: 'low',
    confidenceNote: 'Low confidence - limited details. Estimate padded for unknowns.',
    lowPct: PRICING.confidence.low.lowPct,
    highPct: PRICING.confidence.low.highPct,
  };
}
