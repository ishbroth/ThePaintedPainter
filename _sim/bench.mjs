// Item-by-item price benchmark built from published 2026 contractor cost guides (Angi, HomeGuide, Homewyse, Fixr,
// estimators.us, local painter price pages, and for commercial: PPD Painting, Paintwerks, AllSource, DropCurb,
// Carolina Renew). All figures are NATIONAL, at market (no discount), USD. [low, typical, high].
// A scenario's expected price is the sum of its items (quantity x unit cost), scaled by region, with the
// minimum service charge as a floor. This is deliberately NOT a generic "whole job" range.

export const UNIT = {
  wallSqft: [1.0, 1.5, 2.0],          // per sq ft of wall, 2 coats, labor + paint
  ceilingSqft: [1.0, 2.0, 3.0],
  trimLF: [1.0, 3.0, 5.0],            // baseboard/casing per linear foot (paint, light prep)
  crownLF: [1.5, 3.5, 6.0],
  doorEach: [75, 125, 175],           // interior door, both sides
  closetDoorEach: [50, 100, 150],
  windowInteriorEach: [25, 75, 150],
  cabinetFront: [50, 90, 125],        // per door; a drawer front counts about 0.5-0.75 of a door
  cabinetSetup: [150, 315, 500],      // removing doors, degloss, masking: fixed
  vanity: [60, 200, 360],
  stairRailLF: [4, 8, 12],
  stairRailSpindleLF: [8, 14, 20],
  stairWalls: [250, 350, 450],        // one flight of stair walls ($350-450 national average stairway)
  wallpaperSqft: [1.0, 2.8, 5.0],
  popcornRemoveSqft: [1.0, 2.7, 3.5],
  accentWall: [100, 200, 400],
  extraColor: [100, 140, 200],
  sidingSqft: { vinyl: [1.5, 2.25, 3.0], wood: [2.0, 3.25, 4.5], stucco: [2.0, 3.0, 4.0], brick: [2.5, 3.75, 5.0], hardie: [2.0, 2.75, 3.75] },
  deckStainSqft: [1.5, 3.2, 5.5],
  deckPaintSqft: [3.0, 4.5, 6.0],
  fenceLF: [3.5, 7.0, 12.0],
  shutterEach: [45, 90, 235],
  frontDoor: [125, 200, 300],
  garageSingle: [150, 300, 550],
  garageDouble: [250, 400, 550],
  fasciaSoffitLF: [3, 4.5, 6],
  gutterLF: [2, 3.5, 5],
  windowTrimExteriorEach: [25, 75, 150],
  pressureWashSqft: [0.15, 0.30, 0.50],
  patioPiece: [75, 150, 350],
  paintOverPopcornSqft: [1.0, 1.5, 2.0],
  minimumJob: [250, 350, 500],
  // commercial: per sq ft of floor area
  commercialGeneral: [2.0, 3.5, 6.0],
  restaurant: [2.0, 4.0, 6.0],
  office: [2.0, 3.2, 4.5],
  medical: [2.5, 4.0, 8.5],
  warehouse: [1.5, 3.0, 6.0],
  retail: [2.0, 3.5, 6.0],
  turnoverUnit: { studio: [500, 800, 1200], br1: [500, 900, 2000], br2: [1500, 2200, 3000], br3: [1800, 3000, 4500] },
};

const ADD = { afterHours: [0.15, 0.25, 0.50] };

/** items: array of [unitKey (or [key, subkey]), quantity]. Optional multipliers: {afterHours:true, rush:true, lowVoc:true}. */
export function benchmark(items, regional = 1, mods = {}) {
  const sum = [0, 0, 0];
  for (const [key, qty] of items) {
    const u = Array.isArray(key) ? UNIT[key[0]][key[1]] : UNIT[key];
    for (let i = 0; i < 3; i++) sum[i] += u[i] * qty;
  }
  const mult = (i) => (mods.afterHours ? 1 + ADD.afterHours[i] : 1) * (mods.lowVoc ? 1.05 : 1);
  const scaled = sum.map((v, i) => v * regional * mult(i));
  const floor = UNIT.minimumJob.map((v) => v * regional);
  return scaled.map((v, i) => Math.max(v, floor[i]));
}
