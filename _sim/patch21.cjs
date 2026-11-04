const fs = require('fs');
function patch(file, edits) {
  let t = fs.readFileSync(file, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 90));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split('\n').join('\r\n') : t);
}

// ---- extractors: vanity counts as cabinets; more room names; a plain reply to "which rooms?" is a room
patch('src/lib/chatEstimator/extractors.ts', [
  ["  const mentioned = /\\bcabinet/.test(t);\n  if (!mentioned) return { yes: false, locations: [] };",
   "  const mentioned = /\\bcabinet|\\bvanit/.test(t);\n  if (!mentioned) return { yes: false, locations: [] };"],
  ["  if (locations.length === 0) locations.push('kitchen'); // default assumption when cabinets mentioned",
   "  if (locations.length === 0) locations.push(/\\bbath/.test(t) ? 'bathroom' : 'kitchen'); // default assumption when cabinets mentioned"],
  ["    [/\\bfamily\\s+room\\b/, 'bonus_room'],",
   "    [/\\bnursery\\b|\\bbaby(?:'s)?\\s+room\\b|\\bkid'?s?\\s+room\\b|\\bplay\\s*room\\b/, 'bedroom_3'],\n    [/\\bguest\\s+room\\b/, 'bedroom_2'],\n    [/\\bsun\\s*room\\b|\\bfour[\\s-]season\\b|\\bscreened[\\s-]in\\b|\\brec(?:reation)?\\s+room\\b|\\bbasement\\b|\\battic\\b|\\bloft\\b|\\bman\\s*cave\\b|\\bgame\\s+room\\b|\\bhome\\s+theat(?:er|re)\\b/, 'bonus_room'],\n    [/\\bfamily\\s+room\\b/, 'bonus_room'],"],
  // a reply to "which rooms?" that names something we don't know is still one room
  ["  const cab = extractCabinets(text);\n  if (cab.yes && prev.cabinets === 'none') {",
   "  if (\n    lastBotTopicId === 'which_rooms' &&\n    rooms.length === 0 &&\n    !prev.interiorScope &&\n    !patch.interiorScope &&\n    prev.selectedRooms.length === 0 &&\n    text.trim().length > 0 &&\n    !/\\b(whole|entire|all|every(?:thing)?|throughout)\\b/i.test(text) &&\n    !text.trim().endsWith('?')\n  ) {\n    // a room we don't have a template for (\"the studio\", \"sewing room\"): price it as one ordinary room and say so\n    patch.selectedRooms = ['bedroom_2'];\n    patch.interiorScope = 'specific_rooms';\n    acks.push('1 room');\n  }\n\n  const cab = extractCabinets(text);\n  if (cab.yes && prev.cabinets === 'none') {"],
]);

// ---- engine: a job always carries at least the minimum service charge (never a $0 price)
patch('src/lib/estimateEngine.ts', [
  ["  const paintable = lineItems.length > 0;\n  if (paintable && subtotal < minCharge) {", "  if (subtotal < minCharge) {"],
]);

// ---- chatEngine: acknowledgements dedupe ignoring commas, plus customer corrections
patch('src/lib/chatEstimator/chatEngine.ts', [
  ["  const acknowledgements = Array.from(new Set(understood.acknowledgements));",
   "  const acknowledgements = understood.acknowledgements.filter((a, i, all) => all.findIndex((b) => b.replace(/,/g, '') === a.replace(/,/g, '')) === i);"],
  ["  // Timing safety net (LLM path and local fallback alike)",
   "  // Corrections (\"actually the zip is 98101\", \"it's closer to 2,400 sq ft\", \"change my dates to ...\"): the extractors only\n  // fill empty fields, so without this a later correction would be silently ignored.\n  if (/\\b(actually|correction|correct that|oh wait|wait,|sorry,|i meant|make that|change (?:it|that|the|my)|should (?:be|say)|instead|not [\\w ]{0,20} but)\\b/i.test(trimmed)) {\n    const zipFix = extractZip(trimmed);\n    if (zipFix && zipFix !== ctxWithExplicit.zipCode) {\n      ctxWithExplicit.zipCode = zipFix;\n      const st = getStateFromZip(zipFix);\n      if (st) ctxWithExplicit.state = st;\n      acknowledgements.push(`updated the ZIP to ${zipFix}`);\n    }\n    const sqftFix = extractSquareFeet(trimmed);\n    if (sqftFix && sqftFix !== ctxWithExplicit.squareFeet) {\n      ctxWithExplicit.squareFeet = sqftFix;\n      acknowledgements.push(`updated the size to ${sqftFix.toLocaleString()} sqft`);\n    }\n    const dateFix = extractTiming(trimmed);\n    if (dateFix.startDate && dateFix.startDate !== ctxWithExplicit.startDate) {\n      ctxWithExplicit.startDate = dateFix.startDate;\n      ctxWithExplicit.endDate = dateFix.endDate ?? '';\n      ctxWithExplicit.timeline = timelineFromStart(dateFix.startDate);\n      acknowledgements.push(`updated your dates to ${dateFix.startDate}${dateFix.endDate ? ` – ${dateFix.endDate}` : ''}`);\n    }\n  }\n\n  // Timing safety net (LLM path and local fallback alike)"],
  ["import { extractAll, extractPhotoTriggers, extractTimeline, extractPropertyType, extractAccessSignals } from './extractors';", "import { extractAll, extractPhotoTriggers, extractTimeline, extractPropertyType, extractAccessSignals, extractZip, extractSquareFeet } from './extractors';\nimport { getStateFromZip } from '../zipCodeData';"],
]);

// ---- derivation: negated surfaces ("no walls, no ceilings") and commercial scope
patch('src/lib/chatEstimator/derivation.ts', [
  ["  const hasOnly = /\\b(only|just|nothing else|that'?s (?:all|it))\\b/.test(t);\n  const mentionsSurfaceWords =",
   `  // Surfaces the customer ruled out ("no walls, no ceilings", "without the doors", "skip the trim").
  const negated = new Set<string>();
  const negRe = /\\b(?:no|without|skip|excluding|except(?: for)?|not (?:the )?|don'?t (?:paint|do|need)(?: the)?|leave out)\\s+((?:(?:walls?|ceilings?|trim|baseboards?|doors?|windows?)\\b(?:\\s*(?:,|or|and|nor|\\/)\\s*)?)+)/g;
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
    if (Object.keys(neg).length > 0) out.push({ patch: { ...neg, surfacesAddressed: true }, reason: 'Customer ruled out surfaces' });
  }
  const tNeg = t.replace(negRe, ' ');
  const hasOnly = /\\b(only|just|nothing else|that'?s (?:all|it))\\b/.test(t);
  const mentionsSurfaceWords =`],
  ["/\\b(walls?|ceilings?|whole|entire|every room|all (?:the )?rooms|throughout|bedrooms?|living room|kitchen walls)\\b/.test(t);\n  const railWords", "/\\b(walls?|ceilings?|whole|entire|every room|all (?:the )?rooms|throughout|bedrooms?|living room|kitchen walls)\\b/.test(tNeg);\n  const railWords"],
  ["  // Exterior jobs that are about features, not the house body",
   `  // A business or apartment building isn't priced room by room ("the sanctuary and hall" is not one hallway): it's the whole
  // space, sized by square footage, unless the customer limited it ("just the lobby").
  if ((ctx.propertyType === 'commercial' || ctx.propertyType === 'multi_unit') && ctx.interiorScope === 'specific_rooms' && !hasOnly && ctx.stairwayDetails !== 'railings_only') {
    out.push({ patch: { interiorScope: 'whole_house', selectedRooms: [] }, reason: 'Commercial space → whole-space scope' });
  }

  // Exterior jobs that are about features, not the house body`],
]);
console.log('ok');
