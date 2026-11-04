const fs = require('fs');
const f = 'src/lib/chatEstimator/extractors.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const from = "  if (surf.walls === 'yes' && surf.trim === 'no') acks.push('walls only');";
if (!t.includes(from)) throw new Error('nf');
t = t.replace(from, "  if (surf.walls === 'yes' && surf.trim === 'no') {\n    const named = [surf.walls === 'yes' ? 'walls' : '', surf.ceilings === 'yes' ? 'ceilings' : '', surf.doors === 'yes' ? 'doors' : ''].filter(Boolean);\n    acks.push(named.length === 1 ? 'walls only' : named.join(' and ') + ', no trim');\n  }");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
