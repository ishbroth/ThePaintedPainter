const fs = require('fs');
const f = 'src/lib/chatEstimator/chatEngine.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
function rep(a, b) { if (!t.includes(a)) throw new Error('nf ' + a.slice(0, 60)); t = t.replace(a, () => b); }
rep("  const earlyRunIt = !s.wrapupAsked && (explicitRunIt || hasIntent(intent, 'ready_to_finish'));\n", "");
rep("  } else {\n    // 3. Handle meta questions / clarifications before advancing topics", "  } else {\n    if (explicitRunIt && !s.wrapupAsked) {\n      s = { ...s, history: [...s.history, botMessage(\"I'll run the numbers as soon as I've asked a few more quick questions.\")] };\n    }\n    // 3. Handle meta questions / clarifications before advancing topics");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
