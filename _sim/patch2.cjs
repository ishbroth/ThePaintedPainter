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
patch('src/lib/marketPricingData.ts', [
  ["    per_sqft: 12.50,               // cabinet face per sqft", "    per_sqft: 12.50,               // cabinet face per sqft\n    per_door: 90,                  // per door/drawer-front equivalent (guides: $70-125 a door, drawers about half)\n    kitchen_setup: 315,            // removing doors, degloss, masking the kitchen: fixed time whatever the door count"],
]);
patch('src/lib/pricing/resolvedBaseRates.ts', [
  ["    per_sqft: c.per_sqft,", "    per_sqft: c.per_sqft,\n    per_door: c.per_door,\n    kitchen_setup: c.kitchen_setup,"],
]);
patch('src/lib/estimateEngine.ts', [
  ["    if (ctx.interiorColorChange === 'different' && ctx.accentWalls !== 'yes') {", "    if (ctx.interiorColorChange === 'different' && ctx.accentWalls !== 'yes' && ctx.interiorWalls !== 'no' && !off('walls')) {"],
  ["        amount: extraCoatSqFt * BASE_RATES.interior.walls_repaint * regionalMult,\n      });", "        amount: extraCoatSqFt * BASE_RATES.interior.walls_repaint * regionalMult * volEff,\n      });"],
  ["    if (ctx.colorChangeScope === 'multiple_colors' && ctx.colorCount && ctx.colorCount > 2) {\n      const extraColors = Math.min(ctx.colorCount - 2, 6);\n      lineItems.push({\n        category: 'Interior',\n        description: `Multi-Color Cut-In (${ctx.colorCount} colors)`,\n        amount: extraColors * 0.05 * effectiveWallSqFt * BASE_RATES.interior.walls_repaint * regionalMult,\n      });",
   "    if (ctx.colorChangeScope === 'multiple_colors' && ctx.colorCount && ctx.colorCount > 2 && ctx.interiorWalls !== 'no' && !off('walls')) {\n      const extraColors = Math.min(ctx.colorCount - 2, 8);\n      // each extra color: its own gallon, roller and set-up plus taping between colors. Guides put an extra color\n      // at about $100-200; the area-based figure scales the same cost with the size of the home. Blend the two.\n      const flat = extraColors * 140;\n      const byArea = extraColors * 0.05 * effectiveWallSqFt * BASE_RATES.interior.walls_repaint;\n      lineItems.push({\n        category: 'Interior',\n        description: `Multi-Color Cut-In (${ctx.colorCount} colors)`,\n        amount: ((flat + byArea) / 2) * regionalMult,\n      });"],
]);
patch('src/lib/chatEstimator/defaultAssumptions.ts', [
  ["    out.push({\n      label: 'Power wash prior to paint',", "    if (ctx.exteriorBody !== 'no') out.push({\n      label: 'Power wash prior to paint',"],
  ["    out.push({\n      label: 'Spot-prime bare wood / failing paint',\n      reason: 'Any areas of bare wood or peeling paint get spot primer before finish coats.',\n    });\n    if (ctx.sidingType === 'stucco' || !ctx.sidingType) {", "    if (ctx.exteriorBody !== 'no') out.push({\n      label: 'Spot-prime bare wood / failing paint',\n      reason: 'Any areas of bare wood or peeling paint get spot primer before finish coats.',\n    });\n    if (ctx.exteriorBody !== 'no' && (ctx.sidingType === 'stucco' || !ctx.sidingType)) {"],
]);
console.log('ok');
