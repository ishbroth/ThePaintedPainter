const fs = require('fs');
const f = 'src/lib/chatEstimator/chatEngine.ts';
let t = fs.readFileSync(f, 'utf8');
const BS = String.fromCharCode(92);
const bad = "new RegExp('" + BS + "b(?:no|without|skip|not)" + BS + "s+(?:the" + BS + "s+)?' + word + '" + BS + "b')";
const good = "new RegExp('" + BS + BS + "b(?:no|without|skip|not)" + BS + BS + "s+(?:the" + BS + BS + "s+)?' + word + '" + BS + BS + "b')";
if (!t.includes(bad)) throw new Error('nf');
t = t.replace(bad, () => good);
fs.writeFileSync(f, t);
