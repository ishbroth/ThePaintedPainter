const fs = require('fs');
const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
function patch(file, edits) {
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes(CR + LF);
  let t = raw.split(CR + LF).join(LF);
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 90));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split(LF).join(CR + LF) : t);
}

patch('src/lib/surfaceAreaEngine.ts', [
  ["  bedroom_4: {\n    label: 'Bedroom (Small)',\n    widthFt: 10, lengthFt: 10,\n    wallSqFt: 272,\n    ceilingSqFt: 100,\n    trimLinearFt: 36,\n    doors: 1, windows: 1, closets: 1,\n  },",
    "  bedroom_4: {\n    label: 'Bedroom (Small)',\n    widthFt: 10, lengthFt: 10,\n    wallSqFt: 272,\n    ceilingSqFt: 100,\n    trimLinearFt: 36,\n    doors: 1, windows: 1, closets: 1,\n  },\n  bedroom_5: {\n    label: 'Bedroom',\n    widthFt: 12, lengthFt: 12,\n    wallSqFt: 336,\n    ceilingSqFt: 144,\n    trimLinearFt: 44,\n    doors: 1, windows: 1, closets: 1,\n  },"],
  ["  if (beds >= 5) rooms.push('bedroom_2'); // extra bedrooms use standard size", "  if (beds >= 5) rooms.push('bedroom_5'); // extra bedrooms use standard size"],
]);

patch('src/lib/estimateEngine.ts', [
  // share of rooms still in scope, used to scale room-count based items
  ["  const trimShare = fullLayout.totalTrimLinFt > 0 ? layout.totalTrimLinFt / fullLayout.totalTrimLinFt : 1;",
    "  const trimShare = fullLayout.totalTrimLinFt > 0 ? layout.totalTrimLinFt / fullLayout.totalTrimLinFt : 1;\n  const roomShare = fullLayout.rooms.length > 0 ? layout.rooms.length / fullLayout.rooms.length : 1;\n  const roomGone = (r: string) => ctx.excludedRooms.includes(r);\n  const allBathsGone = fullLayout.rooms.filter((r) => r.startsWith('bathroom')).every(roomGone) && fullLayout.rooms.some((r) => r.startsWith('bathroom'));"],
  // cabinets follow their rooms
  ["      const locations = (ctx.cabinetLocations.length > 0 ? ctx.cabinetLocations : inferred).filter((l) => !off(`cabinets:${l}`));",
    "      const locations = (ctx.cabinetLocations.length > 0 ? ctx.cabinetLocations : inferred).filter(\n        (l) => !off(`cabinets:${l}`) && !(l === 'kitchen' && roomGone('kitchen')) && !(l === 'bathroom' && allBathsGone) && !(l === 'laundry' && roomGone('laundry')),\n      );"],
  // multi-color count follows rooms
  ["    if (ctx.colorChangeScope === 'multiple_colors' && ctx.colorCount && ctx.colorCount > 2 && ctx.interiorWalls !== 'no' && !off('walls')) {\n      const extraColors = Math.min(ctx.colorCount - 2, 8);",
    "    const colorsLeft = ctx.colorCount ? Math.max(2, Math.round(ctx.colorCount * roomShare)) : 0;\n    if (ctx.colorChangeScope === 'multiple_colors' && colorsLeft > 2 && ctx.interiorWalls !== 'no' && !off('walls')) {\n      const extraColors = Math.min(colorsLeft - 2, 8);"],
  ["        description: `Multi-Color Cut-In (${ctx.colorCount} colors)`,", "        description: `Multi-Color Cut-In (${colorsLeft} colors)`,"],
  // popcorn + wallpaper rooms scale
  ["    const rooms = ctx.popcornCeilingRooms || 1;\n    // Average room ~150 sqft of ceiling, unless the customer gave the area\n    const pcSqft = ctx.popcornCeilingSqft || rooms * 150;",
    "    const rooms = Math.max(1, Math.round((ctx.popcornCeilingRooms || 1) * (ctx.popcornCeilingSqft ? 1 : roomShare)));\n    // Average room ~150 sqft of ceiling, unless the customer gave the area\n    const pcSqft = ctx.popcornCeilingSqft ? Math.round(ctx.popcornCeilingSqft * roomShare) : rooms * 150;"],
  ["    const rooms = ctx.wallpaperRooms || 1;\n    // Average room ~300 sqft of wall", "    const rooms = Math.max(1, Math.round((ctx.wallpaperRooms || 1) * roomShare));\n    // Average room ~300 sqft of wall"],
]);

// export an editable-rooms helper at the end of estimateEngine
let f = fs.readFileSync('src/lib/estimateEngine.ts', 'utf8');
const crlf = f.includes(CR + LF);
f = f.split(CR + LF).join(LF);
f += `
// ===== Rooms the customer can take off the price =====

export interface EditableRoom {
  key: string;
  label: string;
}

/**
 * The rooms in this price, so the customer can drop one. A whole-home job uses the typical room mix for the
 * home's size (the same assumption the price is built on); a job for named rooms uses those rooms.
 */
export function getEditableRooms(ctx: EstimatorContext): EditableRoom[] {
  if (ctx.projectType === 'exterior') return [];
  const sqft = ctx.squareFeet || estimateSqftFromBedrooms(ctx.bedroomCount) || 1500;
  const base = { ...ctx, excludedRooms: [] as string[] };
  const keys =
    ctx.interiorScope === 'specific_rooms' && ctx.selectedRooms.length > 0
      ? ctx.selectedRooms
      : ctx.interiorWalls === 'no' && ctx.interiorCeilings !== 'yes' && ctx.interiorTrim !== 'yes'
      ? []
      : getLayout(base, sqft).rooms;
  if (keys.length < 2) return []; // a single room can't be taken off; remove its items instead
  const counts: Record<string, number> = {};
  return keys.map((key) => {
    const spec = STANDARD_ROOMS[key];
    const label = spec?.label ?? key.replace(/_/g, ' ');
    counts[label] = (counts[label] || 0) + 1;
    return { key, label };
  }).map((r, i, all) => {
    const same = all.filter((x) => x.label === r.label);
    return same.length > 1 ? { ...r, label: \`\${r.label} \${same.indexOf(r) + 1}\` } : r;
  });
}
`;
fs.writeFileSync('src/lib/estimateEngine.ts', crlf ? f.split(LF).join(CR + LF) : f);
console.log('ok');
