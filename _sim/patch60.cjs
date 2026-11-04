const fs = require('fs');
const f = 'src/components/SiteBackground.tsx';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n'); t = t.split('\r\n').join('\n');
function rep(a, b) { if (!t.includes(a)) throw new Error('nf ' + a.slice(0, 60)); t = t.replace(a, () => b); }
rep("      startShift = overhang > 0 ? -Math.min(overhang, Math.max(0, size * BRUSH_BOTTOM - screenHeight + 10)) : 0;",
    "      // (nudged a little further down than that: the brush handle's tip may sit just past the bottom edge)\n      startShift = overhang > 0 ? -Math.min(overhang, Math.max(0, size * BRUSH_BOTTOM - screenHeight + 10 - screenHeight * EXTRA_DOWN)) : 0;");
rep("const BRUSH_BOTTOM = 0.72;", "const BRUSH_BOTTOM = 0.72;\n/** Extra nudge down, as a share of the screen height (about 54px on a 900px-tall screen). */\nconst EXTRA_DOWN = 0.06;");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
