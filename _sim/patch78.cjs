const fs = require('fs');
const f = 'src/lib/chatEstimator/chatEngine.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const pairs = [
  ["\"Anything else I should know — unusual heights, tough access, special colors, timing? \" +", "\"Anything else I should know, like the ceiling height? \" +"],
  ["'Inside, which of these are being painted: walls, ceilings, trim, doors? And outside, is it just the siding, or the trim, doors, deck and fence too?'", "'Inside, what all is being painted? And outside, is it just the siding, or more than that?'"],
  ["'Which of these are being painted: walls, ceilings, trim, doors? (Say \"everything\" or list the ones you want.)'", "'What all is being painted?'"],
];
for (const [a, b] of pairs) { if (!t.includes(a)) console.log('NF', a.slice(0, 50)); t = t.split(a).join(b); }
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
