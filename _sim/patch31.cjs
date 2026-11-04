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
  ["!/\\b(walls?|trim|baseboards?)\\b/.test(t) && ctx.interiorWalls !== 'no') {\n    const noPaint", "!/\\b(walls?|trim|baseboards?)\\b/.test(t.replace(/no walls?/g, '')) && (ctx.interiorCeilings !== 'no' || ctx.interiorWalls !== 'no' || ctx.interiorTrim !== 'no')) {\n    const noPaint"],
  ["  if (ctx.exteriorBody === '' && (ctx.projectType === 'exterior' || ctx.projectType === 'both' || !ctx.projectType)) {",
   "  if (ctx.exteriorBody === '' && (ctx.projectType === 'exterior' || ctx.projectType === 'both' || (!ctx.projectType && !mentionsIndoorRoom))) {"],
]);
patch('src/lib/chatEstimator/extractors.ts', [
  ["  if (/\\b(multi[\\s-]?unit|apartment (?:complex|building)|\\d+[\\s-]?unit building|several units|multiple units)\\b/.test(t)) {\n    return 'multi_unit';\n  }",
   "  if (/\\b(multi[\\s-]?unit|apartment (?:complex|building)|\\d+[\\s-]?unit building|several units|multiple units|\\d{1,3}\\s+(?:\\w+[\\s-]+){0,3}units?\\b|property manager)\\b/.test(t)) {\n    return 'multi_unit';\n  }\n  if (/\\b(restaurant|cafe|coffee shop|bakery|salon|barber ?shop|spa|gym|fitness|church|chapel|clinic|dental|dentist|medical (?:office|practice)|warehouse|retail|storefront|boutique|showroom|brewery|daycare|day care|our business|my business|our store|my store|our shop|my shop|our office|my office suite)\\b/.test(t)) {\n    return 'commercial';\n  }"],
]);
console.log('ok');
