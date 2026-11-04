const fs = require('fs');
const f = 'src/index.css';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
function rep(a, b) { if (!t.includes(a)) throw new Error('nf ' + a.slice(0, 60)); t = t.replace(a, () => b); }
rep("  width: var(--hero-w, 120vw);\n  height: var(--hero-h, 112vh);\n  margin-left: calc(var(--hero-w, 120vw) / -2);\n  /* stretched on purpose: it fills the box even when the proportions aren't exact */\n  background: url('/hero-collage.jpg') 0 0 / 100% 100% no-repeat;",
    "  /* a square, so the collage keeps its true proportions; a little wider than the screen, centred on Superman */\n  width: var(--hero-size, 106vw);\n  height: var(--hero-size, 106vw);\n  margin-left: calc(var(--hero-size, 106vw) / -2);\n  background: url('/hero-collage.jpg') 0 0 / 100% 100% no-repeat;");
rep("/* Hero background: the whole collage (the houses around Superman) as a translucent image stretched to fill the screen (a little\n   past the edges is fine). It starts at the very top of the page, where the header is, and moves in proportion to how far the\n   page is scrolled: SiteBackground sets --hero-w / --hero-h (its size), --hero-shift (how far it has moved up) and\n   --hero-spacer (where the estimator card starts, just under Superman's body). A pre-blurred copy fills any gap. */",
    "/* Hero background: the whole collage (the houses around Superman) as a translucent image at its true proportions, scaled so its\n   width fills the screen and spills a little past both sides (and usually past the bottom). It starts at the very top of the\n   page, where the header is, and moves up in proportion to how far the page is scrolled. SiteBackground sets --hero-size (its\n   side), --hero-shift (how far it has moved up) and --hero-spacer (where the estimator card starts, under Superman's body).\n   A pre-blurred copy fills any gap on tall, narrow screens. */");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
console.log('ok');
