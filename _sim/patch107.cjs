const fs = require('fs');
const f = 'src/styles/chat-estimator.css';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = "  overflow: hidden;\n  display: flex;\n  flex-direction: column;\n}\n\n.chat-estimator-header {";
if (!t.includes(a)) throw new Error('nf');
t = t.replace(a, () => "  overflow: hidden;\n  display: flex;\n  flex-direction: column;\n  /* roomy rather than wide and short: about square, with the extra space as blank room in the open chat window below the typing line\n     (the conversation window stretches; nothing inside it changes size) */\n  min-height: min(640px, calc(100vw - 40px));\n}\n\n.chat-estimator-header {");
// keypad open: no minimum height
t = t.replace(".chat-estimator-section.keyboard-open .chat-messages {", ".chat-estimator-section.keyboard-open .chat-estimator-card {\n  min-height: 0;\n}\n\n.chat-estimator-section.keyboard-open .chat-messages {");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
