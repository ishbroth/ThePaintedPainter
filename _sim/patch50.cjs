const fs = require('fs');
const f = 'src/lib/chatEstimator/derivation.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n'); t = t.split('\r\n').join('\n');
const a = "\s+ceiling/.test(t);\n    if (oneRoom && !wholeHome)";
if (!t.includes(a)) throw new Error('nf');
t = t.replace(a, () => "\s+ceiling|\b(?:vaulted|cathedral|soaring)\s+(?:living|family|great|dining|kitchen|foyer|entry|entryway|master)\b/.test(t);\n    if (oneRoom && !wholeHome)");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
