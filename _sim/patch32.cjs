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
  ["|\d{1,3}\s+(?:\w+[\s-]+){0,3}units?\b|property manager)", "|(?:[2-9]|\d{2,3})\s+(?:(?!bed)\w+[\s-]+){0,3}units?\b|property manager)"],
]);
patch('src/lib/surfaceAreaEngine.ts', [
  ["  // Always have these\n  rooms.push('living_room', 'kitchen', 'hallway', 'entryway');",
   "  // A studio (small, no bedroom count) is one main room, a kitchen and a bath — not a house layout with halls and a foyer.\n  if (sqft <= 600 && !bedrooms) {\n    rooms.push('living_room', 'kitchen', 'bathroom_2');\n  } else {\n  // Always have these\n  rooms.push('living_room', 'kitchen', 'hallway', 'entryway');"],
  ["  if (sqft >= 1200) rooms.push('laundry');", "  if (sqft >= 1200) rooms.push('laundry');\n  }"],
]);
console.log('ok');
