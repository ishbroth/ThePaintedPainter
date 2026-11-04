const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 70)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/index.css', [[".header {\n  padding: 12px 0;\n  border-bottom: 1px solid var(--border);\n}", ".header {\n  padding: 12px 0;\n}"]]);
patch('src/components/ThemeToggle.tsx', [["        background: 'var(--bg-chrome)',\n        borderBottom: '1px solid var(--border)',\n", "        background: 'var(--bg-chrome)',\n"]]);
