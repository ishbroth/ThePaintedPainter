const fs = require('fs');
const f = 'src/lib/chatEstimator/chatEngine.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
function rep(a, b) { if (!t.includes(a)) throw new Error('nf ' + a.slice(0, 60)); t = t.replace(a, () => b); }
rep("  const wantsFinish = hasIntent(intent, 'ready_to_finish') && (s.wrapupAsked || explicitRunIt);", "  // \"Run it\" only works once the standard questions are done and the wrap-up prompt (\"anything else to add? ... say 'run it'\") has been reached.\n  const wantsFinish = hasIntent(intent, 'ready_to_finish') && s.wrapupAsked;\n  const earlyRunIt = !s.wrapupAsked && (explicitRunIt || hasIntent(intent, 'ready_to_finish'));");
rep("    if (readyToQuote(ctxNext)) {\n      s = { ...s, history: [...s.history, botMessage(\"Happy to run it. I just need a few quick details first so the price is accurate.\")] };\n    } else {", "    {");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
