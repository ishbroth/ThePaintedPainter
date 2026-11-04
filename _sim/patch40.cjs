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
  ["    if (Object.keys(neg).length > 0) out.push({ patch: { ...neg, surfacesAddressed: true }, reason: 'Customer ruled out surfaces' });",
   "    // ruling out the walls, or several surfaces, settles the scope; ruling out only the trim (say) leaves the ceilings and doors open\n    const settles = neg.interiorWalls === 'no' || Object.keys(neg).length >= 2;\n    if (Object.keys(neg).length > 0) out.push({ patch: { ...neg, ...(settles ? { surfacesAddressed: true } : {}) }, reason: 'Customer ruled out surfaces' });"],
]);
patch('src/lib/chatEstimator/extractors.ts', [
  ["export function extractColorChange(text: string): 'same' | 'different' | 'dramatic' | null {\n  const t = text.toLowerCase();",
   "export function extractColorChange(text: string): 'same' | 'different' | 'dramatic' | null {\n  const t = text.toLowerCase();\n  // \"walls same color, ceiling dark to light\": the dramatic change belongs to the ceiling, not the walls\n  if (/\\bceilings?\\b[^.;\\n]{0,45}?(dark(?:er)?\\s+to\\s+(?:light|white)|light(?:er)?\\s+to\\s+dark|dramatic)/.test(t) && /\\bwalls?\\b[^.;\\n]{0,30}?(same\\s+(?:\\w+\\s+)?colou?r|staying|keep|no\\s+change)/.test(t)) return 'same';"],
]);
console.log('ok');
