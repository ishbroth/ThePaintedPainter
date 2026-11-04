const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 60)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/styles/chat-estimator.css', [
  [".chat-estimator-header {\n  padding: 22px 24px 16px;", ".chat-estimator-header {\n  padding: 10px 18px 8px;"],
  ["  font-size: 1.35rem;\n  font-weight: 700;\n  color: var(--text-primary);\n  margin: 0 0 4px;", "  font-size: 1.05rem;\n  font-weight: 700;\n  color: var(--text-primary);\n  margin: 0 0 1px;"],
  [".chat-estimator-header p {\n  font-size: 0.9rem;", ".chat-estimator-header p {\n  font-size: 0.78rem;"],
  ["  gap: 5px;\n  padding: 5px 10px;\n  border-radius: 999px;", "  gap: 4px;\n  padding: 2px 9px;\n  border-radius: 999px;"],
  ["  font-size: 0.75rem;\n  font-weight: 600;\n  cursor: pointer;\n  white-space: nowrap;\n}\n\n.chat-read-aloud-toggle.active", "  font-size: 0.7rem;\n  font-weight: 600;\n  cursor: pointer;\n  white-space: nowrap;\n}\n\n.chat-read-aloud-toggle.active"],
  ["  padding: 18px 20px;\n  /* one large open window: the conversation and the place you type are the same field */\n  max-height: min(640px, 74vh);\n  min-height: 380px;", "  padding: 10px 16px;\n  /* one open window: the conversation and the place you type are the same field; it grows with the conversation */\n  max-height: min(640px, 74vh);\n  min-height: 0;"],
  ["  gap: 10px;\n}\n\n.chat-bubble {\n  max-width: 85%;\n  padding: 10px 14px;\n  border-radius: 14px;\n  font-size: 0.95rem;\n  line-height: 1.45;", "  gap: 6px;\n}\n\n.chat-bubble {\n  max-width: 85%;\n  padding: 6px 12px;\n  border-radius: 12px;\n  font-size: 0.88rem;\n  line-height: 1.4;"],
  ["  letter-spacing: 0.3px;\n  padding: 11px 22px;\n  border-radius: 10px;", "  letter-spacing: 0.3px;\n  padding: 8px 18px;\n  border-radius: 8px;"],
  ["  font-size: 0.85rem;\n  font-weight: 700;\n  letter-spacing: 0.3px;\n  padding: 8px 18px;", "  font-size: 0.78rem;\n  font-weight: 700;\n  letter-spacing: 0.3px;\n  padding: 8px 18px;"],
  ["  margin-left: 10px;\n  padding: 3px 12px;\n  font-family: 'Cabin', sans-serif;\n  font-weight: 700;\n  font-size: 0.75rem;", "  margin-left: 8px;\n  padding: 1px 10px;\n  font-family: 'Cabin', sans-serif;\n  font-weight: 700;\n  font-size: 0.7rem;"],
  [".chat-post-actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 10px;\n  justify-content: center;\n  padding: 16px;", ".chat-post-actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n  justify-content: center;\n  padding: 10px;"],
]);
patch('src/index.css', [
  [".cta-button {\n  display: inline-block;\n  background: transparent;\n  color: var(--text-primary);\n  padding: 12px 25px;\n  font-size: 0.8rem;", ".cta-button {\n  display: inline-block;\n  background: transparent;\n  color: var(--text-primary);\n  padding: 8px 18px;\n  font-size: 0.75rem;"],
  [".btn-primary {\n  display: inline-block;\n  background: transparent;\n  color: var(--text-primary);\n  padding: 12px 25px;\n  font-size: 0.8rem;", ".btn-primary {\n  display: inline-block;\n  background: transparent;\n  color: var(--text-primary);\n  padding: 8px 18px;\n  font-size: 0.75rem;"],
  ["  color: var(--text-primary);\n  padding: 14px 28px;\n  font-size: 0.85rem;", "  color: var(--text-primary);\n  padding: 8px 18px;\n  font-size: 0.75rem;"],
  ["  margin-top: 15px;\n  padding: 10px 20px;\n  border: 1px solid var(--input-border);\n  color: var(--text-primary);\n  font-size: 0.8rem;", "  margin-top: 15px;\n  padding: 8px 18px;\n  border: 1px solid var(--input-border);\n  color: var(--text-primary);\n  font-size: 0.75rem;"],
]);
patch('src/components/SiteBackground.tsx', [
  ["const cardTop = Math.round(screenHeight * (2 / 3));", "const cardTop = Math.round(screenHeight * 0.75);"],
  ["MIN_WIDTH_OVER_SCREEN = 0.85", "MIN_WIDTH_OVER_SCREEN = 0.9"],
  ["The estimator card starts at the top of the bottom third of the screen", "The estimator card starts at the top of the bottom quarter of the screen"],
  ["never narrower than 0.85x", "never narrower than 0.9x"],
]);
