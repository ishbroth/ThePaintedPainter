const fs = require('fs');
const f = 'src/App.tsx';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = "            <Header />\n            <ThemeToggle />\n";
if (!t.includes(a)) throw new Error('nf');
t = t.replace(a, "            <ThemeToggle />\n            <Header />\n");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
