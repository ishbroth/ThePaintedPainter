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
  ["      !clarified.includes(topic.id) &&\n      !trimmed.endsWith('?') &&", "      !clarified.includes(topic.id) &&\n      !s.wrapupAsked &&\n      !/\\b(run it|price it|go ahead|that'?s (?:all|it)|done)\\b/i.test(trimmed) &&\n      !trimmed.endsWith('?') &&"],
]);
patch('src/lib/chatEstimator/extractors.ts', [
  ["  if (lastBotTopicId === 'surfaces' && surf.walls === undefined", "  const onlySurfaceWords = /^\\s*(?:(?:just|only|and|the|with|plus|also|,|&|\\+)\\s*)*(?:(?:walls?|ceilings?|trim|baseboards?|doors?)\\s*(?:,|and|&|\\+|\\/)?\\s*)+[.!]?\\s*$/i.test(text);\n  if ((lastBotTopicId === 'surfaces' || onlySurfaceWords) && surf.walls === undefined"],
  ["  if (/\\b(this month|within a month|next few weeks|couple weeks|next month|", "  if (/\\b(?:a\\s+)?(?:few|couple(?: of)?|several)\\s+months?\\b|\\bnext\\s+(?:two|three|2|3|few)\\s+months\\b/.test(t)) {\n    return 'no_rush';\n  }\n  if (/\\b(this month|within a month|next few weeks|couple weeks|next month|"],
]);
console.log('ok');
