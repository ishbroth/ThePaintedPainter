const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 60)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/components/ChatEstimator/ChatPanel.tsx', [
  ["          {waiting && (\n            <div className=\"chat-bubble chat-bubble-bot\">\n              <div className=\"chat-bubble-text chat-loading chat-preparing\">\n                <svg className=\"chat-brush-spinner\" viewBox=\"0 0 48 48\" width=\"34\" height=\"34\" aria-hidden=\"true\">\n                  <g className=\"chat-brush-swing\">\n                    <rect x=\"22\" y=\"2\" width=\"5\" height=\"22\" rx=\"2.5\" fill=\"#8a5a2b\" />\n                    <rect x=\"20\" y=\"22\" width=\"9\" height=\"7\" rx=\"1\" fill=\"#b9bec6\" />\n                    <path d=\"M19.5 29 h10 l-1 14 q-4 3 -8 0 z\" fill=\"#ff8a3d\" />\n                  </g>\n                </svg>\n                <span>Preparing your results…</span>\n              </div>",
   "          {/* Only while a price is actually being prepared (not when coming back to a finished chat) */}\n          {waiting && !restoredAlreadyFinishedRef.current && (\n            <div className=\"chat-bubble chat-bubble-bot\">\n              <div className=\"chat-bubble-text chat-loading chat-preparing\">\n                <span>Preparing your results…</span>\n                <svg className=\"chat-brush-spinner\" viewBox=\"0 0 48 48\" width=\"30\" height=\"30\" aria-hidden=\"true\">\n                  <circle cx=\"24\" cy=\"24\" r=\"18\" fill=\"none\" stroke=\"#f3d9c4\" strokeWidth=\"3\" />\n                  <g className=\"chat-brush-orbit\">\n                    <g transform=\"translate(24 3) rotate(90)\">\n                      <rect x=\"-1\" y=\"-2.2\" width=\"11\" height=\"4.4\" rx=\"2.2\" fill=\"#8a5a2b\" />\n                      <rect x=\"9\" y=\"-3\" width=\"4\" height=\"6\" fill=\"#b9bec6\" />\n                      <path d=\"M13 -3 h7 q3 3 0 6 h-7 z\" fill=\"#ff8a3d\" />\n                    </g>\n                  </g>\n                </svg>\n              </div>"],
]);
{
  const f = 'src/styles/chat-estimator.css';
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  const i = t.indexOf('.chat-brush-swing {');
  if (i < 0) throw new Error('css');
  const j = t.indexOf('@media (prefers-reduced-motion: reduce) {\n  .chat-brush-swing { animation: none; }\n}');
  if (j < 0) throw new Error('css2');
  t = t.slice(0, i) + ".chat-brush-orbit {\n  transform-origin: 24px 24px;\n  animation: chat-brush-orbit 0.9s linear infinite;\n}\n\n@keyframes chat-brush-orbit {\n  to { transform: rotate(360deg); }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .chat-brush-orbit { animation-duration: 3s; }\n}" + t.slice(j + '@media (prefers-reduced-motion: reduce) {\n  .chat-brush-swing { animation: none; }\n}'.length);
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/components/SiteBackground.tsx', [
  ["      startShift = overhang > 0 ? -Math.min(overhang, Math.max(0, size * BRUSH_BOTTOM - screenHeight + 10 - screenHeight * EXTRA_DOWN)) : 0;", "      // (no longer: the picture starts with its top, the row of houses included, exactly at the top of the screen)\n      startShift = 0;"],
]);
