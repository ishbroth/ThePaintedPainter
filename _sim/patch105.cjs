const fs = require('fs');
const f = 'src/index.css';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = "  background: url('/hero-title.png') 0 0 / 100% 100% no-repeat;\n  opacity: var(--hero-title-opacity, 1);\n}";
if (!t.includes(a)) throw new Error('nf');
t = t.replace(a, () => a + "\n\n/* Light mode: the picture is washed out, so white lettering needs a soft dark edge to stand out solidly (it fades with the lettering). */\n[data-theme=\"light\"] .site-hero-bg--home .site-hero-bg__title {\n  filter: drop-shadow(0 0 1.5px rgba(20, 20, 30, 0.85)) drop-shadow(0 2px 5px rgba(20, 20, 30, 0.6));\n}");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
