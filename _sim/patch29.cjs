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
patch('src/lib/chatEstimator/derivation.ts', [
  ["import { estimateHouseLayout } from '../surfaceAreaEngine';", "import { estimateHouseLayout } from '../surfaceAreaEngine';\nimport { hasScopeLimiter } from './scopeWords';"],
  ["  const hasOnly = /\\b(only|just|nothing else|that'?s (?:all|it))\\b/.test(t);", "  const hasOnly = hasScopeLimiter(t);"],
]);
patch('src/lib/chatEstimator/extractors.ts', [
  ["    !/\\b(only|just)\\b/i.test(text);\n  if (rooms.length > 0 && describesWholeHome", "    !hasScopeLimiter(text);\n  if (rooms.length > 0 && describesWholeHome"],
  ["import { extractTiming, timelineFromStart } from './dateParsing';", "import { extractTiming, timelineFromStart } from './dateParsing';\nimport { hasScopeLimiter } from './scopeWords';"],
]);
console.log('ok');
