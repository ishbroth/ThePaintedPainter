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
  ["  const NUM = '(?:\\\\d+(?:\\\\.\\\\d)?|one|two|three|four|five|six|seven|eight|nine|ten)';\n  const re = new RegExp(`\\\\b${NUM}\\\\s*(?:-|\\\\s)?\\\\s*(?:bed(?:room)?s?|br|bd|bath(?:room)?s?|ba)\\\\b`, 'gi');\n  return text.replace(re, ' ');",
   `  const NUM = '(?:\\\\d+(?:\\\\.\\\\d)?|one|two|three|four|five|six|seven|eight|nine|ten)';
  const hasBedCount = new RegExp(\`\\\\b\${NUM}\\\\s*(?:-|\\\\s)?\\\\s*(?:bed(?:room)?s?|br|bd)\\\\b\`, 'i').test(text);
  const homeWords = /\\b(house|home|apartment|condo|townhouse|townhome|unit|place|sq\\.?\\s?ft|square f)/i.test(text);
  // "Two bathrooms (one 5x8, one 8x10)" is two rooms, not a size description; likewise "one bedroom 12x14" is one room.
  const keepBaths = !hasBedCount && !homeWords;
  const roomWithDims = new RegExp(\`\\\\b(?:one|1)\\\\s*(?:-|\\\\s)?\\\\s*bed(?:room)?\\\\s+\\\\d{1,2}\\\\s*(?:x|by|×)\\\\s*\\\\d{1,2}\\\\b\`, 'i').test(text) && !homeWords;
  const re = new RegExp(
    \`\\\\b\${NUM}\\\\s*(?:-|\\\\s)?\\\\s*(?:\${roomWithDims ? '' : 'bed(?:room)?s?|br|bd|'}\${keepBaths ? '' : 'bath(?:room)?s?|ba'}\${keepBaths && roomWithDims ? 'zzzzz' : ''})\\\\b\`.replace('|)', ')').replace('(?:|', '(?:'),
    'gi',
  );
  if (keepBaths && roomWithDims) return text;
  return text.replace(re, ' ');`],
  ["    [/\\bnursery\\b|", "    [/\\b(?:two|2|both|three|3)\\s+(?:full\\s+)?bath(?:room)?s\\b/, 'bathroom_master'],\n    [/\\bnursery\\b|"],
]);
console.log('ok');
