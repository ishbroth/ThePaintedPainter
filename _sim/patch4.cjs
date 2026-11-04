const fs = require('fs');
const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
function patch(file, edits) {
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes(CR + LF);
  let t = raw.split(CR + LF).join(LF);
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 80));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split(LF).join(CR + LF) : t);
}

const NEW_BLOCK = String.raw`  // ——————————————————————————————————————————
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
  const hasOnly = /\b(only|just|nothing else|that'?s (?:all|it))\b/.test(t);
  const mentionsSurfaceWords = /\b(walls?|ceilings?|whole|entire|every room|all (?:the )?rooms|throughout|bedrooms?|living room|kitchen walls)\b/.test(t);
  const railWords = /\b(stair(?:s|case|way)?\s*(?:rail(?:ing)?s?|banisters?)|banisters?|bannisters?|balusters?|spindles?|handrails?|stair rail)\b/.test(t);

  if (railWords && !/\b(deck|porch|balcon|patio|exterior|outside|outdoor)\b/.test(t) && !/\bwalls?\b/.test(t) && ctx.stairwayDetails !== 'railings_only') {
    out.push({
      patch: { ...interiorOff, projectType: ctx.projectType || 'interior', interiorScope: 'specific_rooms', stairways: 'yes', stairwayDetails: 'railings_only', railingType: /\b(spindles?|balusters?)\b/.test(t) ? 'spindles' : 'simple', stairwayCount: ctx.stairwayCount || 1 },
      reason: 'Only the stair railing → price the railing, not the walls',
    });
  } else if (/\bpopcorn\b|\bacoustic ceiling/.test(t) && /\b(removal|remove|scrape|scraping|get rid of|take off|strip)\b/.test(t) && !/\b(walls?|trim|baseboards?)\b/.test(t) && ctx.interiorWalls !== 'no') {
    const repaint = /\b(repaint|paint(?:ed|ing)?|new paint|refinish)\b/.test(t.replace(/popcorn ceilings? (?:that is|is|are) painted/, ''));
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

  // Exterior jobs that are about features, not the house body
  if (ctx.exteriorBody === '' && (ctx.projectType === 'exterior' || ctx.projectType === 'both' || !ctx.projectType)) {
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
      patch: { furnitureItems: items, specialtyServices: ctx.specialtyServices.includes('furniture') ? ctx.specialtyServices : [...ctx.specialtyServices, 'furniture'], exteriorBody: 'no', projectType: ctx.projectType || 'exterior' },
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

/** Apply a list of derivations in order`;

patch('src/lib/chatEstimator/derivation.ts', [
  ["import type { EstimatorContext } from '../types';", "import type { EstimatorContext } from '../types';\nimport { estimateHouseLayout } from '../surfaceAreaEngine';"],
  ["  return out;\n}\n\n/** Apply a list of derivations in order", NEW_BLOCK],
]);
console.log('ok');
