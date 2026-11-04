const fs = require('fs');
const f = 'src/styles/chat-estimator.css';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
function rep(a, b) { if (!t.includes(a)) throw new Error('NF ' + a.slice(0, 60)); t = t.replace(a, () => b); }
rep("  .chat-composer,\n  .chat-composer-text,\n  .chat-photo-desc-input,\n  .chat-photo-slot-caption {\n    font-size: 16px;\n  }", "  .chat-composer,\n  .chat-composer-text,\n  .chat-photo-desc-input,\n  .chat-photo-slot-caption {\n    font-size: 18px;\n  }");
rep("@media (max-width: 640px) {\n  .chat-bubble {\n    font-size: 1rem;\n  }\n}", `@media (max-width: 640px) {
  .chat-bubble {
    font-size: 1.12rem;
    line-height: 1.4;
  }

  .chat-estimator-header h2 {
    font-size: 1.2rem;
  }

  .chat-estimator-header p {
    font-size: 0.88rem;
  }

  .chat-input-hint {
    font-size: 0.82rem;
  }

  .chat-read-aloud-toggle,
  .chat-kbd-done,
  .chat-send-inline {
    font-size: 0.8rem;
  }
}`);
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
