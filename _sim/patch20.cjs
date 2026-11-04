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
  ["  if (/\\bbuilt[\\s-]?ins?\\b|\\bbuilt[\\s-]?in (?:bookshelf|bookshelves|shelving|cabinetry)\\b/.test(t)) out.builtIns = true;",
   "  // \"no built-ins\" / \"without the built-ins\" is the opposite of asking for them\n  if (/\\bbuilt[\\s-]?ins?\\b|\\bbuilt[\\s-]?in (?:bookshelf|bookshelves|shelving|cabinetry)\\b/.test(t) && !/\\b(?:no|not|without|except|excluding|skip|don'?t need|not including)\\s+(?:the\\s+|any\\s+|our\\s+)?built[\\s-]?ins?\\b/.test(t)) out.builtIns = true;"],
]);
patch('src/lib/chatEstimator/chatEngine.ts', [
  ["  const { intent, patch, acknowledgements } = await understand(trimmed, state);", "  const understood = await understand(trimmed, state);\n  const { intent, patch } = understood;\n  // the same fact can come back from more than one reader (\"450 sqft, 450 sqft\"): say each once\n  const acknowledgements = Array.from(new Set(understood.acknowledgements));"],
]);
console.log('ok');
