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
  ["  ceilingHeight: string; // standard, nine_foot, ten_plus, vaulted_mixed\n", "  ceilingHeight: string; // standard, nine_foot, ten_plus, vaulted_mixed\n  /** Share of the painted area that has the taller ceilings (\"high ceilings in the living room\" = a part, \"throughout\" = all). null = all of it. */\n  tallCeilingShare: number | null;\n"],
]);
patch('src/lib/chatEstimator/defaultContext.ts', [
  ["ceilingHeight: 'standard',", "ceilingHeight: 'standard', tallCeilingShare: null,"],
]);
patch('src/lib/estimateEngine.ts', [
  ["    const heightRatio = ceilingHeight / 8;", "    // taller ceilings may apply to only one room (\"high ceilings in the living room\")\n    const tallShare = ctx.tallCeilingShare ?? 1;\n    const heightRatio = 1 + (ceilingHeight / 8 - 1) * tallShare;"],
  ["    const tallWallFactor = 1 + (tallCeilingFactor - 1) / 2;", "    const tallWallFactorRaw = 1 + (tallCeilingFactor - 1) / 2;\n    const tallWallFactor = 1 + (tallWallFactorRaw - 1) * tallShare;"],
  ["        amount: ceilingSqFt * ceilingRate * regionalMult * volEff * (ctx.ceilingType === 'vaulted' ? 1 : tallCeilingFactor),", "        amount: ceilingSqFt * ceilingRate * regionalMult * volEff * (ctx.ceilingType === 'vaulted' ? 1 : 1 + (tallCeilingFactor - 1) * tallShare),"],
]);
patch('src/lib/chatEstimator/derivation.ts', [
  ["  // Porch work: the ceiling is an overhang, the floor is deck-type surface",
   String.raw`  // Taller ceilings that are only in one room ("high ceilings in the living room") affect only part of the job
  if (ctx.ceilingHeight !== 'standard' && ctx.tallCeilingShare == null && ctx.interiorScope === 'whole_house') {
    const wholeHome = /\b(throughout|whole (?:house|home|place)|all (?:the )?(?:rooms|ceilings)|every (?:room|ceiling)|entire|everywhere|all of (?:it|them))\b/.test(t);
    const oneRoom = /\b(?:high|tall|vaulted|cathedral|soaring|\d{1,2}[\s-]?(?:foot|ft|')|twelve|ten|nine)[^.;\n]{0,25}?\b(?:in|for|on)\s+(?:the\s+|our\s+|my\s+)?(living|family|great|dining|kitchen|foyer|entry|entryway|master|stair|hall|den|office|bonus)\b|\b(?:living|family|great|dining|kitchen|foyer|entry|entryway|master|stair|stairwell|hall|den|office|bonus)\b[^.;\n]{0,30}?\b(?:high|tall|vaulted|cathedral|soaring)\s+ceiling/.test(t);
    if (oneRoom && !wholeHome) out.push({ patch: { tallCeilingShare: 0.35 }, reason: 'Tall ceilings in one room only' });
  }

  // Porch work: the ceiling is an overhang, the floor is deck-type surface`],
]);
console.log('ok');
