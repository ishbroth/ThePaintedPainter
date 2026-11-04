const fs = require('fs');
const f = 'src/components/ThemeToggle.tsx';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const pairs = [
  ["          fontWeight: isLight ? 700 : 400,\n          color: isLight ? 'var(--accent)' : 'var(--text-secondary)',", "          fontWeight: 700,\n          color: isLight ? 'var(--accent)' : 'var(--text-primary)',\n          textShadow: halo,"],
  ["          fontWeight: isLight ? 400 : 700,\n          color: isLight ? 'var(--text-secondary)' : 'var(--accent)',", "          fontWeight: 700,\n          color: isLight ? 'var(--text-primary)' : 'var(--accent)',\n          textShadow: halo,"],
  ["  const handleToggle = () => {", "  // the bar floats over the picture, so the words get a soft halo in the page's own background colour to stay readable\n  const halo = isLight\n    ? '0 0 3px rgba(255,255,255,0.95), 0 0 7px rgba(255,255,255,0.9), 0 0 12px rgba(255,255,255,0.8)'\n    : '0 0 3px rgba(0,0,0,0.95), 0 0 7px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.8)';\n\n  const handleToggle = () => {"],
];
for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error('NF ' + a.slice(0, 50)); t = t.replace(a, () => b); }
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
