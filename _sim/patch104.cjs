const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 70)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/components/ChatEstimator/ChatPanel.tsx', [
  ["                // phones and tablets: this tap is what starts the voice (it's a real touch, which also lets the browser play audio)\n                if (!keyboardDevice) playIntroIfFreshRef.current();", "                // clicking or tapping the typing bubble starts the greeting if it hasn't played yet (phones need this tap; on a laptop\n                // it covers someone who hasn't scrolled). It plays once: after the scroll trigger has played it, this does nothing.\n                playIntroIfFreshRef.current();"],
  ["    const el = e.currentTarget;\n    const text = el.textContent ?? '';", "    const el = e.currentTarget;\n    const text = el.textContent ?? '';\n    // starting to type also starts the greeting, if it hasn't played yet\n    playIntroIfFreshRef.current();"],
]);
