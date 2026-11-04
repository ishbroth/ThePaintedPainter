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

patch('src/lib/types.ts', [
  ["  deckSqft: number | null; // deck area, when given\n", "  deckSqft: number | null; // deck area, when given\n  overhangSqft: number | null; // porch ceiling / patio cover area, when given\n"],
]);
patch('src/lib/chatEstimator/defaultContext.ts', [
  ["cabinetDoorCount: null, deckSqft: null, pressureWashSqft: null,", "cabinetDoorCount: null, deckSqft: null, overhangSqft: null, pressureWashSqft: null,"],
]);
patch('src/lib/estimateEngine.ts', [
  ["      const overhangSqFt = Math.round(Math.sqrt(sqft / (ctx.stories || 1)) * 4 * 3); // perimeter * 3ft depth",
   "      const overhangSqFt = ctx.overhangSqft || Math.round(Math.sqrt(sqft / (ctx.stories || 1)) * 4 * 3); // perimeter * 3ft depth"],
  ["        description: 'Overhangs / Patio Covers',", "        description: ctx.overhangSqft ? `Porch Ceiling / Patio Cover (${overhangSqFt} sq ft)` : 'Overhangs / Patio Covers',"],
  // vacant rentals are a spray-and-go turnover: published turnover prices run about half of an owner-occupied repaint
  ["    multipliers.push({ label: 'Standard Turnover Finish (rental/pre-sale)', factor: 0.93 });",
   "    // An empty unit needs no furniture moving or protecting and is usually sprayed: published unit-turn prices\n    // ($1.50-3.00 per sq ft) run well under an owner-occupied repaint ($2-6).\n    multipliers.push({ label: 'Standard Turnover Finish (rental/pre-sale)', factor: ctx.occupancy === 'vacant' ? 0.78 : 0.93 });"],
]);
patch('src/lib/chatEstimator/derivation.ts', [
  ["  // Patio furniture: count the pieces so each is priced",
   String.raw`  // Porch work: the ceiling is an overhang, the floor is deck-type surface
  if (/\bporch\b/.test(t) && ctx.overhangSqft == null) {
    const ceilingM = t.match(/(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|square\s*f(?:ee|oo)t)[^.]{0,30}ceiling|ceiling[^.]{0,40}?(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|square\s*f(?:ee|oo)t)/);
    const porchArea = ceilingM ? num(ceilingM[1] || ceilingM[2]) : 0;
    const patch: Partial<EstimatorContext> = {};
    if (/\bceiling\b/.test(t)) { patch.overhangs = 'yes'; if (porchArea >= 20 && porchArea <= 3000) patch.overhangSqft = porchArea; }
    if (/\b(floor|decking|steps?)\b/.test(t) && ctx.deck !== 'yes') { patch.deck = 'yes'; if (porchArea >= 20 && ctx.deckSqft == null) patch.deckSqft = porchArea; }
    if (Object.keys(patch).length > 0) out.push({ patch, reason: 'Porch ceiling and floor' });
  }

  // Patio furniture: count the pieces so each is priced`],
]);
console.log('ok');
