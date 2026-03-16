import type { EstimatorContext, EstimateBreakdown, EstimateLineItem } from './types';
import { BASE_RATES, getRegionalMultiplier } from './marketPricingData';
import {
  STANDARD_ROOMS,
  CEILING_HEIGHTS,
  ITEM_SURFACE_AREAS,
  LABOR_COMPLEXITY,
  calculateExteriorSurface,
  estimateHouseLayout,
} from './surfaceAreaEngine';

// ===== Main Estimate Calculation =====

export function calculateEstimate(ctx: EstimatorContext): EstimateBreakdown {
  const lineItems: EstimateLineItem[] = [];
  const sqft = ctx.squareFeet || 1500;
  const { multiplier: regionalMult } = getRegionalMultiplier(ctx.zipCode);
  const ceilingHeight = CEILING_HEIGHTS[ctx.ceilingHeight] || 8;

  // Get room layout for surface area calculations
  const layout = getLayout(ctx, sqft);
  const roomFraction = getRoomFraction(ctx);

  // Base labor complexity from project qualifiers
  const conditionMultiplier = getConditionMultiplier(ctx);

  // ===== INTERIOR =====
  if (ctx.projectType === 'interior' || ctx.projectType === 'both') {
    const heightRatio = ceilingHeight / 8;
    const effectiveWallSqFt = Math.round(layout.totalWallSqFt * heightRatio * roomFraction);

    // Walls — rate varies by texture and condition
    if (ctx.interiorWalls !== 'no') {
      const wallRate = getWallRate(ctx);
      const textureMultiplier = ctx.wallTexture === 'heavy_texture' ? 1.15
        : ctx.wallTexture === 'textured' ? 1.05
        : 1.0;
      lineItems.push({
        category: 'Interior',
        description: 'Interior Walls',
        amount: effectiveWallSqFt * wallRate * textureMultiplier * regionalMult * conditionMultiplier,
      });
    }

    // Accent walls
    if (ctx.accentWalls === 'yes') {
      // ~15% of wall area is accent
      const accentSqFt = Math.round(effectiveWallSqFt * 0.15);
      lineItems.push({
        category: 'Interior',
        description: 'Accent Walls',
        amount: accentSqFt * BASE_RATES.specialty.accent_wall_per_sqft * regionalMult,
      });
    }

    // Ceilings
    if (ctx.interiorCeilings === 'yes') {
      const ceilingSqFt = Math.round(layout.totalCeilingSqFt * roomFraction);
      const ceilingRate = getCeilingRate(ctx);
      lineItems.push({
        category: 'Interior',
        description: 'Ceilings',
        amount: ceilingSqFt * ceilingRate * regionalMult,
      });
    }

    // Trim & Baseboards
    if (ctx.interiorTrim === 'yes') {
      const trimLinFt = Math.round(layout.totalTrimLinFt * roomFraction);
      const trimRate = getTrimRate(ctx);
      const trimCond = ctx.trimCondition || (ctx.projectCondition === 'new_construction' ? 'new' : 'existing_good');
      lineItems.push({
        category: 'Interior',
        description: 'Trim & Baseboards',
        amount: trimLinFt * trimRate * regionalMult * conditionMultiplier,
      });

      // New trim prep: caulking, nail holes, prime coat
      if (trimCond === 'new' || trimCond === 'mixed') {
        const newTrimFraction = trimCond === 'mixed' ? 0.5 : 1.0;
        const caulkFillLinFt = Math.round(trimLinFt * newTrimFraction);
        lineItems.push({
          category: 'Prep Work',
          description: `Trim Prep — Caulk & Fill Nail Holes (${caulkFillLinFt} lin ft)`,
          amount: caulkFillLinFt * (BASE_RATES.prep.caulking_per_linft + 0.50) * regionalMult,
        });
      }

      // Existing fair trim: sanding/degloss prep
      if (trimCond === 'existing_fair') {
        lineItems.push({
          category: 'Prep Work',
          description: 'Trim Prep — Sand & Degloss',
          amount: trimLinFt * ITEM_SURFACE_AREAS.trim.baseboard_3in.sqftPerLinFt * BASE_RATES.prep.sanding_degloss_per_sqft * regionalMult,
        });
      }
    }

    // Crown molding
    if (ctx.crownMolding === 'yes') {
      // Crown runs perimeter of rooms, ~80% of baseboard length
      const crownLinFt = Math.round(layout.totalTrimLinFt * roomFraction * 0.8);
      lineItems.push({
        category: 'Interior',
        description: 'Crown Molding',
        amount: crownLinFt * BASE_RATES.trim.crown_molding * regionalMult,
      });
    }

    // Wainscoting
    if (ctx.wainscoting === 'yes') {
      // Wainscoting: ~30% of wall area, lower 3ft
      const wainscotSqFt = Math.round(effectiveWallSqFt * 0.15);
      lineItems.push({
        category: 'Interior',
        description: 'Wainscoting / Paneling',
        amount: wainscotSqFt * BASE_RATES.trim.wainscoting_per_sqft * regionalMult,
      });
    }

    // Doors — material affects prep and rate
    if (ctx.interiorDoors !== 'none') {
      const doorCount = ctx.doorCount || Math.round(layout.totalDoors * roomFraction);
      const doorTypes = ctx.doorTypes.length > 0 ? ctx.doorTypes : ['standard'];
      // Metal/fiberglass doors: smoother surface, less prep, ~15% less labor
      // Wood doors: standard rate. Mixed: split the difference
      const materialFactor = ctx.doorMaterial === 'metal' || ctx.doorMaterial === 'fiberglass' ? 0.85
        : ctx.doorMaterial === 'mixed' ? 0.92
        : 1.0;
      let doorTotal = 0;

      for (const type of doorTypes) {
        const countForType = Math.ceil(doorCount / doorTypes.length);
        const rate = getDoorRate(type);
        doorTotal += countForType * rate;
      }

      lineItems.push({
        category: 'Interior',
        description: `Interior Doors (${doorCount})`,
        amount: doorTotal * materialFactor * regionalMult * conditionMultiplier,
      });

      // Door frames
      if (ctx.doorFrames === 'yes') {
        lineItems.push({
          category: 'Interior',
          description: 'Door Frames & Casings',
          amount: doorCount * BASE_RATES.doors.door_frame * regionalMult,
        });
      }
    }

    // Windows
    if (ctx.interiorWindows !== 'none') {
      const winCount = ctx.windowCount || Math.round(layout.totalWindows * roomFraction);
      const winTypes = ctx.windowTypes.length > 0 ? ctx.windowTypes : ['single'];
      let winTotal = 0;

      for (const type of winTypes) {
        const countForType = Math.ceil(winCount / winTypes.length);
        const rate = getWindowRate(type);
        winTotal += countForType * rate;
      }

      lineItems.push({
        category: 'Interior',
        description: `Window Frames/Sills (${winCount})`,
        amount: winTotal * regionalMult,
      });
    }

    // Cabinets — scope (fronts vs inside too) and stained wood affects pricing
    if (ctx.cabinets !== 'none') {
      const locations = ctx.cabinetLocations.length > 0 ? ctx.cabinetLocations : ['kitchen'];
      const cabinetComplexity = ctx.hasStainedWood === 'yes' ? LABOR_COMPLEXITY.cabinet_refinish : 1.0;
      // Painting inside cabinets adds 40-60% (more surfaces, tighter access, more coats)
      const scopeMultiplier = ctx.cabinetScope === 'inside_too' ? 1.50 : 1.0;
      for (const loc of locations) {
        const rate = getCabinetRate(loc, sqft);
        const desc = ctx.cabinetScope === 'inside_too'
          ? `${capitalize(loc)} Cabinets (inside + out)`
          : `${capitalize(loc)} Cabinets`;
        lineItems.push({
          category: 'Interior',
          description: desc,
          amount: rate * scopeMultiplier * regionalMult * cabinetComplexity,
        });
      }
    }

    // Closets — shelving level affects pricing
    if (ctx.closets !== 'none') {
      const closetCount = ctx.closetCount || Math.round(layout.totalClosets * roomFraction) || 2;
      // Shelving add-on per closet
      const shelvingAdd = ctx.closetShelving === 'extensive' ? 250
        : ctx.closetShelving === 'built_in' ? 150
        : ctx.closetShelving === 'wire' ? 35 // just masking cost
        : 0;

      if (ctx.closets === 'standard') {
        lineItems.push({
          category: 'Interior',
          description: `Closets (${closetCount})${shelvingAdd ? ' + shelving' : ''}`,
          amount: closetCount * (BASE_RATES.closets.standard + shelvingAdd) * regionalMult,
        });
      } else if (ctx.closets === 'walkin') {
        lineItems.push({
          category: 'Interior',
          description: `Walk-in Closets (${closetCount})${shelvingAdd ? ' + shelving' : ''}`,
          amount: closetCount * (BASE_RATES.closets.walkin_small + shelvingAdd * 1.5) * regionalMult,
        });
      } else if (ctx.closets === 'both') {
        const half = Math.ceil(closetCount / 2);
        lineItems.push({
          category: 'Interior',
          description: `Standard Closets (${half})${shelvingAdd ? ' + shelving' : ''}`,
          amount: half * (BASE_RATES.closets.standard + shelvingAdd) * regionalMult,
        });
        lineItems.push({
          category: 'Interior',
          description: `Walk-in Closets (${closetCount - half})${shelvingAdd ? ' + shelving' : ''}`,
          amount: (closetCount - half) * (BASE_RATES.closets.walkin_small + shelvingAdd * 1.5) * regionalMult,
        });
      }
    }

    // Stairways — railing material affects pricing (wrought iron is very labor-intensive)
    if (ctx.stairways === 'yes') {
      const stairCount = ctx.stairwayCount || 1;
      let stairTotal = 0;
      // Wrought iron railings: intricate detail work, ~40% more labor
      const railingMaterialFactor = ctx.interiorRailingMaterial === 'wrought_iron' ? 1.4
        : ctx.interiorRailingMaterial === 'metal' ? 1.1
        : 1.0;

      if (ctx.stairwayDetails === 'walls_only' || !ctx.stairwayDetails) {
        stairTotal = stairCount * BASE_RATES.stairs.walls_one_flight;
      } else if (ctx.stairwayDetails === 'walls_and_railings') {
        const railingCost = BASE_RATES.stairs.railing_simple_per_ft * 12 * railingMaterialFactor;
        stairTotal = stairCount * (BASE_RATES.stairs.walls_one_flight + railingCost);
      } else if (ctx.stairwayDetails === 'full') {
        const railingCost = BASE_RATES.stairs.railing_spindles_per_ft * 12 * railingMaterialFactor;
        stairTotal = stairCount * (
          BASE_RATES.stairs.walls_one_flight +
          railingCost +
          BASE_RATES.stairs.risers_per_step * 13 +
          BASE_RATES.stairs.stringers_per_flight
        );
      }

      lineItems.push({
        category: 'Interior',
        description: `Stairways (${stairCount})${ctx.interiorRailingMaterial === 'wrought_iron' ? ' — wrought iron detail' : ''}`,
        amount: stairTotal * regionalMult,
      });
    }

    // Interior shutters
    if (ctx.interiorShutters === 'yes') {
      const shutterCount = Math.round(layout.totalWindows * roomFraction * 0.5) || 6;
      lineItems.push({
        category: 'Interior',
        description: `Interior Shutters (~${shutterCount})`,
        amount: shutterCount * BASE_RATES.specialty.shutter_interior * regionalMult,
      });
    }

    // ===== SPECIALTY SERVICES =====

    // Fireplace
    if (ctx.specialtyServices.includes('fireplace')) {
      const fpCount = ctx.fireplaceCount || 1;
      let fpRate = BASE_RATES.specialty.fireplace_full;
      switch (ctx.fireplaceType) {
        case 'brick_paint': fpRate = BASE_RATES.specialty.fireplace_brick_paint; break;
        case 'brick_whitewash': fpRate = BASE_RATES.specialty.fireplace_brick_whitewash; break;
        case 'stone': fpRate = BASE_RATES.specialty.fireplace_stone; break;
        case 'mantel_only': fpRate = BASE_RATES.specialty.fireplace_mantel; break;
        case 'full': fpRate = BASE_RATES.specialty.fireplace_full; break;
      }
      lineItems.push({
        category: 'Specialty',
        description: `Fireplace (${ctx.fireplaceType || 'full'})`,
        amount: fpCount * fpRate * regionalMult,
      });
    }

    // Exposed Beams
    if (ctx.specialtyServices.includes('beams')) {
      const beamFt = ctx.beamLinearFeet || 40;
      const beamRate = ctx.beamLocation === 'vaulted'
        ? BASE_RATES.specialty.beam_per_linft_vaulted
        : BASE_RATES.specialty.beam_per_linft;
      lineItems.push({
        category: 'Specialty',
        description: `Exposed Beams (${beamFt} lin ft)`,
        amount: beamFt * beamRate * regionalMult,
      });
    }

    // Built-ins
    if (ctx.specialtyServices.includes('built_ins')) {
      const count = ctx.builtInCount || 2;
      lineItems.push({
        category: 'Specialty',
        description: `Built-in Shelving/Bookcases (${count})`,
        amount: count * BASE_RATES.specialty.bookcase_small * regionalMult,
      });
    }

    // Epoxy Floor
    if (ctx.specialtyServices.includes('epoxy')) {
      const garageSqft = ctx.epoxyGarageSqft || Math.round(sqft * 0.15);
      const epoxyRate = ctx.epoxyType === 'full_system'
        ? BASE_RATES.specialty.epoxy_garage_per_sqft
        : BASE_RATES.specialty.epoxy_garage_basic_per_sqft;
      lineItems.push({
        category: 'Specialty',
        description: `Epoxy Garage Floor (${garageSqft} sqft)`,
        amount: garageSqft * epoxyRate * regionalMult,
      });
    }

    // Furniture
    if (ctx.specialtyServices.includes('furniture') && ctx.furnitureItems.length > 0) {
      let furnitureTotal = 0;
      for (const item of ctx.furnitureItems) {
        const key = `furniture_${item}` as keyof typeof BASE_RATES.specialty;
        const rate = BASE_RATES.specialty[key] || BASE_RATES.specialty.furniture_cabinet;
        furnitureTotal += typeof rate === 'number' ? rate : 175;
      }
      lineItems.push({
        category: 'Specialty',
        description: `Furniture Painting (${ctx.furnitureItems.length} pieces)`,
        amount: furnitureTotal * regionalMult,
      });
    }

    // Brick/Stone (interior)
    if (ctx.specialtyServices.includes('brick')) {
      const brickSqft = ctx.brickSqft || 100;
      const brickRate = ctx.brickTreatment === 'whitewash'
        ? BASE_RATES.specialty.whitewash_brick_per_sqft
        : BASE_RATES.specialty.paint_brick_per_sqft;
      lineItems.push({
        category: 'Specialty',
        description: `${ctx.brickTreatment === 'whitewash' ? 'Whitewash' : 'Paint'} Brick/Stone (${brickSqft} sqft)`,
        amount: brickSqft * brickRate * regionalMult,
      });
    }

    // Color change surcharge
    if (ctx.interiorColorChange === 'different') {
      const extraCoatSqFt = effectiveWallSqFt * 0.3; // ~30% surcharge for extra coat
      lineItems.push({
        category: 'Interior',
        description: 'Color Change (extra coat)',
        amount: extraCoatSqFt * BASE_RATES.interior.walls_repaint * regionalMult,
      });
    }
  }

  // ===== EXTERIOR =====
  if (ctx.projectType === 'exterior' || ctx.projectType === 'both') {
    const extSurface = calculateExteriorSurface(sqft, ctx.stories || 1, ctx.sidingType);

    // Siding / body
    const sidingRate = getSidingRate(ctx.sidingType);
    const extWallArea = ctx.exteriorScope === 'partial'
      ? Math.round(extSurface.wallSqFt * 0.5)
      : extSurface.wallSqFt;
    lineItems.push({
      category: 'Exterior',
      description: 'Exterior Body / Siding',
      amount: extWallArea * sidingRate * regionalMult * conditionMultiplier,
    });

    // Stucco condition add-ons
    if (ctx.stuccoCondition === 'new_stucco') {
      // New stucco needs primer/sealer before paint
      lineItems.push({
        category: 'Prep Work',
        description: 'New Stucco Primer/Sealer',
        amount: extWallArea * BASE_RATES.prep.prime_new_drywall_per_sqft * 1.2 * regionalMult,
      });
    } else if (ctx.stuccoCondition === 'needs_repair') {
      // Stucco patching/repair
      lineItems.push({
        category: 'Prep Work',
        description: 'Stucco Repair & Patching',
        amount: extWallArea * BASE_RATES.prep.texture_repair_per_sqft * 0.15 * regionalMult, // ~15% of wall needs patching
      });
    }

    // Trim/fascia
    if (ctx.exteriorTrim === 'yes') {
      lineItems.push({
        category: 'Exterior',
        description: 'Exterior Trim & Fascia',
        amount: extSurface.trimLinFt * BASE_RATES.exterior.fascia_per_linft * regionalMult,
      });
    }

    // Soffits/eaves
    if (ctx.soffitsEaves === 'yes') {
      lineItems.push({
        category: 'Exterior',
        description: 'Soffits & Eaves',
        amount: extSurface.soffitSqFt * BASE_RATES.exterior.soffit_per_sqft * regionalMult,
      });
    }

    // Shutters
    if (ctx.exteriorShutters === 'yes') {
      const shutterCount = ctx.exteriorShutterCount || 8;
      lineItems.push({
        category: 'Exterior',
        description: `Exterior Shutters (${shutterCount})`,
        amount: shutterCount * BASE_RATES.specialty.shutter_exterior * regionalMult,
      });
    }

    // Garage door
    if (ctx.garageDoor === 'single') {
      lineItems.push({ category: 'Exterior', description: 'Garage Door (Single)', amount: BASE_RATES.doors.garage_single * regionalMult });
    } else if (ctx.garageDoor === 'double') {
      lineItems.push({ category: 'Exterior', description: 'Garage Door (Double)', amount: BASE_RATES.doors.garage_double * regionalMult });
    }

    // Entry door
    if (ctx.entryDoor === 'yes') {
      lineItems.push({ category: 'Exterior', description: 'Entry Door', amount: BASE_RATES.doors.entry_door * regionalMult });
    }

    // Railings — material drives prep (metal needs rust treatment + primer)
    if (ctx.railings === 'yes') {
      const railingFt = Math.round(Math.sqrt(sqft / (ctx.stories || 1)) * 0.3) || 20;
      // Metal railings need rust treatment, ~20% more expensive than wood
      // Composite/vinyl railings are cheaper (less prep)
      const materialMult = ctx.exteriorRailingMaterial === 'metal' ? 1.20
        : ctx.exteriorRailingMaterial === 'composite' ? 0.80
        : ctx.exteriorRailingMaterial === 'cable' ? 0.60 // just paint the posts
        : 1.0;

      switch (ctx.railingType) {
        case 'simple':
          lineItems.push({
            category: 'Exterior',
            description: `Railings (Simple${ctx.exteriorRailingMaterial === 'metal' ? ', metal' : ''})`,
            amount: railingFt * BASE_RATES.exterior.railing_simple_per_linft * materialMult * regionalMult,
          });
          break;
        case 'spindles':
          lineItems.push({
            category: 'Exterior',
            description: `Railings (Spindles${ctx.exteriorRailingMaterial === 'metal' ? ', metal' : ''})`,
            amount: railingFt * BASE_RATES.exterior.railing_spindle_per_linft * materialMult * regionalMult,
          });
          break;
        case 'both':
          lineItems.push({
            category: 'Exterior',
            description: 'Railings (Multiple Types)',
            amount: railingFt * (BASE_RATES.exterior.railing_simple_per_linft + BASE_RATES.exterior.railing_spindle_per_linft) / 2 * materialMult * regionalMult,
          });
          break;
        default:
          lineItems.push({
            category: 'Exterior',
            description: 'Railings',
            amount: railingFt * BASE_RATES.exterior.railing_simple_per_linft * materialMult * regionalMult,
          });
      }
    }

    // Balconies
    if (ctx.balconies === 'yes') {
      const balcCount = ctx.balconyCount || 1;
      // Balcony: ~60 sqft deck + ~20 lin ft railing
      const balcAmount = balcCount * (60 * BASE_RATES.exterior.deck_paint_per_sqft + 20 * BASE_RATES.exterior.railing_simple_per_linft);
      lineItems.push({ category: 'Exterior', description: `Balconies (${balcCount})`, amount: balcAmount * regionalMult });
    }

    // Deck
    if (ctx.deck === 'yes') {
      const deckSizes = { small: 100, medium: 250, large: 450 };
      const deckSqft = deckSizes[ctx.deckSize as keyof typeof deckSizes] || deckSizes.medium;
      lineItems.push({
        category: 'Exterior',
        description: 'Deck',
        amount: deckSqft * BASE_RATES.exterior.deck_stain_per_sqft * regionalMult,
      });
    }

    // Fence
    if (ctx.fence === 'yes') {
      const fenceFt = ctx.fenceLinearFeet || 100;
      lineItems.push({
        category: 'Exterior',
        description: `Fence (${fenceFt} ft)`,
        amount: fenceFt * BASE_RATES.exterior.fence_per_linft_6ft * regionalMult,
      });
    }

    // Gutters
    if (ctx.gutters === 'yes') {
      lineItems.push({
        category: 'Exterior',
        description: 'Gutters & Downspouts',
        amount: extSurface.gutterLinFt * BASE_RATES.exterior.gutter_per_linft * regionalMult,
      });
    }

    // Foundation
    if (ctx.foundation === 'yes') {
      const perimeterFt = Math.round(Math.sqrt(sqft / (ctx.stories || 1)) * 4);
      lineItems.push({
        category: 'Exterior',
        description: 'Foundation Walls',
        amount: perimeterFt * BASE_RATES.exterior.foundation_per_linft * regionalMult,
      });
    }

    // Exterior windows
    if (ctx.exteriorWindows !== 'none') {
      const extWinCount = ctx.exteriorWindowCount || extSurface.windowTrimCount;
      lineItems.push({
        category: 'Exterior',
        description: `Exterior Window Trim (${extWinCount})`,
        amount: extWinCount * BASE_RATES.exterior.window_trim_each * regionalMult,
      });
    }

    // Overhangs
    if (ctx.overhangs === 'yes') {
      const overhangSqFt = Math.round(Math.sqrt(sqft / (ctx.stories || 1)) * 4 * 3); // perimeter * 3ft depth
      lineItems.push({
        category: 'Exterior',
        description: 'Overhangs / Patio Covers',
        amount: overhangSqFt * BASE_RATES.exterior.overhang_per_sqft * regionalMult,
      });
    }

    // Multi-story access
    if ((ctx.stories || 1) > 1) {
      const extraStories = (ctx.stories || 1) - 1;
      const storyPremium = extraStories === 1
        ? LABOR_COMPLEXITY.second_story_exterior
        : LABOR_COMPLEXITY.third_story_exterior;
      // Access premium on the exterior wall area
      const accessSurcharge = extWallArea * sidingRate * regionalMult * (storyPremium - 1);
      lineItems.push({
        category: 'Exterior',
        description: `Multi-story Access (${ctx.stories} stories)`,
        amount: accessSurcharge,
      });
    }

    // Access restrictions
    if (ctx.accessRestrictions === 'some' || ctx.accessRestrictions === 'significant') {
      const factor = ctx.accessRestrictions === 'significant' ? 0.15 : 0.07;
      lineItems.push({
        category: 'Exterior',
        description: 'Access Restriction Surcharge',
        amount: extWallArea * sidingRate * regionalMult * factor,
      });
    }

    // Exterior color change
    if (ctx.exteriorColorChange === 'different') {
      const extraCoat = extWallArea * sidingRate * regionalMult * (LABOR_COMPLEXITY.different_color - 1);
      lineItems.push({
        category: 'Exterior',
        description: 'Exterior Color Change',
        amount: extraCoat,
      });
    }
  }

  // ===== PREP WORK =====
  if (ctx.prepWork.includes('power_washing')) {
    const pwSqft = ctx.projectType === 'interior' ? 0 : sqft;
    const pwAmount = Math.max(pwSqft * BASE_RATES.prep.power_washing, BASE_RATES.prep.power_washing_minimum);
    lineItems.push({ category: 'Prep Work', description: 'Power Washing', amount: pwAmount * regionalMult });
  }
  if (ctx.prepWork.includes('lead_test')) {
    lineItems.push({ category: 'Prep Work', description: 'Lead Paint Testing', amount: BASE_RATES.prep.lead_paint_test * regionalMult });
  }
  if (ctx.prepWork.includes('wallpaper_removal')) {
    const rooms = ctx.wallpaperRooms || 1;
    // Average room ~300 sqft of wall
    const wpSqft = rooms * 300;
    lineItems.push({
      category: 'Prep Work',
      description: `Wallpaper Removal (${rooms} rooms)`,
      amount: wpSqft * BASE_RATES.prep.wallpaper_removal_per_sqft * regionalMult,
    });
  }
  if (ctx.prepWork.includes('popcorn_removal')) {
    const rooms = ctx.popcornCeilingRooms || 1;
    // Average room ~150 sqft of ceiling
    const pcSqft = rooms * 150;
    lineItems.push({
      category: 'Prep Work',
      description: `Popcorn Ceiling Removal (${rooms} rooms)`,
      amount: pcSqft * BASE_RATES.prep.popcorn_removal_per_sqft * regionalMult,
    });
  }
  if (ctx.prepWork.includes('stain_cover') || ctx.hasStainedWood === 'yes') {
    // Stained wood prep: degloss + prime on trim/doors
    const stainedLinFt = Math.round(layout.totalTrimLinFt * roomFraction * 0.5);
    if (stainedLinFt > 0) {
      lineItems.push({
        category: 'Prep Work',
        description: 'Stained Wood Prep (degloss + prime)',
        amount: stainedLinFt * ITEM_SURFACE_AREAS.trim.baseboard_3in.sqftPerLinFt * BASE_RATES.prep.prime_stained_wood_per_sqft * regionalMult,
      });
    }
  }
  if (ctx.projectCondition === 'new_construction') {
    // New drywall priming
    const primeSqFt = Math.round(layout.totalWallSqFt * roomFraction + layout.totalCeilingSqFt * roomFraction);
    if (primeSqFt > 0) {
      lineItems.push({
        category: 'Prep Work',
        description: 'New Drywall Prime Coat',
        amount: primeSqFt * BASE_RATES.prep.prime_new_drywall_per_sqft * regionalMult,
      });
    }
  }

  // ===== SUBTOTAL =====
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

  // ===== MULTIPLIERS =====
  const multipliers: { label: string; factor: number }[] = [];

  // Commercial
  if (ctx.propertyType === 'commercial') {
    multipliers.push({ label: 'Commercial Property', factor: 1.10 });
  }

  // Furnished/occupied
  if (ctx.occupancy === 'furnished' || ctx.occupancy === 'occupied') {
    multipliers.push({ label: 'Furnished / Occupied', factor: LABOR_COMPLEXITY.repaint_fair });
  }

  // Exterior condition (if not already handled via conditionMultiplier in line items)
  if (ctx.exteriorCondition === 'poor') {
    multipliers.push({ label: 'Poor Exterior Condition', factor: 1.20 });
  } else if (ctx.exteriorCondition === 'fair') {
    multipliers.push({ label: 'Fair Exterior Condition', factor: 1.08 });
  }

  // Dramatic color change
  if (ctx.interiorColorChange === 'dramatic') {
    multipliers.push({ label: 'Dramatic Color Change', factor: LABOR_COMPLEXITY.dramatic_change });
  }

  // Prep-based multipliers
  if (ctx.prepWork.includes('drywall_repair')) {
    if (ctx.drywallRepairExtent === 'major') {
      multipliers.push({ label: 'Major Drywall Repair', factor: 1.25 });
    } else if (ctx.drywallRepairExtent === 'moderate') {
      multipliers.push({ label: 'Moderate Repairs', factor: 1.12 });
    }
  }
  if (ctx.prepWork.includes('wood_rot')) {
    if (ctx.woodRotExtent === 'major') {
      multipliers.push({ label: 'Major Wood Rot Repair', factor: 1.25 });
    } else if (ctx.woodRotExtent === 'moderate') {
      multipliers.push({ label: 'Moderate Wood Rot', factor: 1.12 });
    }
  }

  // Terse user padding
  if (ctx.responseStyle === 'terse') {
    multipliers.push({ label: 'Estimate Padding (fewer details)', factor: 1.10 });
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

// ===== Helper Functions =====

function getLayout(ctx: EstimatorContext, sqft: number) {
  if (ctx.interiorScope === 'specific_rooms' && ctx.selectedRooms.length > 0) {
    // Use actual room specs for selected rooms
    let totalWall = 0, totalCeiling = 0, totalTrim = 0, totalDoors = 0, totalWindows = 0, totalClosets = 0;
    for (const room of ctx.selectedRooms) {
      const spec = STANDARD_ROOMS[room];
      if (spec) {
        totalWall += spec.wallSqFt;
        totalCeiling += spec.ceilingSqFt;
        totalTrim += spec.trimLinearFt;
        totalDoors += spec.doors;
        totalWindows += spec.windows;
        totalClosets += spec.closets;
      }
    }
    return {
      rooms: ctx.selectedRooms,
      totalWallSqFt: totalWall,
      totalCeilingSqFt: totalCeiling,
      totalTrimLinFt: totalTrim,
      totalDoors,
      totalWindows,
      totalClosets,
    };
  }

  // Whole house — estimate layout from sqft and bedroom count
  return estimateHouseLayout(sqft, ctx.bedroomCount || undefined);
}

function getRoomFraction(ctx: EstimatorContext): number {
  if (ctx.projectType === 'exterior') return 0;
  if (ctx.interiorScope === 'whole_house' || ctx.interiorScope === '') return 1;
  // When specific rooms are selected, getLayout already filters to those rooms
  return 1;
}

function getWallRate(ctx: EstimatorContext): number {
  if (ctx.projectCondition === 'new_construction') return BASE_RATES.interior.walls_new_drywall;
  if (ctx.ceilingType === 'popcorn' || ctx.ceilingType === 'mixed') return BASE_RATES.interior.walls_textured;
  return BASE_RATES.interior.walls_repaint;
}

function getCeilingRate(ctx: EstimatorContext): number {
  switch (ctx.ceilingType) {
    case 'vaulted': return BASE_RATES.interior.ceilings_vaulted;
    case 'popcorn': return BASE_RATES.interior.ceilings_popcorn_paint;
    case 'mixed': return BASE_RATES.interior.ceilings_textured;
    default: return BASE_RATES.interior.ceilings_flat;
  }
}

function getTrimRate(ctx: EstimatorContext): number {
  if (ctx.hasStainedWood === 'yes') return BASE_RATES.trim.baseboard_detailed;
  return BASE_RATES.trim.baseboard_simple;
}

function getDoorRate(type: string): number {
  switch (type) {
    case 'french': return BASE_RATES.doors.interior_french;
    case 'closet': return BASE_RATES.doors.closet_bifold;
    case 'pocket': return BASE_RATES.doors.pocket;
    default: return BASE_RATES.doors.interior_standard;
  }
}

function getWindowRate(type: string): number {
  switch (type) {
    case 'double_hung': return BASE_RATES.windows.frame_sill_double_hung;
    case 'french_pane': return BASE_RATES.windows.french_pane;
    case 'bay': return BASE_RATES.windows.bay_window;
    default: return BASE_RATES.windows.frame_sill_simple;
  }
}

function getCabinetRate(location: string, sqft: number): number {
  switch (location) {
    case 'kitchen':
      if (sqft < 1200) return BASE_RATES.cabinets.kitchen_small;
      if (sqft < 2500) return BASE_RATES.cabinets.kitchen_medium;
      return BASE_RATES.cabinets.kitchen_large;
    case 'bathroom': return BASE_RATES.cabinets.bathroom_vanity;
    case 'laundry': return BASE_RATES.cabinets.laundry;
    default: return BASE_RATES.cabinets.kitchen_medium;
  }
}

function getSidingRate(sidingType: string): number {
  switch (sidingType) {
    case 'stucco': return BASE_RATES.exterior.siding_stucco;
    case 'wood': return BASE_RATES.exterior.siding_wood;
    case 'hardie': return BASE_RATES.exterior.siding_hardie;
    case 'vinyl': return BASE_RATES.exterior.siding_vinyl;
    case 'brick': return BASE_RATES.exterior.siding_brick;
    case 'stone': return BASE_RATES.exterior.siding_stone;
    case 'mixed': return (BASE_RATES.exterior.siding_stucco + BASE_RATES.exterior.siding_wood) / 2;
    default: return BASE_RATES.exterior.siding_stucco;
  }
}

function getConditionMultiplier(ctx: EstimatorContext): number {
  if (ctx.projectCondition === 'new_construction') return LABOR_COMPLEXITY.new_drywall;
  if (ctx.hasStainedWood === 'yes') return LABOR_COMPLEXITY.stained_wood_to_paint;
  if (ctx.projectCondition === 'renovation') return LABOR_COMPLEXITY.repaint_fair;
  return LABOR_COMPLEXITY.repaint_good;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function calculateConfidence(ctx: EstimatorContext): {
  confidence: 'low' | 'medium' | 'high';
  confidenceNote: string;
  lowPct: number;
  highPct: number;
} {
  const q = ctx.answeredQuestions;

  if (q >= 12 && ctx.responseStyle !== 'terse') {
    return {
      confidence: 'high',
      confidenceNote: 'High confidence - detailed information provided.',
      lowPct: 0.08,
      highPct: 0.08,
    };
  }

  if (q >= 6) {
    return {
      confidence: 'medium',
      confidenceNote: 'Medium confidence - a site visit will refine the estimate.',
      lowPct: 0.15,
      highPct: 0.15,
    };
  }

  return {
    confidence: 'low',
    confidenceNote: 'Low confidence - limited details. Estimate padded for unknowns.',
    lowPct: 0.25,
    highPct: 0.30,
  };
}
