const fs = require('fs');
const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
function patch(file, edits) {
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes(CR + LF);
  let t = raw.split(CR + LF).join(LF);
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 80));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split(LF).join(CR + LF) : t);
}
patch('src/lib/estimateEngine.ts', [[`    const surfaces = ['walls', 'ceilings', 'trim'];
    const wantedWalls = ctx.interiorWalls !== 'no';
    const wantedCeil = ctx.interiorCeilings === 'yes';
    const wantedTrim = ctx.interiorTrim === 'yes';
    const included = surfaces.filter(has).length;
    const wanted = [wantedWalls, wantedCeil, wantedTrim].filter(Boolean).length;
    const skipped = Math.max(0, 3 - included);
    if (included > 0 && skipped > 0 && (included < wanted || wanted < 3)) {
      const base = lineItems.filter((l) => l.key && surfaces.includes(l.key)).reduce((s, l) => s + l.amount, 0);
      const extra = base * Math.min(0.12, 0.05 * (has('walls') ? skipped : skipped + 0.4));
      if (extra > 1) lineItems.push({ category: 'Prep Work', description: 'Masking & protecting surfaces left unpainted', amount: extra });
    }`,
`    const surfaces = ['walls', 'ceilings', 'trim'];
    const included = surfaces.filter(has);
    // surfaces the customer wanted that were then taken off the price
    const takenOff = surfaces.filter((s) => ctx.excludedItems.includes(s));
    const wallsMissing = !has('walls') && ctx.interiorWalls === 'no';
    if (included.length > 0 && (takenOff.length > 0 || wallsMissing)) {
      const base = lineItems.filter((l) => l.key && surfaces.includes(l.key)).reduce((s, l) => s + l.amount, 0);
      // trim or ceilings without the walls is the fussiest: the walls and floors have to be taped off and covered
      const extra = base * Math.min(0.12, 0.05 * Math.max(takenOff.length, 1) + (wallsMissing ? 0.03 : 0));
      if (extra > 1) lineItems.push({ category: 'Prep Work', description: 'Masking & protecting surfaces left unpainted', amount: extra });
    }`]]);
console.log('ok');
