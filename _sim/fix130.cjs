const fs = require('fs');
const f = 'src/lib/chatEstimator/extractors.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
function rep(a, b) { if (!t.includes(a)) throw new Error('NF ' + a.slice(0, 60)); t = t.replace(a, () => b); }
rep("export function extractSidingType(\n  text: string,\n): ", "export function extractSidingType(\n  text: string,\n  answeringSiding = false,\n): ");
rep("  if (/\\bstone\\b/.test(t)) return 'stone';\n  return null;\n}\n\nexport function extractCeilingType", "  if (/\\bstone\\b/.test(t)) return 'stone';\n  // right after \"what's it made of?\" a bare material is the answer\n  if (answeringSiding) {\n    if (/\\bwood(?:en)?\\b/.test(t)) return 'wood';\n    if (/\\bvinyl\\b/.test(t)) return 'vinyl';\n    if (/\\b(?:aluminum|aluminium|metal)\\b/.test(t)) return 'aluminum';\n  }\n  return null;\n}\n\nexport function extractCeilingType");
rep("  const siding = extractSidingType(text);", "  const siding = extractSidingType(text, lastBotTopicId === 'siding');");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
console.log('ok');
