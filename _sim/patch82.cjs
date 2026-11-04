const fs = require('fs');
const f = 'src/index.css';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = ".about-text {\n  text-align: center;\n  padding: 45px 20px;\n  color: var(--text-primary);\n}";
if (!t.includes(a)) throw new Error('nf');
t = t.replace(a, () => ".about-text {\n  text-align: center;\n  padding: 45px 20px;\n  color: var(--text-primary);\n  /* the background picture shows through the page: a soft frosted backing keeps this text readable */\n  background: rgba(255, 255, 255, 0.78);\n  -webkit-backdrop-filter: blur(6px);\n  backdrop-filter: blur(6px);\n}");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
