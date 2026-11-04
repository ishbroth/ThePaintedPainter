const fs = require('fs');
const f = 'src/lib/chatEstimator/extractors.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
function rep(from, to) {
  if (!t.includes(from)) throw new Error('nf: ' + from.slice(0, 80));
  t = t.replace(from, () => to);
}
rep("    const w = /\\bwalls?\\b/.test(low), c = /\\bceilings?\\b/.test(low), tr = /\\b(trim|baseboards?|casings?|molding|moulding)\\b/.test(low), d = /\\bdoors?\\b/.test(low);",
`    const NEG = "(?:no|not|without|skip|except|excluding|don'?t (?:paint|do|need)(?: the)?)\\\\s+(?:the\\\\s+|any\\\\s+|our\\\\s+)?(?:\\\\w+\\\\s+)?";
    const named = (word: string) => new RegExp('\\\\b' + word + '\\\\b').test(low);
    const negated = (word: string) => new RegExp('\\\\b' + NEG + word + '\\\\b').test(low);
    const mentionW = named('walls?'), mentionC = named('ceilings?'), mentionTr = named('(?:trim|baseboards?|casings?|molding|moulding)'), mentionD = named('doors?');
    const w = mentionW && !negated('walls?'), c = mentionC && !negated('ceilings?'), tr = mentionTr && !negated('(?:trim|baseboards?|casings?|molding|moulding)'), d = mentionD && !negated('doors?');
    if (!w && !c && !tr && !d && (mentionW || mentionC || mentionTr || mentionD)) {
      // only negations ("no trim"): rule those out and leave the rest of the scope open
      if (mentionW) surf.walls = 'no';
      if (mentionC) surf.ceilings = 'no';
      if (mentionTr) surf.trim = 'no';
      if (mentionD) surf.doors = 'no';
    }`);
rep("    } else if (w || c || tr || d) {\n      surf.walls = w ? 'yes' : 'no';", "    } else if (w || c || tr || d) {\n      surf.walls = w ? 'yes' : 'no';");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
console.log('ok');
