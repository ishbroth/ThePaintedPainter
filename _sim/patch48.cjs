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

const NEW_FN = String.raw`export function extractCeilingHeight(text: string): 'nine_foot' | 'ten_plus' | 'vaulted_mixed' | null {
  const t = text.toLowerCase();
  const WORDS: Record<string, number> = { nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, eighteen: 18, twenty: 20 };
  const num = (s: string) => (WORDS[s] ?? parseInt(s, 10));
  const fromFeet = (n: number): 'nine_foot' | 'ten_plus' | 'vaulted_mixed' | null =>
    n >= 12 && n <= 40 ? 'vaulted_mixed' : n >= 10 && n < 12 ? 'ten_plus' : n === 9 ? 'nine_foot' : null;
  if (/\b(vaulted|cathedral|double[\s-]height|two[\s-]stor(?:y|ey)\s+(?:foyer|entry|entryway|living room|great room|ceiling)|soaring|loft(?:ed)? ceilings?|beamed vaulted)\b/.test(t)) return 'vaulted_mixed';
  // "12 foot ceilings", "twelve-foot ceilings", "10' ceilings", "ceilings are 10 feet", "ceilings about 9 ft"
  const NUM = '(\\d{1,2}|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|eighteen|twenty)';
  const a = t.match(new RegExp(NUM + "\\s*(?:-|\\s)?(?:f(?:oo|ee)?t|')\\s*(?:tall\\s+|high\\s+)?ceilings?\\b"));
  const b = t.match(new RegExp("\\bceilings?\\s*(?:are|is|run|go|measure|about|around|at|of|:)?\\s*(?:about\\s+|around\\s+|roughly\\s+)?" + NUM + "\\s*(?:-|\\s)?(?:f(?:oo|ee)?t|')"));
  const feet = a ? num(a[1]) : b ? num(b[1]) : NaN;
  if (isFinite(feet)) {
    const h = fromFeet(feet);
    if (h) return h;
  }
  // "high ceilings", "tall ceilings", "ceilings are really high", "extra tall walls", "10+ foot", "need a tall ladder for the ceilings"
  if (/\b(?:high|tall|extra[\s-]tall|lofty|really high|very high|super high|nine[\s-]foot|9[\s-]foot)\s+ceilings?\b|\bceilings?\s+(?:are|is)\s+(?:really\s+|very\s+|pretty\s+|kind of\s+|fairly\s+|quite\s+)?(?:high|tall)\b|\b(?:tall|high)\s+walls\b|\bhigher than (?:normal|standard|usual)\b/.test(t)) {
    return /\b(?:9[\s-]foot|nine[\s-]foot)\b/.test(t) ? 'nine_foot' : 'ten_plus';
  }
  if (/\b(10|ten)[\s-]?(?:\+|plus)\s*f(?:oo|ee)?t\b/.test(t)) return 'ten_plus';
  return null;
}`;

let f = fs.readFileSync('src/lib/chatEstimator/extractors.ts', 'utf8');
const crlf = f.includes('\r\n');
f = f.split('\r\n').join('\n');
const a = f.indexOf('export function extractCeilingHeight');
const end = f.indexOf('\n}\n', a) + 3;
f = f.slice(0, a) + NEW_FN + '\n' + f.slice(end);
fs.writeFileSync('src/lib/chatEstimator/extractors.ts', crlf ? f.split('\n').join('\r\n') : f);

// engine: tall ceilings cost more to reach than the extra wall area alone shows
patch('src/lib/estimateEngine.ts', [
  ["    const volEff = volumeEfficiency(effectiveWallSqFt);",
   "    const volEff = volumeEfficiency(effectiveWallSqFt);\n    // Reaching tall ceilings (ladders, planks or a lift, slower cutting-in) adds labor beyond the extra wall area itself.\n    const tallCeilingFactor = ctx.ceilingHeight === 'vaulted_mixed' ? LABOR_COMPLEXITY.vaulted : ctx.ceilingHeight === 'ten_plus' ? LABOR_COMPLEXITY.tall_ceiling : ctx.ceilingHeight === 'nine_foot' ? 1.05 : 1;\n    const tallWallFactor = 1 + (tallCeilingFactor - 1) / 2;"],
  ["        amount: effectiveWallSqFt * wallRate * textureMultiplier * colorEfficiency * regionalMult * conditionMultiplier * volEff,", "        amount: effectiveWallSqFt * wallRate * textureMultiplier * colorEfficiency * regionalMult * conditionMultiplier * volEff * tallWallFactor,"],
  ["        amount: ceilingSqFt * ceilingRate * regionalMult * volEff,\n        key: 'ceilings',", "        amount: ceilingSqFt * ceilingRate * regionalMult * volEff * (ctx.ceilingType === 'vaulted' ? 1 : tallCeilingFactor),\n        key: 'ceilings',"],
]);
console.log('ok');
