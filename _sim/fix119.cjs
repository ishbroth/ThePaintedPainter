const fs = require('fs');
const f = 'src/index.css';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = "  .nav a {\n    font-size: 0.66rem;\n    letter-spacing: 0.6px;\n  }";
if (!t.includes(a)) throw new Error('nf');
t = t.replace(a, () => "  .nav a {\n    font-size: 0.76rem;\n    letter-spacing: 0.5px;\n  }");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
