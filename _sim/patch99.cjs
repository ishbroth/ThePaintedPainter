const fs = require('fs');
const f = 'src/index.css';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = ".map-section {\n  text-align: center;\n  padding: 45px 20px;\n}";
if (!t.includes(a)) throw new Error('nf');
t = t.replace(a, () => ".map-section {\n  text-align: center;\n  padding: 45px 20px;\n  /* a soft frosted backing keeps the text readable over the background picture */\n  background: rgba(255, 255, 255, 0.78);\n  -webkit-backdrop-filter: blur(6px);\n  backdrop-filter: blur(6px);\n}");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
