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
patch('src/lib/chatEstimator/chatEngine.ts', [
  ["        `Circling back — I don't think I got this one: ${question.charAt(0).toLowerCase()}${question.slice(1)}`;",
   "        // when half of a two-part question was answered, just ask for the missing half instead of claiming it wasn't understood\n        (retry.id === 'timeline_and_access' && (ctxNext.occupancy || ctxNext.timeline || ctxNext.startDate || ctxNext.datesFlexible)\n          ? `One more thing — ${question.charAt(0).toLowerCase()}${question.slice(1)}`\n          : `Circling back — I don't think I got this one: ${question.charAt(0).toLowerCase()}${question.slice(1)}`);"],
]);
patch('src/lib/chatEstimator/extractors.ts', [
  ["  const beds = extractBedroomCount(text);\n  if (beds && !prev.bedroomCount) {",
   "  // Any reply to \"how are the walls / what shape is it in?\" is an answer (\"it's fine\", \"good\", \"a few cracks\"); the\n  // damage extractors below pick out specifics, but a plain \"fine\" must still close the question.\n  if (lastBotTopicId === 'condition' && !prev.conditionAddressed && text.trim().length > 0 && !text.trim().endsWith('?')) {\n    patch.conditionAddressed = true;\n  }\n  if (lastBotTopicId === 'trim_scope' && !prev.trimScopeAddressed && text.trim().length > 0 && !text.trim().endsWith('?')) {\n    patch.trimScopeAddressed = true;\n  }\n\n  const beds = extractBedroomCount(text);\n  if (beds && !prev.bedroomCount) {"],
]);
console.log('ok');
