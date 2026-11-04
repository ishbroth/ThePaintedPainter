const fs = require('fs');

function patch(file, edits) {
  const CR = String.fromCharCode(13);
  const LF = String.fromCharCode(10);
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes(CR + LF);
  let t = raw.split(CR + LF).join(LF);
  for (const [from, to, label] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + (label || from.slice(0, 70)));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split(LF).join(CR + LF) : t);
}


// ---------------------------------------------------------------- estimateEngine
patch('src/lib/estimateEngine.ts', [
  // imports
  ["import { RESOLVED_BASE_RATES as BASE_RATES } from './pricing/resolvedBaseRates';",
    "import { RESOLVED_BASE_RATES as BASE_RATES, MIN_JOB_CHARGE } from './pricing/resolvedBaseRates';"],

  // setup: exclusions, layouts, volume efficiency
  [`  // Get room layout for surface area calculations
  const layout = getLayout(ctx, sqft);
  const roomFraction = getRoomFraction(ctx);`,
    `  // Main items and rooms the customer took off the price after seeing it (price editing).
  const off = (key: string) => ctx.excludedItems.includes(key);

  // Get room layout for surface area calculations
  const layout = getLayout(ctx, sqft);
  const fullLayout = ctx.excludedRooms.length > 0 ? getLayout({ ...ctx, excludedRooms: [] }, sqft) : layout;
  const roomFraction = getRoomFraction(ctx);
  // Share of the whole home's trim that's still in scope — scales a customer-given linear-foot figure when rooms come off.
  const trimShare = fullLayout.totalTrimLinFt > 0 ? layout.totalTrimLinFt / fullLayout.totalTrimLinFt : 1;`],

  // walls
  [`    const effectiveWallSqFt = Math.round(layout.totalWallSqFt * heightRatio * roomFraction);

    // Walls — rate varies by texture and condition
    if (ctx.interiorWalls !== 'no') {`,
    `    const effectiveWallSqFt = Math.round(layout.totalWallSqFt * heightRatio * roomFraction);
    // Bigger scopes are cheaper per square foot (one mobilization, bulk paint, crew stays productive). Painting
    // a few rooms gets none of that, and neither does a job a customer trims down after seeing the price.
    const volEff = volumeEfficiency(effectiveWallSqFt);
    volumeEfficiencyUsed = volEff;

    // Walls — rate varies by texture and condition
    if (ctx.interiorWalls !== 'no' && !off('walls')) {`],
  ["        amount: effectiveWallSqFt * wallRate * textureMultiplier * colorEfficiency * regionalMult * conditionMultiplier,\n      });",
    "        amount: effectiveWallSqFt * wallRate * textureMultiplier * colorEfficiency * regionalMult * conditionMultiplier * volEff,\n        key: 'walls',\n      });"],

  // accent walls
  [`    if (ctx.accentWalls === 'yes') {
      // ~15% of wall area is accent
      const accentSqFt = Math.round(effectiveWallSqFt * 0.15);
      lineItems.push({
        category: 'Interior',
        description: 'Accent Walls',
        amount: accentSqFt * BASE_RATES.specialty.accent_wall_per_sqft * regionalMult,
      });
    }`,
    `    if (ctx.accentWalls === 'yes' && !off('accent_walls')) {
      // One accent wall is about 130 sq ft (a 13 ft wall at 10 ft with openings out). A bare "accent walls"
      // with no count is one per bedroom-sized space, never more than 15% of all the wall area.
      const count = ctx.accentWallCount || 1;
      const accentSqFt = Math.min(Math.round(effectiveWallSqFt * 0.15), count * 130);
      lineItems.push({
        category: 'Interior',
        description: count > 1 ? \`Accent Walls (\${count})\` : 'Accent Wall',
        // a separate color means its own setup and extra cut-in along the neighbouring walls
        amount: Math.max(accentSqFt * BASE_RATES.specialty.accent_wall_per_sqft, count * 90) * regionalMult,
        key: 'accent_walls',
      });
    }`],

  // ceilings
  [`    if (ctx.interiorCeilings === 'yes') {
      const ceilingSqFt = Math.round(layout.totalCeilingSqFt * roomFraction);
      const ceilingRate = getCeilingRate(ctx);
      lineItems.push({
        category: 'Interior',
        description: 'Ceilings',
        amount: ceilingSqFt * ceilingRate * regionalMult,
      });
    }`,
    `    if (ctx.interiorCeilings === 'yes' && !off('ceilings')) {
      const ceilingSqFt = Math.round(layout.totalCeilingSqFt * roomFraction);
      const ceilingRate = getCeilingRate(ctx);
      lineItems.push({
        category: 'Interior',
        description: 'Ceilings',
        amount: ceilingSqFt * ceilingRate * regionalMult * volEff,
        key: 'ceilings',
      });
    }`],

  // trim
  [`    if (ctx.interiorTrim === 'yes') {
      const trimLinFt = Math.round(layout.totalTrimLinFt * roomFraction);`,
    `    if (ctx.interiorTrim === 'yes' && !off('trim')) {
      const trimLinFt = ctx.trimLinearFeet ? Math.round(ctx.trimLinearFeet * trimShare) : Math.round(layout.totalTrimLinFt * roomFraction);`],
  ["        description: 'Trim & Baseboards',\n        amount: trimLinFt * trimRate * regionalMult * conditionMultiplier,\n      });",
    "        description: ctx.trimLinearFeet ? `Trim & Baseboards (${trimLinFt} lin ft)` : 'Trim & Baseboards',\n        amount: trimLinFt * trimRate * regionalMult * conditionMultiplier * volEff,\n        key: 'trim',\n      });"],

  // crown
  [`    if (ctx.crownMolding === 'yes') {
      // Crown runs perimeter of rooms, ~80% of baseboard length
      const crownLinFt = Math.round(layout.totalTrimLinFt * roomFraction * 0.8);
      lineItems.push({
        category: 'Interior',
        description: 'Crown Molding',
        amount: crownLinFt * BASE_RATES.trim.crown_molding * regionalMult,
      });
    }`,
    `    if (ctx.crownMolding === 'yes' && !off('crown')) {
      // Crown runs perimeter of rooms, ~80% of baseboard length (unless the customer gave the footage)
      const crownLinFt = ctx.crownLinearFeet ? Math.round(ctx.crownLinearFeet * trimShare) : Math.round(layout.totalTrimLinFt * roomFraction * 0.8);
      lineItems.push({
        category: 'Interior',
        description: ctx.crownLinearFeet ? \`Crown Molding (\${crownLinFt} lin ft)\` : 'Crown Molding',
        amount: crownLinFt * BASE_RATES.trim.crown_molding * regionalMult,
        key: 'crown',
      });
    }`],

  // wainscoting
  [`    if (ctx.wainscoting === 'yes') {`, `    if (ctx.wainscoting === 'yes' && !off('wainscoting')) {`],
  ["        amount: wainscotSqFt * BASE_RATES.trim.wainscoting_per_sqft * regionalMult,\n      });",
    "        amount: wainscotSqFt * BASE_RATES.trim.wainscoting_per_sqft * regionalMult,\n        key: 'wainscoting',\n      });"],

  // doors
  ["    if (ctx.interiorDoors !== 'none') {\n      const doorCount",
    "    if (ctx.interiorDoors !== 'none' && !off('doors')) {\n      const doorCount"],
  ["        amount: doorTotal * materialFactor * regionalMult * conditionMultiplier,\n      });",
    "        amount: doorTotal * materialFactor * regionalMult * conditionMultiplier * volEff,\n        key: 'doors',\n      });"],
  ["          amount: doorCount * BASE_RATES.doors.door_frame * regionalMult,\n        });",
    "          amount: doorCount * BASE_RATES.doors.door_frame * regionalMult,\n          key: 'door_frames',\n        });"],

  // windows
  ["    if (ctx.interiorWindows !== 'none') {", "    if (ctx.interiorWindows !== 'none' && !off('windows')) {"],
  ["        amount: winTotal * regionalMult,\n      });", "        amount: winTotal * regionalMult * volEff,\n        key: 'windows',\n      });"],

  // cabinets
  [`    if (ctx.cabinets !== 'none') {
      const locations = ctx.cabinetLocations.length > 0 ? ctx.cabinetLocations : ['kitchen'];`,
    `    if (ctx.cabinets !== 'none') {
      // "bathroom"/"laundry" cabinets with no location list are that room's cabinets, not a kitchen.
      const inferred = ctx.cabinets === 'bathroom' || ctx.cabinets === 'laundry' ? [ctx.cabinets] : ['kitchen'];
      const locations = (ctx.cabinetLocations.length > 0 ? ctx.cabinetLocations : inferred).filter((l) => !off(\`cabinets:\${l}\`));`],
  [`        const rate = getCabinetRate(loc, sqft);`,
    `        // a customer-given door/drawer count prices the kitchen by the piece ($70-125 a door, drawer fronts about
        // half) plus the fixed removal, degloss and masking time; otherwise by kitchen size
        const rate = loc === 'kitchen' && ctx.cabinetDoorCount
          ? ctx.cabinetDoorCount * BASE_RATES.cabinets.per_door + BASE_RATES.cabinets.kitchen_setup
          : getCabinetRate(loc, sqft);`],
  ["          amount: rate * scopeMultiplier * regionalMult * cabinetComplexity,\n        });",
    "          amount: rate * scopeMultiplier * regionalMult * cabinetComplexity,\n          key: `cabinets:${loc}`,\n        });"],

  // closets
  ["    if (ctx.closets !== 'none') {", "    if (ctx.closets !== 'none' && !off('closets')) {"],

  // stairways
  [`    if (ctx.stairways === 'yes') {
      const stairCount = ctx.stairwayCount || 1;
      let stairTotal = 0;`,
    `    if (ctx.stairways === 'yes' && !off('stairs')) {
      const stairCount = ctx.stairwayCount || 1;
      let stairTotal = 0;`],
  [`      if (ctx.stairwayDetails === 'walls_only' || !ctx.stairwayDetails) {
        stairTotal = stairCount * BASE_RATES.stairs.walls_one_flight;
      } else if`,
    `      if (ctx.stairwayDetails === 'railings_only') {
        // railing and balusters alone: about 14 ft for a standard flight unless the customer gave the length
        const railFt = ctx.stairRailFeet || 14 * stairCount;
        const rate = ctx.railingType === 'spindles' || ctx.railingType === 'both' ? BASE_RATES.stairs.railing_spindles_per_ft : BASE_RATES.stairs.railing_simple_per_ft;
        stairTotal = railFt * rate * railingMaterialFactor;
      } else if (ctx.stairwayDetails === 'walls_only' || !ctx.stairwayDetails) {
        stairTotal = stairCount * BASE_RATES.stairs.walls_one_flight;
      } else if`],
  ["        description: `Stairways (${stairCount})${ctx.interiorRailingMaterial === 'wrought_iron' ? ' — wrought iron detail' : ''}`,\n        amount: stairTotal * regionalMult,\n      });",
    "        description: `${ctx.stairwayDetails === 'railings_only' ? 'Stair Railing' : 'Stairways'} (${ctx.stairwayDetails === 'railings_only' ? `${ctx.stairRailFeet || 14 * stairCount} ft` : stairCount})${ctx.interiorRailingMaterial === 'wrought_iron' ? ' — wrought iron detail' : ''}`,\n        amount: stairTotal * regionalMult,\n        key: 'stairs',\n      });"],

  // interior shutters
  ["    if (ctx.interiorShutters === 'yes') {", "    if (ctx.interiorShutters === 'yes' && !off('interior_shutters')) {"],
  ["        amount: shutterCount * BASE_RATES.specialty.shutter_interior * regionalMult,\n      });", "        amount: shutterCount * BASE_RATES.specialty.shutter_interior * regionalMult,\n        key: 'interior_shutters',\n      });"],

  // specialty: fireplace, beams, builtins, epoxy, brick
  ["    if (ctx.specialtyServices.includes('fireplace')) {", "    if (ctx.specialtyServices.includes('fireplace') && !off('fireplace')) {"],
  ["        amount: fpCount * fpRate * regionalMult,\n      });", "        amount: fpCount * fpRate * regionalMult,\n        key: 'fireplace',\n      });"],
  ["    if (ctx.specialtyServices.includes('beams')) {", "    if (ctx.specialtyServices.includes('beams') && !off('beams')) {"],
  ["        amount: beamFt * beamRate * regionalMult,\n      });", "        amount: beamFt * beamRate * regionalMult,\n        key: 'beams',\n      });"],
  ["    if (ctx.specialtyServices.includes('built_ins')) {", "    if (ctx.specialtyServices.includes('built_ins') && !off('built_ins')) {"],
  ["        amount: count * BASE_RATES.specialty.bookcase_small * regionalMult,\n      });", "        amount: count * BASE_RATES.specialty.bookcase_small * regionalMult,\n        key: 'built_ins',\n      });"],
  ["    if (ctx.specialtyServices.includes('epoxy')) {", "    if (ctx.specialtyServices.includes('epoxy') && !off('epoxy')) {"],
  ["        amount: garageSqft * epoxyRate * regionalMult,\n      });", "        amount: garageSqft * epoxyRate * regionalMult,\n        key: 'epoxy',\n      });"],
  ["    if (ctx.specialtyServices.includes('brick')) {", "    if (ctx.specialtyServices.includes('brick') && !off('brick')) {"],
  ["        amount: brickSqft * brickRate * regionalMult,\n      });", "        amount: brickSqft * brickRate * regionalMult,\n        key: 'brick',\n      });"],

  // move furniture out of the interior-only block (patio furniture is an exterior item)
  [`    // Furniture
    if (ctx.specialtyServices.includes('furniture') && ctx.furnitureItems.length > 0) {
      let furnitureTotal = 0;
      for (const item of ctx.furnitureItems) {
        const key = \`furniture_\${item}\` as keyof typeof BASE_RATES.specialty;
        const rate = BASE_RATES.specialty[key] || BASE_RATES.specialty.furniture_cabinet;
        furnitureTotal += typeof rate === 'number' ? rate : 175;
      }
      lineItems.push({
        category: 'Specialty',
        description: \`Furniture Painting (\${ctx.furnitureItems.length} pieces)\`,
        amount: furnitureTotal * regionalMult,
      });
    }

`, ''],
  ['  // ===== EXTERIOR =====\n  if (ctx.projectType === \'exterior\' || ctx.projectType === \'both\') {',
    `  // Furniture (indoor pieces, or patio sets on an exterior-only job)
  if (ctx.specialtyServices.includes('furniture') && ctx.furnitureItems.length > 0 && !off('furniture')) {
    let furnitureTotal = 0;
    for (const item of ctx.furnitureItems) {
      const key = \`furniture_\${item}\` as keyof typeof BASE_RATES.specialty;
      const rate = BASE_RATES.specialty[key] || BASE_RATES.specialty.furniture_cabinet;
      furnitureTotal += typeof rate === 'number' ? rate : 175;
    }
    lineItems.push({
      category: 'Specialty',
      description: \`Furniture Painting (\${ctx.furnitureItems.length} pieces)\`,
      amount: furnitureTotal * regionalMult,
      key: 'furniture',
    });
  }

  // ===== EXTERIOR =====
  const bodyPainted = ctx.exteriorBody !== 'no' && !off('ext_body');
  if (ctx.projectType === 'exterior' || ctx.projectType === 'both') {`],

  // exterior body
  [`    lineItems.push({
      category: 'Exterior',
      description: 'Exterior Body / Siding',
      amount: extWallArea * sidingRate * regionalMult * conditionMultiplier,
    });

    // Stucco condition add-ons
    if (ctx.stuccoCondition === 'new_stucco') {`,
    `    if (bodyPainted) lineItems.push({
      category: 'Exterior',
      description: 'Exterior Body / Siding',
      amount: extWallArea * sidingRate * regionalMult * conditionMultiplier,
      key: 'ext_body',
    });

    // Stucco condition add-ons
    if (!bodyPainted) {
      // only the house features the customer listed are painted: no stucco work
    } else if (ctx.stuccoCondition === 'new_stucco') {`],
  ["    if (ctx.exteriorTrim === 'yes') {\n      lineItems.push({\n        category: 'Exterior',\n        description: 'Exterior Trim & Fascia',\n        amount: extSurface.trimLinFt * BASE_RATES.exterior.fascia_per_linft * regionalMult,\n      });",
    "    if (ctx.exteriorTrim === 'yes' && !off('ext_trim')) {\n      lineItems.push({\n        category: 'Exterior',\n        description: 'Exterior Trim & Fascia',\n        amount: extSurface.trimLinFt * BASE_RATES.exterior.fascia_per_linft * regionalMult,\n        key: 'ext_trim',\n      });"],
  ["    if (ctx.soffitsEaves === 'yes') {\n      lineItems.push({\n        category: 'Exterior',\n        description: 'Soffits & Eaves',\n        amount: extSurface.soffitSqFt * BASE_RATES.exterior.soffit_per_sqft * regionalMult,\n      });",
    "    if (ctx.soffitsEaves === 'yes' && !off('soffits')) {\n      lineItems.push({\n        category: 'Exterior',\n        description: 'Soffits & Eaves',\n        amount: extSurface.soffitSqFt * BASE_RATES.exterior.soffit_per_sqft * regionalMult,\n        key: 'soffits',\n      });"],
  ["    if (ctx.exteriorShutters === 'yes') {", "    if (ctx.exteriorShutters === 'yes' && !off('ext_shutters')) {"],
  ["        amount: shutterCount * BASE_RATES.specialty.shutter_exterior * regionalMult,\n      });", "        amount: shutterCount * BASE_RATES.specialty.shutter_exterior * regionalMult,\n        key: 'ext_shutters',\n      });"],
  ["    if (ctx.garageDoor === 'single') {\n      lineItems.push({ category: 'Exterior', description: 'Garage Door (Single)', amount: BASE_RATES.doors.garage_single * regionalMult });\n    } else if (ctx.garageDoor === 'double') {\n      lineItems.push({ category: 'Exterior', description: 'Garage Door (Double)', amount: BASE_RATES.doors.garage_double * regionalMult });\n    }",
    "    if (off('garage_door')) {\n      // taken off the price\n    } else if (ctx.garageDoor === 'single') {\n      lineItems.push({ category: 'Exterior', description: 'Garage Door (Single)', amount: BASE_RATES.doors.garage_single * regionalMult, key: 'garage_door' });\n    } else if (ctx.garageDoor === 'double') {\n      lineItems.push({ category: 'Exterior', description: 'Garage Door (Double)', amount: BASE_RATES.doors.garage_double * regionalMult, key: 'garage_door' });\n    }"],
  ["    if (ctx.entryDoor === 'yes') {\n      lineItems.push({ category: 'Exterior', description: 'Entry Door', amount: BASE_RATES.doors.entry_door * regionalMult });",
    "    if (ctx.entryDoor === 'yes' && !off('entry_door')) {\n      lineItems.push({ category: 'Exterior', description: 'Entry Door', amount: BASE_RATES.doors.entry_door * regionalMult, key: 'entry_door' });"],

  // railings (exterior) - add key & off
  ["    if (ctx.railings === 'yes') {\n      const railingFt = Math.round(Math.sqrt(sqft / (ctx.stories || 1)) * 0.3) || 20;",
    "    if (ctx.railings === 'yes' && !off('railings')) {\n      const railingFt = ctx.stairRailFeet || Math.round(Math.sqrt(sqft / (ctx.stories || 1)) * 0.3) || 20;"],
  ["            amount: railingFt * BASE_RATES.exterior.railing_simple_per_linft * materialMult * regionalMult,\n          });\n          break;\n        case 'spindles':",
    "            amount: railingFt * BASE_RATES.exterior.railing_simple_per_linft * materialMult * regionalMult,\n            key: 'railings',\n          });\n          break;\n        case 'spindles':"],
  ["            amount: railingFt * BASE_RATES.exterior.railing_spindle_per_linft * materialMult * regionalMult,\n          });\n          break;\n        case 'both':",
    "            amount: railingFt * BASE_RATES.exterior.railing_spindle_per_linft * materialMult * regionalMult,\n            key: 'railings',\n          });\n          break;\n        case 'both':"],
  ["            amount: railingFt * (BASE_RATES.exterior.railing_simple_per_linft + BASE_RATES.exterior.railing_spindle_per_linft) / 2 * materialMult * regionalMult,\n          });\n          break;\n        default:",
    "            amount: railingFt * (BASE_RATES.exterior.railing_simple_per_linft + BASE_RATES.exterior.railing_spindle_per_linft) / 2 * materialMult * regionalMult,\n            key: 'railings',\n          });\n          break;\n        default:"],
  ["            amount: railingFt * BASE_RATES.exterior.railing_simple_per_linft * materialMult * regionalMult,\n          });\n      }\n    }",
    "            amount: railingFt * BASE_RATES.exterior.railing_simple_per_linft * materialMult * regionalMult,\n            key: 'railings',\n          });\n      }\n    }"],

  // balconies, deck, fence, gutters, foundation, windows, overhangs
  ["    if (ctx.balconies === 'yes') {", "    if (ctx.balconies === 'yes' && !off('balconies')) {"],
  ["description: `Balconies (${balcCount})`, amount: balcAmount * regionalMult });", "description: `Balconies (${balcCount})`, amount: balcAmount * regionalMult, key: 'balconies' });"],
  ["    if (ctx.deck === 'yes') {", "    if (ctx.deck === 'yes' && !off('deck')) {"],
  ["        description: 'Deck',\n        amount: deckSqft * BASE_RATES.exterior.deck_stain_per_sqft * regionalMult,\n      });",
    "        description: ctx.deckSqft ? `Deck (${deckSqft} sq ft)` : 'Deck',\n        amount: deckSqft * BASE_RATES.exterior.deck_stain_per_sqft * regionalMult,\n        key: 'deck',\n      });"],
  ["      const deckSqft = deckSizes[ctx.deckSize as keyof typeof deckSizes] || deckSizes.medium;", "      const deckSqft = ctx.deckSqft || deckSizes[ctx.deckSize as keyof typeof deckSizes] || deckSizes.medium;"],
  ["    if (ctx.fence === 'yes') {", "    if (ctx.fence === 'yes' && !off('fence')) {"],
  ["        amount: fenceFt * fenceRate * regionalMult,\n      });", "        amount: fenceFt * fenceRate * regionalMult,\n        key: 'fence',\n      });"],
  ["    if (ctx.gutters === 'yes') {\n      lineItems.push({\n        category: 'Exterior',\n        description: 'Gutters & Downspouts',\n        amount: extSurface.gutterLinFt * BASE_RATES.exterior.gutter_per_linft * regionalMult,\n      });",
    "    if (ctx.gutters === 'yes' && !off('gutters')) {\n      lineItems.push({\n        category: 'Exterior',\n        description: 'Gutters & Downspouts',\n        amount: extSurface.gutterLinFt * BASE_RATES.exterior.gutter_per_linft * regionalMult,\n        key: 'gutters',\n      });"],
  ["    if (ctx.foundation === 'yes') {", "    if (ctx.foundation === 'yes' && !off('foundation')) {"],
  ["        amount: perimeterFt * BASE_RATES.exterior.foundation_per_linft * regionalMult,\n      });", "        amount: perimeterFt * BASE_RATES.exterior.foundation_per_linft * regionalMult,\n        key: 'foundation',\n      });"],
  ["    if (ctx.exteriorWindows !== 'none') {", "    if (ctx.exteriorWindows !== 'none' && !off('ext_windows')) {"],
  ["        amount: extWinCount * BASE_RATES.exterior.window_trim_each * regionalMult,\n      });", "        amount: extWinCount * BASE_RATES.exterior.window_trim_each * regionalMult,\n        key: 'ext_windows',\n      });"],
  ["    if (ctx.overhangs === 'yes') {", "    if (ctx.overhangs === 'yes' && !off('overhangs')) {"],
  ["        amount: overhangSqFt * BASE_RATES.exterior.overhang_per_sqft * regionalMult,\n      });", "        amount: overhangSqFt * BASE_RATES.exterior.overhang_per_sqft * regionalMult,\n        key: 'overhangs',\n      });"],

  // multi-story / access / color change only when body painted
  ["    if ((ctx.stories || 1) > 1) {\n      const extraStories", "    if (bodyPainted && (ctx.stories || 1) > 1) {\n      const extraStories"],
  ["    if (ctx.accessRestrictions === 'some' || ctx.accessRestrictions === 'significant') {\n      const factor = ctx.accessRestrictions === 'significant' ? 0.15 : 0.07;",
    "    if (bodyPainted && (ctx.accessRestrictions === 'some' || ctx.accessRestrictions === 'significant')) {\n      const factor = ctx.accessRestrictions === 'significant' ? 0.15 : 0.07;"],
  ["    if (ctx.exteriorColorChange === 'different') {\n      const extraCoat", "    if (bodyPainted && ctx.exteriorColorChange === 'different') {\n      const extraCoat"],

  // prep: power washing, wallpaper, popcorn
  [`  if (ctx.prepWork.includes('power_washing')) {
    const pwSqft = ctx.projectType === 'interior' ? 0 : sqft;
    const pwAmount = Math.max(pwSqft * BASE_RATES.prep.power_washing, BASE_RATES.prep.power_washing_minimum);
    lineItems.push({ category: 'Prep Work', description: 'Power Washing', amount: pwAmount * regionalMult });
  }`,
    `  if (ctx.prepWork.includes('power_washing') && !off('power_washing')) {
    const pwSqft = ctx.projectType === 'interior' ? 0 : ctx.pressureWashSqft || sqft;
    const pwAmount = Math.max(pwSqft * BASE_RATES.prep.power_washing, BASE_RATES.prep.power_washing_minimum);
    lineItems.push({ category: 'Prep Work', description: ctx.pressureWashSqft ? \`Pressure Washing (\${pwSqft} sq ft)\` : 'Power Washing', amount: pwAmount * regionalMult, key: 'power_washing' });
  }`],
  ["  if (ctx.prepWork.includes('wallpaper_removal')) {", "  if (ctx.prepWork.includes('wallpaper_removal') && !off('wallpaper_removal')) {"],
  ["      amount: wpSqft * BASE_RATES.prep.wallpaper_removal_per_sqft * regionalMult,\n    });", "      amount: wpSqft * BASE_RATES.prep.wallpaper_removal_per_sqft * regionalMult,\n      key: 'wallpaper_removal',\n    });"],
  [`  if (ctx.prepWork.includes('popcorn_removal')) {
    const rooms = ctx.popcornCeilingRooms || 1;
    // Average room ~150 sqft of ceiling
    const pcSqft = rooms * 150;`,
    `  if (ctx.prepWork.includes('popcorn_removal') && !off('popcorn_removal')) {
    const rooms = ctx.popcornCeilingRooms || 1;
    // Average room ~150 sqft of ceiling, unless the customer gave the area
    const pcSqft = ctx.popcornCeilingSqft || rooms * 150;`],
  ["      description: `Popcorn Ceiling Removal (${rooms} rooms)`,\n      amount: pcSqft * BASE_RATES.prep.popcorn_removal_per_sqft * regionalMult,\n    });",
    "      description: ctx.popcornCeilingSqft ? `Popcorn Ceiling Removal (${pcSqft} sq ft)` : `Popcorn Ceiling Removal (${rooms} rooms)`,\n      amount: pcSqft * BASE_RATES.prep.popcorn_removal_per_sqft * regionalMult,\n      key: 'popcorn_removal',\n    });"],

  // minimum charge and masking, before SUBTOTAL
  [`  // ===== SUBTOTAL =====
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);`,
    `  // ===== Painting only some surfaces is fussier than painting them all together =====
  // Trim or ceilings without the walls (or walls without the ceiling or trim) means masking and protecting the
  // surfaces being left alone, plus a second pass of cut-in lines. Applies to a job that was scoped that way
  // from the start and to a price the customer trimmed afterwards.
  if (ctx.projectType === 'interior' || ctx.projectType === 'both') {
    const has = (k: string) => lineItems.some((l) => l.key === k);
    const surfaces = ['walls', 'ceilings', 'trim'];
    const wantedWalls = ctx.interiorWalls !== 'no';
    const wantedCeil = ctx.interiorCeilings === 'yes';
    const wantedTrim = ctx.interiorTrim === 'yes';
    const included = surfaces.filter(has).length;
    const wanted = [wantedWalls, wantedCeil, wantedTrim].filter(Boolean).length;
    const skipped = Math.max(0, 3 - included);
    if (included > 0 && skipped > 0 && (included < wanted || wanted < 3)) {
      const base = lineItems.filter((l) => l.key && surfaces.includes(l.key)).reduce((s, l) => s + l.amount, 0);
      const extra = base * Math.min(0.12, 0.05 * (has('walls') ? skipped : skipped + 0.4));
      if (extra > 1) lineItems.push({ category: 'Prep Work', description: 'Masking & protecting surfaces left unpainted', amount: extra });
    }
  }

  // ===== SUBTOTAL =====
  let subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  // A painter won't mobilize for less than a minimum job fee, however small the item.
  const minCharge = MIN_JOB_CHARGE * regionalMult;
  const paintable = lineItems.length > 0;
  if (paintable && subtotal < minCharge) {
    lineItems.push({ category: 'Scheduling', description: 'Minimum service charge (small job)', amount: minCharge - subtotal });
    subtotal = minCharge;
  }`],

  // return volumeEfficiency
  ["    confidence,\n    confidenceNote,\n  };\n}\n\n// ===== Running Estimate =====",
    "    confidence,\n    confidenceNote,\n    volumeEfficiency: volumeEfficiencyUsed < 0.995 ? Math.round(volumeEfficiencyUsed * 1000) / 1000 : undefined,\n  };\n}\n\n// ===== Running Estimate ====="],

  // declare volumeEfficiencyUsed at top
  ["  const lineItems: EstimateLineItem[] = [];\n  const sqft =", "  const lineItems: EstimateLineItem[] = [];\n  let volumeEfficiencyUsed = 1;\n  const sqft ="],

  // helpers
  ["function getLayout(ctx: EstimatorContext, sqft: number) {\n  if (ctx.interiorScope === 'specific_rooms' && ctx.selectedRooms.length > 0) {\n    // Use actual room specs for selected rooms\n    let totalWall = 0, totalCeiling = 0, totalTrim = 0, totalDoors = 0, totalWindows = 0, totalClosets = 0;\n    for (const room of ctx.selectedRooms) {",
    `/**
 * Per-square-foot cost falls as the amount of wall to paint grows (published guides: a single 12x12 bedroom runs
 * about $1.50-2.70 per sq ft of wall, a whole 1,500 sq ft home about $1.00-1.50 all-in). Anchored at 600 sq ft of
 * wall (about two rooms) with no discount, easing to 20% off at 4,500 sq ft (a large home).
 */
export function volumeEfficiency(wallSqFt: number): number {
  if (wallSqFt <= 600) return 1;
  const t = Math.min(1, Math.log(wallSqFt / 600) / Math.log(4500 / 600));
  return 1 - 0.2 * t;
}

function getLayout(ctx: EstimatorContext, sqft: number) {
  if (ctx.interiorScope === 'specific_rooms' && ctx.selectedRooms.length > 0) {
    // Use actual room specs for selected rooms
    let totalWall = 0, totalCeiling = 0, totalTrim = 0, totalDoors = 0, totalWindows = 0, totalClosets = 0;
    const keptRooms = ctx.selectedRooms.filter((r) => !ctx.excludedRooms.includes(r));
    for (const room of keptRooms) {`],
  ["    return {\n      rooms: ctx.selectedRooms,\n      totalWallSqFt: totalWall,", "    return {\n      rooms: keptRooms,\n      totalWallSqFt: totalWall,"],
  ["  return estimateHouseLayout(sqft, ctx.bedroomCount || undefined);", "  return estimateHouseLayout(sqft, ctx.bedroomCount || undefined, ctx.excludedRooms);"],
]);

// types
patch('src/lib/types.ts', [
  ["  confidenceNote: string;\n}", "  confidenceNote: string;\n  /** Set when a multi-room job earned a volume rate (e.g. 0.82 = about 18% off per-square-foot interior pricing). */\n  volumeEfficiency?: number;\n}"],
  ["  popcornCeilingSqft: number | null; // ceiling area to de-texture, when given\n",
    "  popcornCeilingSqft: number | null; // ceiling area to de-texture, when given\n  cabinetDoorCount: number | null; // kitchen doors + drawer fronts, when given\n  deckSqft: number | null; // deck area, when given\n  pressureWashSqft: number | null; // area to pressure wash, when it isn't just the house\n"],
]);
patch('src/lib/chatEstimator/defaultContext.ts', [
  ["popcornCeilingSqft: null,\n", "popcornCeilingSqft: null,\n    cabinetDoorCount: null, deckSqft: null, pressureWashSqft: null,\n"],
]);
console.log('engine patched');
