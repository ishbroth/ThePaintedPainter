const fs = require('fs');
const f = 'src/components/ChatEstimator/ChatPanel.tsx';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = "                onInput={onComposerInput}\n";
if (!t.includes(a)) throw new Error('nf');
t = t.replace(a, () => "                onFocus={() => playIntroIfFreshRef.current()}\n" + a);
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
