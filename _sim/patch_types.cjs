const fs = require('fs');
const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
function patch(file, edits) {
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes(CR + LF);
  let t = raw.split(CR + LF).join(LF);
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 70));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split(LF).join(CR + LF) : t);
}
patch('src/lib/types.ts', [
  ["  multiPhaseRequested: string; // '' (no signal), yes\n", `  multiPhaseRequested: string; // '' (no signal), yes
  // Customer-supplied measurements and scope trims. Left null/empty unless the customer said them.
  trimLinearFeet: number | null; // "about 300 linear feet of baseboard"
  crownLinearFeet: number | null;
  accentWallCount: number | null; // how many accent walls ("two accent walls", "one per bedroom")
  stairRailFeet: number | null; // length of stair railing, when given
  popcornCeilingSqft: number | null; // ceiling area to de-texture, when given
  cabinetDoorCount: number | null; // kitchen doors + drawer fronts, when given
  deckSqft: number | null; // deck area, when given
  pressureWashSqft: number | null; // area to pressure wash, when it isn't just the house
  /** Whether the house body itself (siding/stucco/brick) is part of an exterior job. 'no' = only the listed features (fence, deck, shutters, doors, trim, washing...). */
  exteriorBody: string; // '' (not discussed), yes, no
  /** Price editing: rooms and main items the customer took off the price after seeing it. */
  excludedRooms: string[];
  excludedItems: string[];
`],
  ["export interface EstimateLineItem {\n  category: string;\n  description: string;\n  amount: number;\n}", "export interface EstimateLineItem {\n  category: string;\n  description: string;\n  amount: number;\n  /** Stable id for main items the customer can take off / add back (undefined = not removable: surcharges, prep, adjustments). */\n  key?: string;\n}"],
  ["  confidenceNote: string;\n}", "  confidenceNote: string;\n  /** Set when a multi-room job earned a volume rate (e.g. 0.82 = about 18% off per-square-foot interior pricing). */\n  volumeEfficiency?: number;\n}"],
]);
patch('src/lib/chatEstimator/defaultContext.ts', [
  ["    trimLinearFeet: null, crownLinearFeet: null, accentWallCount: null, stairRailFeet: null, popcornCeilingSqft: null,\n", "    trimLinearFeet: null, crownLinearFeet: null, accentWallCount: null, stairRailFeet: null, popcornCeilingSqft: null,\n    cabinetDoorCount: null, deckSqft: null, pressureWashSqft: null,\n"],
]);
console.log('ok');
