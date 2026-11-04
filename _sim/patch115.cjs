const fs = require('fs');
const f = 'src/lib/chatEstimator/chatEngine.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = "  if (state.ctx.exteriorColorChange !== 'different' && ctxWithExplicit.exteriorColorChange === 'different' && !/(";
if (!t.includes(a)) throw new Error('nf');
t = t.replace(a, () => "  if (state.lastBotTopic?.id !== 'ext_color' && state.ctx.exteriorColorChange !== 'different' && ctxWithExplicit.exteriorColorChange === 'different' && !/(");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
