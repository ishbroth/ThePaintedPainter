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
patch('src/lib/chatEstimator/extractors.ts', [
  ["    [/\\b(?:two|2|both|three|3)\\s+(?:full\\s+)?bath(?:room)?s\\b/, 'bathroom_master'],\n",
   "    [/\\b(?:two|2|both|three|3)\\s+(?:full\\s+)?bath(?:room)?s\\b/, 'bathroom_master'],\n    [/\\b(?:two|2|both|three|3)\\s+(?:full\\s+)?bath(?:room)?s\\b/, 'bathroom_2'],\n"],
]);
patch('src/lib/chatEstimator/derivation.ts', [
  ["  // Exterior jobs that are about features, not the house body",
   `  // A studio is a one-room apartment: don't price it as a typical house, and don't make the customer measure it.
  if (!ctx.squareFeet && !ctx.bedroomCount && /\\bstudio(?:\\s+(?:apartment|apt|unit|condo|flat))?\\b/.test(t) && !/\\bstudio\\s+(?:space|business|photography)\\b/.test(t)) {
    out.push({ patch: { squareFeet: 500 }, reason: 'Studio apartment → about 500 sq ft' });
  }

  // Exterior jobs that are about features, not the house body`],
  // commercial: scope regardless of "only" elsewhere in the conversation
  ["ctx.interiorScope === 'specific_rooms' && !hasOnly && ctx.stairwayDetails !== 'railings_only') {\n    out.push({ patch: { interiorScope: 'whole_house', selectedRooms: [] }, reason: 'Commercial space → whole-space scope' });",
   "ctx.interiorScope === 'specific_rooms' && ctx.stairwayDetails !== 'railings_only' && !/\\b(?:just|only)\\s+(?:the\\s+)?(?:lobby|reception|front|dining|kitchen|bar|office|suite|unit|room|hall|bathroom|restroom|entrance)\\b/.test(t)) {\n    out.push({ patch: { interiorScope: 'whole_house', selectedRooms: [] }, reason: 'Commercial space → whole-space scope' });"],
]);
console.log('ok');
