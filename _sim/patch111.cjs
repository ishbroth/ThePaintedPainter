const fs = require('fs');
const f = 'src/components/SiteBackground.tsx';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
function rep(a, b) { if (!t.includes(a)) throw new Error('NF ' + a.slice(0, 60)); t = t.replace(a, () => b); }
rep("    let startShift = 0; // how far up the picture starts (0 = its top is at the top of the page)\n", "    let startShift = 0; // how far up the picture starts (0 = its top is at the top of the page)\n    let isPhone = false;\n");
rep("      const phone = window.innerWidth <= 700 && screenHeight > window.innerWidth * 1.2;\n", "      const phone = window.innerWidth <= 700 && screenHeight > window.innerWidth * 1.2;\n      isPhone = phone;\n");
rep("      const overhang = Math.max(0, size - screenHeight);\n", "      const overhang = Math.max(0, size - screenHeight);\n");
rep("      const endShift = -overhang;\n", "      // (on a phone the picture is shorter than the screen, so it travels down instead, ending with its bottom edge at the bottom of\n      // the screen as the page ends; on larger screens it travels up until its bottom edge meets the bottom of the screen)\n      const endShift = isPhone ? Math.max(0, screenHeight - size) : -overhang;\n");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
