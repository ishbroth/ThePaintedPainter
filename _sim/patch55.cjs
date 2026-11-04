const fs = require('fs');
const f = 'src/index.css';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n'); t = t.split('\r\n').join('\n');
function rep(a, b, all) { if (!t.includes(a)) throw new Error('nf ' + a.slice(0, 50)); t = all ? t.split(a).join(b) : t.replace(a, () => b); }
rep("background: url('/hero-collage.jpg') center / contain no-repeat;", "background: url('/hero-collage.jpg') center top / contain no-repeat;");
rep("(var(--box-h) - var(--hero-s)) / 2 + var(--hero-s) * 0.76 - 40px", "var(--hero-s) * 0.76 - 40px", true);
rep("/* The collage is a square of side S (the smaller of the screen width and the space below the header), centred in that space.", "/* The collage is a square of side S (the smaller of the screen width and the space below the header), centred across and starting right under the header.");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
