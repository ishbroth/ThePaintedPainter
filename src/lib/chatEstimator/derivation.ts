// ============================================================================
// Derivation Engine
// ============================================================================
// After explicit extraction, infer IMPLICIT facts from context + the cumulative
// transcript. The goal is to not ask the user about things that are already
// obvious from what they've said.
//
// Examples:
//   "I need a room painted"       → projectType=interior, scope=specific_rooms
//   "my master bedroom"           → + selectedRooms=[master_bedroom]
//   "just walls"                  → ceilings=no, trim=no, doors=none
//   "it's in good shape"          → projectCondition=repaint, prep minimal
//   "new drywall just went up"    → projectCondition=renovation, drywall yes
//
// Each derivation also returns a reason string that can be logged and
// optionally surfaced to the user ("Got it — assuming interior since you said
// 'a room'").
// ============================================================================

import type { EstimatorContext } from '../types';
import { estimateHouseLayout } from '../surfaceAreaEngine';
import { hasScopeLimiter } from './scopeWords';

export interface Derivation {
  /** Fields to merge into the context. */
  patch: Partial<EstimatorContext>;
  /** Human-readable reason, for debugging / "show your work". */
  reason: string;
}

export function derive(ctx: EstimatorContext, transcript: string): Derivation[] {
  const t = transcript.toLowerCase();
  const out: Derivation[] = [];

  // ——————————————————————————————————————————
  // Project type from room mentions
  // ——————————————————————————————————————————
  // "office" alone means a home office room, but "office building/complex/
  // tower/park/space/suite" means a commercial property — not a residential
  // room mention at all (that was misreading "I have a small office
  // building" as implying an interior home-office room).
  const mentionsHomeOffice =
    /\boffice\b(?!\s*(?:building|complex|tower|park|space|suite))/.test(t) && !/\bcommercial\b/.test(t);
  // Cabinets, vanities, fireplaces, built-ins, attics, and basements are
  // never exterior surfaces in a house-painting context — unlike "ceiling"
  // or "trim" or "railings", which legitimately exist on both sides (porch
  // ceilings, exterior trim, deck railings), so those stay ambiguous on
  // purpose and are deliberately NOT in this list.
  const mentionsIndoorRoom =
    /\b(room|rooms|bedroom|bathroom|kitchen|living room|dining|hallway|closet|pantry|nursery|den|foyer|mudroom|laundry room|apartment|apt\.?|condo(?:minium)?|duplex|rental unit|the unit|my unit|staircase|stairway|stairs|stairwell|door frames?|door jambs?|cabinets?|cabinet interiors?|vanity|vanities|wainscoting|crown molding|chair rail|baseboards?|fireplace|mantel|built[\s-]?ins?|attic|basement|popcorn ceiling)\b/.test(
      t,
    ) || mentionsHomeOffice;
  const mentionsExteriorSurface =
    /\b(siding|stucco|hardie|shiplap|clapboard|concrete block|cinder block|aluminum siding|fascia|soffit|eaves|gutter|exterior|outside|outdoor|deck|fence|picket fence|shed|garage door|driveway|patio|overhang|porch|balcony|balconies|foundation|retaining wall|window frames|window trim|entry door)\b/.test(t);

  if (!ctx.projectType) {
    if (mentionsIndoorRoom && !mentionsExteriorSurface) {
      out.push({
        patch: { projectType: 'interior' },
        reason: 'Mentioned a room → interior project',
      });
    } else if (mentionsExteriorSurface && !mentionsIndoorRoom) {
      out.push({
        patch: { projectType: 'exterior' },
        reason: 'Mentioned exterior surface → exterior project',
      });
    } else if (mentionsIndoorRoom && mentionsExteriorSurface) {
      out.push({
        patch: { projectType: 'both' },
        reason: 'Mentioned both interior and exterior elements',
      });
    } else if (/\b(rental unit|the unit|my unit|apartment|apt\.?|condo(?:minium)?|duplex|studio)\b/.test(t)) {
      out.push({
        patch: { projectType: 'interior' },
        reason: 'Rental unit/apartment phrasing → interior project',
      });
    }
  }

  // ——————————————————————————————————————————
  // Scope from single-room phrasing
  // ——————————————————————————————————————————
  if (!ctx.interiorScope || ctx.interiorScope === '') {
    if (/\b(?:a|one|just one|single)\s+(?:small\s+|medium\s+|large\s+)?(?:bed)?room\b/.test(t)) {
      out.push({
        patch: { interiorScope: 'specific_rooms' },
        reason: '"A room" → specific rooms scope',
      });
    } else if (/\b(whole house|whole home|the entire|the whole|all of it|everything|every room)\b/.test(t)) {
      out.push({
        patch: { interiorScope: 'whole_house' },
        reason: 'Whole-house phrasing',
      });
    } else if (/\b(rental unit|the unit|my unit|apartment|apt\.?|condo(?:minium)?|duplex|studio)\b/.test(t)) {
      out.push({
        patch: { interiorScope: 'whole_house' },
        reason: 'Rental unit/apartment phrasing → whole unit, not a single room',
      });
    } else if (
      (ctx.propertyType === 'commercial' || ctx.propertyType === 'multi_unit') &&
      ctx.selectedRooms.length === 0
    ) {
      // A commercial building or multi-unit property doesn't fit the
      // residential bedroom/living-room/kitchen room picker at all — this
      // runs regardless of whether the LLM or the local fallback set
      // propertyType, since derive() always runs after either extraction path.
      out.push({
        patch: { interiorScope: 'whole_house' },
        reason: 'Commercial/multi-unit property → whole-space scope, not a residential room picker',
      });
    } else if (/\b(couple|few|several)\s+(rooms?|bedrooms?)\b/.test(t) || ctx.selectedRooms.length >= 1) {
      out.push({
        patch: { interiorScope: 'specific_rooms' },
        reason: 'Multiple specific rooms mentioned',
      });
    }
  }

  // ——————————————————————————————————————————
  // Default project condition when it's clearly a repaint
  // ——————————————————————————————————————————
  if (!ctx.projectCondition) {
    if (/\b(previously painted|already painted|been painted|repaint|refresh|change the color|paint over)\b/.test(t)) {
      out.push({
        patch: { projectCondition: 'repaint' },
        reason: 'Repaint language detected',
      });
    } else if (/\b(new construction|just built|newly built|new build)\b/.test(t)) {
      out.push({
        patch: { projectCondition: 'new_construction' },
        reason: 'New construction language',
      });
    } else if (/\b(renovation|remodel|just finished|new drywall|drywall just went up)\b/.test(t)) {
      out.push({
        patch: { projectCondition: 'renovation' },
        reason: 'Renovation language',
      });
    }
  }

  // ——————————————————————————————————————————
  // "Good shape" / "in good condition" — minimize prep
  // ——————————————————————————————————————————
  if (
    /\b(?:it('?s| is)\s+(?:in\s+)?good|in good shape|looks good|no (?:damage|issues|problems)|clean|pristine|move[-\s]?in ready)\b/.test(
      t,
    )
  ) {
    if (!ctx.projectCondition) {
      out.push({
        patch: { projectCondition: 'repaint' },
        reason: 'Described as good shape → assume repaint',
      });
    }
    if (ctx.drywallRepairExtent === 'minor' || !ctx.drywallRepairExtent) {
      // Leave as-is. Don't upgrade.
    }
  }

  // ——————————————————————————————————————————
  // Single-bedroom default size assumption
  // ——————————————————————————————————————————
  if (
    ctx.interiorScope === 'specific_rooms' &&
    ctx.selectedRooms.length === 0 &&
    /\b(a|one|single)\s+(?:small\s+)?bedroom\b/.test(t)
  ) {
    out.push({
      patch: { selectedRooms: ['bedroom_3'] }, // default to small bedroom spec
      reason: 'Default "a bedroom" → small bedroom layout',
    });
  }

  // ——————————————————————————————————————————
  // "Small/medium/large" room with no dimensions → pick a STANDARD_ROOM spec
  // ——————————————————————————————————————————
  if (
    ctx.interiorScope === 'specific_rooms' &&
    ctx.selectedRooms.length === 1 &&
    ctx.selectedRooms[0] === 'bedroom_3'
  ) {
    if (/\bsmall\b/.test(t)) {
      // already small — no change
    } else if (/\bmedium|average\b/.test(t)) {
      out.push({
        patch: { selectedRooms: ['bedroom_2'] },
        reason: 'Medium-sized bedroom → use 12x12 spec',
      });
    } else if (/\blarge|big|master\b/.test(t)) {
      out.push({
        patch: { selectedRooms: ['master_bedroom'] },
        reason: 'Large/master bedroom → use master spec',
      });
    }
  }

  // ——————————————————————————————————————————
  // If user said "just walls" already, don't ask about trim/ceilings/doors
  // (The explicit extractor already sets these; this is a safety backstop.)
  // ——————————————————————————————————————————
  if (/\bjust\s+(?:the\s+)?walls?\b|\bonly\s+(?:the\s+)?walls?\b|\bwalls?\s+only\b/.test(t)) {
    if (ctx.interiorCeilings !== 'no') {
      out.push({ patch: { interiorCeilings: 'no' }, reason: '"Just walls" → no ceilings' });
    }
    if (ctx.interiorTrim !== 'no') {
      out.push({ patch: { interiorTrim: 'no' }, reason: '"Just walls" → no trim' });
    }
    if (ctx.interiorDoors !== 'none') {
      out.push({ patch: { interiorDoors: 'none' }, reason: '"Just walls" → no doors' });
    }
  }

  // ——————————————————————————————————————————
  // Occupancy defaults when phrasing strongly implies
  // ——————————————————————————————————————————
  if (
    !ctx.occupancy &&
    /\b(before we move in|not moved in yet|buying it|just bought|pre-?move)\b/.test(t)
  ) {
    out.push({
      patch: { occupancy: 'vacant' },
      reason: 'Pre-move-in phrasing → vacant',
    });
  }

  // ——————————————————————————————————————————
  // A total square footage given without naming any specific room means the
  // customer is describing the whole space as one number ("600 sqft of
  // popcorn ceiling", "1800 sqft needs painting") rather than enumerating
  // rooms — so the room-list question is redundant. Reads `ctx.projectType`/
  // `ctx.interiorScope` through whatever this same derive() call has already
  // decided (e.g. the popcorn-ceiling → interior rule above), not just the
  // pre-turn value, so ordering within this function can't produce a stale
  // read the way it would if two rules disagreed on interiorScope.
  // ——————————————————————————————————————————
  const projectTypeSoFar = out.reduce<string>((acc, d) => d.patch.projectType ?? acc, ctx.projectType);
  const interiorScopeSoFar = out.reduce<string>((acc, d) => d.patch.interiorScope ?? acc, ctx.interiorScope);
  if (
    !interiorScopeSoFar &&
    ctx.selectedRooms.length === 0 &&
    ctx.squareFeet &&
    (projectTypeSoFar === 'interior' || projectTypeSoFar === 'both')
  ) {
    out.push({
      patch: { interiorScope: 'whole_house' },
      reason: 'Square footage given without naming specific rooms → whole-space scope',
    });
  }

  // ——————————————————————————————————————————
  // Measurements the customer volunteered ("300 linear feet of baseboard", "25 doors and drawers",
  // "two accent walls"...) — logged exactly instead of being replaced by a house-size guess.
  // ——————————————————————————————————————————
  const num = (s: string) => parseInt(s.replace(/,/g, ''), 10);
  const wordNum: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  let m: RegExpMatchArray | null;

  if (ctx.trimLinearFeet == null) {
    m = t.match(/(\d[\d,]*)\s*(?:linear\s*|lin\.?\s*)?(?:feet|foot|ft\.?|lf)\s*(?:of\s*)?(?:the\s*)?(?:baseboards?|base\s*boards?|trim|casings?|moulding|molding)\b/) ||
      t.match(/\b(?:baseboards?|base\s*boards?|trim)\b[^.]{0,30}?(\d[\d,]*)\s*(?:linear\s*|lin\.?\s*)?(?:feet|foot|ft\.?|lf)\b/);
    if (m && !/crown/.test(m[0])) {
      const n = num(m[1]);
      if (n >= 10 && n <= 20000) out.push({ patch: { trimLinearFeet: n, interiorTrim: 'yes' }, reason: 'Customer gave linear feet of trim' });
    }
  }
  if (ctx.crownLinearFeet == null) {
    m = t.match(/(\d[\d,]*)\s*(?:linear\s*|lin\.?\s*)?(?:feet|foot|ft\.?|lf)\s*(?:of\s*)?crown/);
    if (m) {
      const n = num(m[1]);
      if (n >= 10 && n <= 20000) out.push({ patch: { crownLinearFeet: n, crownMolding: 'yes' }, reason: 'Customer gave linear feet of crown molding' });
    }
  }
  if (ctx.popcornCeilingSqft == null && /popcorn|acoustic ceiling|textured ceiling|cottage cheese/.test(t)) {
    m = t.match(/(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|square\s*f(?:ee|oo)t)\s*(?:of\s*)?(?:the\s*)?(?:popcorn|acoustic|textured)/) ||
      t.match(/(?:popcorn|acoustic|textured)[^.]{0,40}?(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|square\s*f(?:ee|oo)t)/);
    if (m) {
      const n = num(m[1]);
      if (n >= 50 && n <= 30000) out.push({ patch: { popcornCeilingSqft: n }, reason: 'Customer gave the ceiling area' });
    }
  }
  if (ctx.cabinetDoorCount == null && /cabinet|vanit/.test(t)) {
    m = t.match(/(\d{1,3})\s*(?:cabinet\s*)?(?:doors?|drawers?|fronts?)\b/);
    if (m) {
      const n = num(m[1]);
      if (n >= 2 && n <= 150) out.push({ patch: { cabinetDoorCount: n }, reason: 'Customer gave the cabinet door and drawer count' });
    }
  }
  if (ctx.deckSqft == null && /\bdeck\b/.test(t)) {
    m = t.match(/(\d{1,3})\s*(?:x|by|×)\s*(\d{1,3})\s*(?:foot\s*|ft\.?\s*)?(?:wood(?:en)?\s*)?deck/) ||
      t.match(/deck[^.]{0,25}?(\d{1,3})\s*(?:x|by|×)\s*(\d{1,3})/);
    if (m) {
      const n = parseInt(m[1], 10) * parseInt(m[2], 10);
      if (n >= 20 && n <= 5000) out.push({ patch: { deckSqft: n }, reason: 'Deck dimensions given' });
    } else if ((m = t.match(/(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|square\s*f(?:ee|oo)t)\s*(?:wood(?:en)?\s*)?deck|deck[^.]{0,30}?(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|square\s*f(?:ee|oo)t)/))) {
      const n = num(m[1] || m[2]);
      if (n >= 20 && n <= 5000) out.push({ patch: { deckSqft: n }, reason: 'Deck area given' });
    }
  }
  if (ctx.accentWallCount == null && /accent wall/.test(t)) {
    m = t.match(/\b(one|two|three|four|five|an?|\d)\s+(?:\w+\s+)?accent\s+walls?/);
    let n: number | null = m ? (wordNum[m[1]] ?? parseInt(m[1], 10)) : null;
    if (n == null && /accent walls? (?:in|for|on) (?:each|every)\b/.test(t)) n = ctx.bedroomCount || 3;
    if (n == null && /accent walls\b/.test(t)) n = 2;
    if (n && n <= 20) out.push({ patch: { accentWallCount: n, accentWalls: 'yes' }, reason: 'Accent wall count' });
  }
  if (ctx.stairRailFeet == null && /rail|banister|bannister|balustrade|handrail/.test(t)) {
    m = t.match(/(\d{1,3})\s*(?:linear\s*)?(?:feet|foot|ft\.?)\s*(?:of\s*)?(?:stair\s*)?(?:railing|banister|bannister|handrail|balustrade)/);
    if (m) {
      const n = num(m[1]);
      if (n >= 4 && n <= 500) out.push({ patch: { stairRailFeet: n }, reason: 'Railing length given' });
    }
  }
  if (ctx.pressureWashSqft == null && /pressure wash|power wash|soft wash/.test(t)) {
    m = t.match(/(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|square\s*f(?:ee|oo)t)\s*(?:of\s*)?(?:the\s*)?(?:driveway|patio|walkway|sidewalk|concrete|deck|fence)/) ||
      t.match(/(?:driveway|patio|walkway|sidewalk|concrete)[^.]{0,30}?(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|square\s*f(?:ee|oo)t)/);
    if (m) {
      const n = num(m[1]);
      if (n >= 50 && n <= 50000) out.push({ patch: { pressureWashSqft: n }, reason: 'Pressure-wash area given' });
    }
  }

  // ——————————————————————————————————————————
  // Scope the customer narrowed to one thing ("just the stair rail", "popcorn removal only",
  // "pressure washing only", "kitchen cabinets", "fence only"...). The house-wide defaults
  // (walls, ceilings, trim, doors, siding) must switch off or a one-item job is priced as a house.
  // ——————————————————————————————————————————
  const interiorOff: Partial<EstimatorContext> = {
    interiorWalls: 'no', interiorCeilings: 'no', interiorTrim: 'no', interiorDoors: 'none', surfacesAddressed: true, trimScopeAddressed: true, conditionAddressed: true,
  };
  // Surfaces the customer ruled out ("no walls, no ceilings", "without the doors", "skip the trim").
  const negated = new Set<string>();
  const negRe = /\b(?:no|without|skip|excluding|except(?: for)?|not (?:the )?|don'?t (?:paint|do|need)(?: the)?|leave out)\s+((?:(?:walls?|ceilings?|trim|baseboards?|doors?|windows?)\b(?:\s*(?:,|or|and|nor|\/)\s*)?)+)/g;
  for (const nm of t.matchAll(negRe)) {
    for (const w of nm[1].split(/[^a-z]+/).filter(Boolean)) negated.add(w.replace(/s$/, ''));
  }
  if (negated.size > 0) {
    const neg: Partial<EstimatorContext> = {};
    if (negated.has('wall') && ctx.interiorWalls !== 'no') neg.interiorWalls = 'no';
    if (negated.has('ceiling') && ctx.interiorCeilings !== 'no') neg.interiorCeilings = 'no';
    if ((negated.has('trim') || negated.has('baseboard')) && ctx.interiorTrim !== 'no') neg.interiorTrim = 'no';
    if (negated.has('door') && ctx.interiorDoors !== 'none') neg.interiorDoors = 'none';
    if (negated.has('window') && ctx.interiorWindows !== 'none') neg.interiorWindows = 'none';
    // ruling out the walls, or several surfaces, settles the scope; ruling out only the trim (say) leaves the ceilings and doors open
    const settles = neg.interiorWalls === 'no' || Object.keys(neg).length >= 2;
    if (Object.keys(neg).length > 0) out.push({ patch: { ...neg, ...(settles ? { surfacesAddressed: true } : {}) }, reason: 'Customer ruled out surfaces' });
  }
  const tNeg = t.replace(negRe, ' ');
  const hasOnly = hasScopeLimiter(t);
  const mentionsSurfaceWords = /\b(walls?|ceilings?|whole|entire|every room|all (?:the )?rooms|throughout|bedrooms?|living room|kitchen walls)\b/.test(tNeg);
  const railWords = /\b(stair(?:s|case|way)?\s*(?:rail(?:ing)?s?|banisters?)|banisters?|bannisters?|balusters?|spindles?|handrails?|stair rail)\b/.test(t);

  if (railWords && !/\b(deck|porch|balcon|patio|exterior|outside|outdoor)\b/.test(t) && !/\bwalls?\b/.test(t) && ctx.stairwayDetails !== 'railings_only') {
    out.push({
      patch: { ...interiorOff, projectType: ctx.projectType || 'interior', interiorScope: 'specific_rooms', stairways: 'yes', stairwayDetails: 'railings_only', railingType: /\b(spindles?|balusters?)\b/.test(t) ? 'spindles' : 'simple', stairwayCount: ctx.stairwayCount || 1 },
      reason: 'Only the stair railing → price the railing, not the walls',
    });
  } else if (/\bpopcorn\b|\bacoustic ceiling/.test(t) && /\b(removal|remove|scrape|scraping|get rid of|take off|strip)\b/.test(t) && !/\b(walls?|trim|baseboards?)\b/.test(t.replace(/no walls?/g, '')) && (ctx.interiorCeilings !== 'no' || ctx.interiorWalls !== 'no' || ctx.interiorTrim !== 'no')) {
    const noPaint = /\b(?:paint (?:it|them|the ceilings?) (?:ourselves|myself)|(?:we|i)(?:'ll| will| can)? paint|no paint(?:ing)?|without paint(?:ing)?|not (?:paint|painting)|removal only|just the removal|diy the paint)/.test(t);
    const repaint = !noPaint && /\b(repaint|paint(?:ed|ing)?|new paint|refinish)\b/.test(t.replace(/popcorn ceilings? (?:that is|is|are) painted/, ''));
    out.push({
      patch: { ...interiorOff, interiorCeilings: repaint ? 'yes' : 'no', projectType: ctx.projectType || 'interior', prepWork: ctx.prepWork.includes('popcorn_removal') ? ctx.prepWork : [...ctx.prepWork, 'popcorn_removal'] },
      reason: 'Popcorn ceiling removal only → no wall, trim or door painting',
    });
  } else if (/\b(baseboards?|base\s*boards?|trim|casings?|crown)\b/.test(t) && !mentionsSurfaceWords && (ctx.projectType === 'interior' || /\b(interior|inside|baseboards?|casings?|crown)\b/.test(t)) && !/\b(exterior|outside|fascia|soffit)\b/.test(t) && (hasOnly || ctx.trimLinearFeet != null || /\blinear (?:feet|foot)\b/.test(t)) && ctx.interiorWalls !== 'no') {
    out.push({
      patch: { ...interiorOff, interiorTrim: 'yes', projectType: ctx.projectType || 'interior', interiorScope: ctx.interiorScope || 'whole_house' },
      reason: 'Trim only → no walls, ceilings or doors',
    });
  } else if (/\b(cabinets?|vanit(?:y|ies))\b/.test(t) && !/\b(walls?|ceilings?|baseboards?|trim|doors? (?:and|&) trim|whole|entire|every room|bedrooms?|living|house|apartment|condo)\b/.test(t) && ctx.interiorWalls !== 'no' && !/\b(exterior|outside)\b/.test(t)) {
    out.push({
      patch: { ...interiorOff, projectType: ctx.projectType || 'interior', interiorScope: ctx.interiorScope || 'specific_rooms' },
      reason: 'Cabinets (or a vanity) only → no wall, ceiling or trim painting',
    });
  }

  // A business or apartment building isn't priced room by room ("the sanctuary and hall" is not one hallway): it's the whole
  // space, sized by square footage, unless the customer limited it ("just the lobby").
  if ((ctx.propertyType === 'commercial' || ctx.propertyType === 'multi_unit') && ctx.interiorScope === 'specific_rooms' && ctx.stairwayDetails !== 'railings_only' && !/\b(?:just|only)\s+(?:the\s+)?(?:lobby|reception|front|dining|kitchen|bar|office|suite|unit|room|hall|bathroom|restroom|entrance)\b/.test(t)) {
    out.push({ patch: { interiorScope: 'whole_house', selectedRooms: [] }, reason: 'Commercial space → whole-space scope' });
  }

  // A studio is a one-room apartment: don't price it as a typical house, and don't make the customer measure it.
  if (!ctx.squareFeet && !ctx.bedroomCount && /\bstudio(?:\s+(?:apartment|apt|unit|condo|flat))?\b/.test(t) && !/\bstudio\s+(?:space|business|photography)\b/.test(t)) {
    out.push({ patch: { squareFeet: 500 }, reason: 'Studio apartment → about 500 sq ft' });
  }

  // One room given by its dimensions ("10x12", "12 by 14") is sized from them, not from a template room.
  if (!ctx.squareFeet && ctx.interiorScope === 'specific_rooms' && ctx.selectedRooms.length === 1) {
    const dm = t.match(/\b(\d{1,2})\s*(?:x|by|×)\s*(\d{1,2})\b/);
    if (dm) {
      const area = parseInt(dm[1], 10) * parseInt(dm[2], 10);
      if (area >= 25 && area <= 600) out.push({ patch: { squareFeet: area }, reason: 'Room dimensions given' });
    }
  }

  // Several units at an stated size each ("10 one-bedroom units, 700 sq ft each") → the total, as multi-unit work
  if (!ctx.squareFeet) {
    const um = t.match(/(\d{1,3})\s+(?:\w+[\s-]+){0,3}?(?:apartments?|units?|condos?|townhomes?)\b[^.]{0,60}?(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|square\s*f(?:ee|oo)t)\s*(?:each|apiece|per unit)/);
    if (um) {
      const units = parseInt(um[1], 10), each = num(um[2]);
      if (units >= 2 && units <= 500 && each >= 200 && each <= 5000) {
        out.push({ patch: { squareFeet: units * each, propertyType: 'multi_unit', interiorScope: 'whole_house', selectedRooms: [], multiPhaseRequested: /\b(one at a time|as (?:tenants?|units?) (?:leave|turn)|staggered|phases?)\b/.test(t) ? 'yes' : ctx.multiPhaseRequested }, reason: units + ' units at ' + each + ' sq ft each' });
      }
    }
  }
  if (!mentionsSurfaceWords && /\bclosets?\b/.test(t) && /\b(\d{1,2}|one|two|three|four|five|six)\s+(?:\w+\s+)?closets?\b/.test(t) && ctx.closets === 'none') {
    const cm = t.match(/\b(\d{1,2}|one|two|three|four|five|six)\s+(?:\w+\s+)?closets?\b/);
    const nn = cm ? (wordNum[cm[1]] ?? parseInt(cm[1], 10)) : 1;
    out.push({ patch: { ...interiorOff, closets: /walk[\s-]?in/.test(t) ? 'both' : 'standard', closetCount: nn, interiorScope: 'specific_rooms' }, reason: 'Closets only' });
  }

  // Exterior jobs that are about features, not the house body
  if (ctx.exteriorBody === '' && (ctx.projectType === 'exterior' || ctx.projectType === 'both' || (!ctx.projectType && !mentionsIndoorRoom))) {
    const features = /\b(fence|fences|deck|shutters?|garage door|front door|entry door|porch|railings?|gutters?|fascia|soffits?|eaves|exterior trim|window trim|patio furniture|outdoor furniture|patio set|pressure wash|power wash|soft wash|driveway|patio)\b/.test(t);
    const bodyWords = /\b(siding|stucco|brick|clapboard|hardie|shingles?|whole (?:house|exterior)|entire (?:house|exterior|outside)|(?:exterior|outside) of (?:my|the|our|a) (?:house|home)|house exterior|(?:exterior|outside) (?:paint|repaint|painting)|repaint (?:the )?(?:house|exterior|outside)|victorian|colonial|ranch|bungalow|barn|shed|two[- ]story|three[- ]story|\d\s*stor(?:y|ies))\b/.test(t);
    const washOnly = /\b(pressure|power|soft)\s*wash/.test(t) && !/\b(paint|repaint|stain|coat|seal)/.test(t);
    if (washOnly) {
      out.push({ patch: { exteriorBody: 'no', projectType: 'exterior', prepWork: ctx.prepWork.includes('power_washing') ? ctx.prepWork : [...ctx.prepWork, 'power_washing'], exteriorTrim: 'no' }, reason: 'Pressure washing only → no painting of the house body' });
    } else if (features && (hasOnly || !bodyWords)) {
      out.push({ patch: { exteriorBody: 'no', projectType: ctx.projectType || 'exterior' }, reason: 'Only specific exterior features → no house-body painting' });
    } else if (features && bodyWords) {
      out.push({ patch: { exteriorBody: 'yes' }, reason: 'Whole exterior including features' });
    }
  }

  // The ceiling can change color differently from the walls ("walls same color, ceiling dark to light")
  if (ctx.ceilingColorChange === '' && /\bceilings?\b/.test(t)) {
    const cm = t.match(/\bceilings?\b[^.;\n]{0,45}?(dark(?:er)?\s+to\s+(?:light|white)|light(?:er)?\s+to\s+dark|dramatic|black\s+to\s+white|navy\s+to\s+white)/);
    const cd = !cm && t.match(/\bceilings?\b[^.;\n]{0,40}?(different\s+colou?r|new\s+colou?r|a\s+new\s+shade|going\s+(?:to\s+)?(?:a\s+)?(?:white|black|blue|grey|gray))/);
    const cs = !cm && !cd && t.match(/\bceilings?\b[^.;\n]{0,30}?(same\s+colou?r|staying|keep)/);
    if (cm || cd || cs) {
      const wallsSame = /\bwalls?\b[^.;\n]{0,30}?(same\s+colou?r|staying|keep|no\s+change)/.test(t);
      out.push({
        patch: {
          ceilingColorChange: cm ? 'dramatic' : cd ? 'different' : 'same',
          interiorCeilings: 'yes',
          ...(wallsSame && ctx.interiorColorChange !== 'same' ? { interiorColorChange: 'same' } : {}),
        },
        reason: 'Ceiling color change read separately from the walls',
      });
    }
  }

  // Taller ceilings that are only in one room ("high ceilings in the living room") affect only part of the job
  if (ctx.ceilingHeight !== 'standard' && ctx.tallCeilingShare == null && ctx.interiorScope === 'whole_house') {
    const wholeHome = /\b(throughout|whole (?:house|home|place)|all (?:the )?(?:rooms|ceilings)|every (?:room|ceiling)|entire|everywhere|all of (?:it|them))\b/.test(t);
    const oneRoom = /\b(?:high|tall|vaulted|cathedral|soaring|\d{1,2}[\s-]?(?:foot|ft|')|twelve|ten|nine)[^.;\n]{0,25}?\b(?:in|for|on)\s+(?:the\s+|our\s+|my\s+)?(living|family|great|dining|kitchen|foyer|entry|entryway|master|stair|hall|den|office|bonus)\b|\b(?:living|family|great|dining|kitchen|foyer|entry|entryway|master|stair|stairwell|hall|den|office|bonus)\b[^.;\n]{0,30}?\b(?:high|tall|vaulted|cathedral|soaring)\s+ceiling|\b(?:vaulted|cathedral|soaring)\s+(?:living|family|great|dining|kitchen|foyer|entry|entryway|master)\b/.test(t);
    if (oneRoom && !wholeHome) out.push({ patch: { tallCeilingShare: 0.35 }, reason: 'Tall ceilings in one room only' });
  }

  // Porch work: the ceiling is an overhang, the floor is deck-type surface
  if (/\bporch\b/.test(t) && ctx.overhangSqft == null) {
    const ceilingM = t.match(/(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|square\s*f(?:ee|oo)t)[^.]{0,30}ceiling|ceiling[^.]{0,40}?(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|square\s*f(?:ee|oo)t)/);
    const porchArea = ceilingM ? num(ceilingM[1] || ceilingM[2]) : 0;
    const patch: Partial<EstimatorContext> = {};
    if (/\bceiling\b/.test(t)) { patch.overhangs = 'yes'; if (porchArea >= 20 && porchArea <= 3000) patch.overhangSqft = porchArea; }
    if (/\b(floor|decking|steps?)\b/.test(t) && ctx.deck !== 'yes') { patch.deck = 'yes'; if (porchArea >= 20 && ctx.deckSqft == null) patch.deckSqft = porchArea; }
    if (Object.keys(patch).length > 0) out.push({ patch, reason: 'Porch ceiling and floor' });
  }

  // Patio furniture: count the pieces so each is priced
  if (/\b(patio|outdoor|garden|deck)\s*(furniture|set|chairs?|table)|\bloungers?\b|\bchaise\b|\bwrought iron (?:set|chairs?|table)/.test(t) && ctx.furnitureItems.length === 0) {
    const items: string[] = [];
    const count = (re: RegExp) => { const mm = t.match(re); return mm ? (wordNum[mm[1]] ?? parseInt(mm[1], 10)) : 0; };
    const chairs = count(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight)\s+(?:\w+\s+)?(?:patio\s+)?chairs?\b/) || (/\bchairs?\b/.test(t) ? 4 : 0);
    const loungers = count(/\b(\d{1,2}|one|two|three|four)\s+(?:\w+\s+)?(?:loungers?|chaises?|lounge chairs?)\b/) || (/\bloungers?\b|\bchaise\b/.test(t) ? 1 : 0);
    const benches = count(/\b(\d{1,2}|one|two|three)\s+(?:\w+\s+)?benches\b/) || (/\bbench\b/.test(t) ? 1 : 0);
    const tables = count(/\b(\d{1,2}|one|two|three)\s+(?:\w+\s+)?tables\b/) || (/\btable\b|\bpatio set\b|\bdining set\b/.test(t) ? 1 : 0);
    for (let i = 0; i < tables; i++) items.push('table_dining');
    for (let i = 0; i < chairs; i++) items.push('chair');
    for (let i = 0; i < loungers; i++) items.push('lounger');
    for (let i = 0; i < benches; i++) items.push('bench');
    if (items.length === 0) items.push('table_dining', 'chair', 'chair', 'chair', 'chair');
    out.push({
      patch: { overhangs: /\b(patio cover|overhang|porch roof|pergola)\b/.test(t) ? ctx.overhangs : 'no', furnitureItems: items, specialtyServices: ctx.specialtyServices.includes('furniture') ? ctx.specialtyServices : [...ctx.specialtyServices, 'furniture'], exteriorBody: 'no', projectType: ctx.projectType || 'exterior' },
      reason: 'Patio furniture pieces counted',
    });
  }

  // "Each room a different color" → one color per room
  if (ctx.colorChangeScope === '' && /\b(each|every)\s+(?:room|bedroom)\b[^.]{0,40}\b(different|own|separate|unique)\b[^.]{0,15}colou?r|\b(different|separate|unique|own)\s+colou?rs?\s+(?:in|for|on)\s+(?:each|every)\b|\bevery room (?:is|a|gets|has) (?:a )?different/.test(t)) {
    const rooms = estimateHouseLayout(ctx.squareFeet || 1500, ctx.bedroomCount || undefined).rooms.length;
    out.push({
      patch: { colorChangeScope: 'multiple_colors', colorCount: ctx.colorCount || Math.min(10, rooms), interiorColorChange: ctx.interiorColorChange || 'different' },
      reason: 'Each room its own color',
    });
  }

  return out;
}

/** Apply a list of derivations in order, returning the updated context. */
export function applyDerivations(
  ctx: EstimatorContext,
  derivations: Derivation[],
): EstimatorContext {
  let next = { ...ctx };
  for (const d of derivations) next = { ...next, ...d.patch };
  return next;
}
