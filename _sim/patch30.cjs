const fs = require('fs');
function patch(file, edits) {
  let t = fs.readFileSync(file, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [from, to, all] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 90));
    t = all ? t.split(from).join(to) : t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split('\n').join('\r\n') : t);
}

patch('src/lib/estimateEngine.ts', [
  // closets removable
  ["          amount: closetCount * (BASE_RATES.closets.standard + shelvingAdd) * regionalMult,\n", "          amount: closetCount * (BASE_RATES.closets.standard + shelvingAdd) * regionalMult,\n          key: 'closets',\n"],
  ["          amount: closetCount * (BASE_RATES.closets.walkin_small + shelvingAdd * 1.5) * regionalMult,\n", "          amount: closetCount * (BASE_RATES.closets.walkin_small + shelvingAdd * 1.5) * regionalMult,\n          key: 'closets',\n"],
  // commercial open layout + stronger vacant turnover
  ["    multipliers.push({ label: 'Commercial Property', factor: 1.10 });",
   "    multipliers.push({ label: 'Commercial Property', factor: 1.10 });\n    // Open commercial space has far fewer rooms, doors, corners and trim runs than the room-by-room home layout the\n    // interior rates were built on, and is usually sprayed: published commercial prices run $2-6 per sq ft overall.\n    const openLayout = sqft >= 1000 ? 0.68 : sqft >= 500 ? 0.84 : 1;\n    if (openLayout < 1 && (ctx.projectType === 'interior' || ctx.projectType === 'both')) multipliers.push({ label: 'Open Commercial Layout (fewer rooms, doors and trim)', factor: openLayout });"],
  ["factor: ctx.occupancy === 'vacant' ? 0.78 : 0.93 });", "factor: ctx.occupancy === 'vacant' ? 0.62 : 0.93 });"],
  // a lone big room (basement, garage, great room) scales with its stated size
  ["    const keptRooms = ctx.selectedRooms.filter((r) => !ctx.excludedRooms.includes(r));\n    for (const room of keptRooms) {\n      const spec = STANDARD_ROOMS[room];\n      if (spec) {\n        totalWall += spec.wallSqFt;\n        totalCeiling += spec.ceilingSqFt;\n        totalTrim += spec.trimLinearFt;",
   "    const keptRooms = ctx.selectedRooms.filter((r) => !ctx.excludedRooms.includes(r));\n    // one large open room described by its floor area (\"1,200 sq ft basement\") is sized from that area, not the template room\n    const lone = keptRooms.length === 1 ? STANDARD_ROOMS[keptRooms[0]] : undefined;\n    const loneScale = lone && ctx.squareFeet && ctx.squareFeet <= 4000 && (ctx.squareFeet <= 600 || ['bonus_room', 'garage', 'living_room'].includes(keptRooms[0]))\n      ? Math.min(4, Math.max(0.5, ctx.squareFeet / (lone.widthFt * lone.lengthFt)))\n      : 1;\n    for (const room of keptRooms) {\n      const spec = STANDARD_ROOMS[room];\n      if (spec) {\n        totalWall += spec.wallSqFt * loneScale;\n        totalCeiling += spec.ceilingSqFt * loneScale;\n        totalTrim += spec.trimLinearFt * loneScale;"],
]);

patch('src/lib/chatEstimator/extractors.ts', [
  ["  if (/\\boverhangs?\\b|\\bpatio\\s*cover\\b|\\bporch\\s*roof\\b|\\bpatios?\\b/.test(t)) out.overhangs = true;",
   "  if (/\\boverhangs?\\b|\\bpatio\\s*cover\\b|\\bporch\\s*roof\\b|\\bpatios?\\b(?!\\s*(?:furniture|set|table|chairs?|umbrella|cushions?|loungers?))/.test(t)) out.overhangs = true;"],
  ["  const mentioned = /\\bcabinet|\\bvanit/.test(t);", "  const mentioned = /\\bcabinet|\\bvanit(?:y|ies)/.test(t);"],
  ["  if (/\\bbath(?:room)?\\s+(?:vanit|cabinet)/.test(t) || /\\bvanity\\b/.test(t)) locations.push('bathroom');", "  if (/\\bbath(?:room)?\\s+(?:vanit|cabinet)/.test(t) || /\\bvanit(?:y|ies)\\b/.test(t)) locations.push('bathroom');"],
]);

patch('src/lib/chatEstimator/derivation.ts', [
  ["staircase|stairway|door frames?", "staircase|stairway|stairs|stairwell|door frames?"],
  // popcorn: "we'll paint it ourselves" is not a repaint request
  ["    const repaint = /\\b(repaint|paint(?:ed|ing)?|new paint|refinish)\\b/.test(t.replace(/popcorn ceilings? (?:that is|is|are) painted/, ''));",
   "    const noPaint = /\\b(?:paint (?:it|them|the ceilings?) (?:ourselves|myself)|(?:we|i)(?:'ll| will| can)? paint|no paint(?:ing)?|without paint(?:ing)?|not (?:paint|painting)|removal only|just the removal|diy the paint)/.test(t);\n    const repaint = !noPaint && /\\b(repaint|paint(?:ed|ing)?|new paint|refinish)\\b/.test(t.replace(/popcorn ceilings? (?:that is|is|are) painted/, ''));"],
  // patio furniture is not a patio cover
  ["      patch: { furnitureItems: items, specialtyServices:", "      patch: { overhangs: /\\b(patio cover|overhang|porch roof|pergola)\\b/.test(t) ? ctx.overhangs : 'no', furnitureItems: items, specialtyServices:"],
  // closets-only and multi-unit sizing
  ["  // Exterior jobs that are about features, not the house body",
   String.raw`  // Several units at an stated size each ("10 one-bedroom units, 700 sq ft each") → the total, as multi-unit work
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

  // Exterior jobs that are about features, not the house body`],
]);

patch('src/lib/pricing/referenceLibrary.ts', [
  ["  W('cabinet_bathroom_vanity', 260, 'perProject', 'cabinet painters $25-75/hr, labor 80-85 percent'),", "  W('cabinet_bathroom_vanity', 260, 'perProject', 'cabinet painters $25-75/hr, labor 80-85 percent'),\n  W('cabinet_bathroom_vanity', 90, 'perProject', 'small 24 inch vanity $60-120'),\n  W('cabinet_bathroom_vanity', 270, 'perProject', '72 inch vanity $180-360'),"],
]);
console.log('ok');
