const fs = require('fs');
const f = 'src/components/SiteBackground.tsx';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
function rep(a, b) { if (!t.includes(a)) throw new Error('nf ' + a.slice(0, 60)); t = t.replace(a, () => b); }

rep("/** Where Superman's body ends, as a share of the picture's height (the estimator card starts around there). */\nconst BODY_BOTTOM = 0.76;",
    "/** Where Superman's body ends, as a share of the picture's height (the estimator card starts around there). */\nconst BODY_BOTTOM = 0.76;\n/** Where the middle of the Superman panel sits on the screen at the start, as a share of the screen height. */\nconst PANEL_CENTER_AT_START = 0.47;");
rep(" * - It keeps its true proportions and is scaled so its width fills the screen (and spills a little past both sides),\n *   centred on Superman, with the roller and the brush in view. On most screens that makes it taller than the screen, so\n *   it also spills past the bottom. It starts at the very top of the page, where the header is.\n * - It is not pinned. As you scroll, it moves up slowly, in proportion to how much page there is to scroll, so the bottom\n *   of the picture and the bottom of the page come into view together.",
    " * - It keeps its true proportions and is scaled so its width fills the screen (and spills a little past both sides), so\n *   Superman is centred across, with the roller and the brush in view. On most screens that makes it taller than the screen,\n *   so it also spills past the bottom; it starts positioned so the Superman panel (roller and brush included) is on screen.\n * - It is not pinned. As you scroll, it moves up slowly, in proportion to how much page there is to scroll, so the bottom\n *   of the picture and the bottom of the page come into view together.");
rep("    let size = 0;\n    let screenHeight = 0;\n", "    let size = 0;\n    let screenHeight = 0;\n    let startShift = 0; // how far up the picture starts (0 = its top is at the top of the page)\n");
rep("      const main = document.querySelector('main');", "      const overhang = Math.max(0, size - screenHeight);\n      // taller than the screen: start with the Superman panel (roller and brush too) on screen instead of the top row of houses\n      startShift = overhang > 0 ? -Math.min(overhang, Math.max(0, size * 0.5 - screenHeight * PANEL_CENTER_AT_START)) : 0;\n      const main = document.querySelector('main');");
rep("      const cardTop = Math.min(Math.max(size * BODY_BOTTOM + 8, screenHeight * 0.52), screenHeight * 0.86);", "      const cardTop = Math.min(Math.max(size * BODY_BOTTOM + startShift + 8, screenHeight * 0.52), screenHeight * 0.86);");
rep("      // by the end of the page the picture has moved up by exactly the part that hung below the screen\n      root.style.setProperty('--hero-shift', `${-Math.round(overhang * progress)}px`);",
    "      // from where it starts to the point where its bottom meets the bottom of the screen, reached at the end of the page\n      const endShift = -overhang;\n      root.style.setProperty('--hero-shift', `${Math.round(startShift + (endShift - startShift) * progress)}px`);");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
console.log('ok');
