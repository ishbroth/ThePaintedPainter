const fs = require('fs');
let s = fs.readFileSync('docs/mobile-apps.md', 'utf8');
const crlf = s.includes('\r\n');
s = s.replace(/\r\n/g, '\n');
const i = s.indexOf('## Not done yet');
if (i < 0) throw new Error('marker');
s = s.slice(0, i) + fs.readFileSync('_sim/doc-section.md', 'utf8');
fs.writeFileSync('docs/mobile-apps.md', crlf ? s.replace(/\n/g, '\r\n') : s);
