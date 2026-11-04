const fs = require('fs');
const f = 'src/components/SiteBackground.tsx';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n'); t = t.split('\r\n').join('\n');
function rep(a, b) { if (!t.includes(a)) throw new Error('nf ' + a.slice(0, 60)); t = t.replace(a, () => b); }
rep("const WIDTH_OVER_SCREEN = 1.06;", "const WIDTH_OVER_SCREEN = 1.03;");
rep("/** Where the middle of the Superman panel sits on the screen at the start, as a share of the screen height. */\nconst PANEL_CENTER_AT_START = 0.47;", "/** How far down the picture the bottom of the brush reaches (share of the picture's height); it has to stay on screen at the start. */\nconst BRUSH_BOTTOM = 0.72;");
rep("      // taller than the screen: start with the Superman panel (roller and brush too) on screen instead of the top row of houses\n      startShift = overhang > 0 ? -Math.min(overhang, Math.max(0, size * 0.5 - screenHeight * PANEL_CENTER_AT_START)) : 0;",
    "      // taller than the screen: start as far down as possible (the most of the top row of houses) while the brush is still on screen\n      startShift = overhang > 0 ? -Math.min(overhang, Math.max(0, size * BRUSH_BOTTOM - screenHeight + 10)) : 0;");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
