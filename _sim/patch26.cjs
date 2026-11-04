const fs = require('fs');
const f = 'src/lib/chatEstimator/extractors.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const from = "  if (surf.walls !== undefined) patch.interiorWalls = surf.walls;";
if (!t.includes(from)) throw new Error('nf');
t = t.replace(from, String.raw`  // A plain list as the answer to "which surfaces?" ("walls", "walls and ceilings", "walls ceilings trim") means exactly those.
  if (lastBotTopicId === 'surfaces' && surf.walls === undefined && surf.ceilings === undefined && surf.trim === undefined && surf.doors === undefined) {
    const low = text.toLowerCase();
    const w = /\bwalls?\b/.test(low), c = /\bceilings?\b/.test(low), tr = /\b(trim|baseboards?|casings?|molding|moulding)\b/.test(low), d = /\bdoors?\b/.test(low);
    if (/\b(everything|all of it|the works|full (?:package|scope)|the whole (?:thing|room)|the usual|standard)\b/.test(low)) {
      surf.everything = true;
      surf.walls = 'yes'; surf.ceilings = 'yes'; surf.trim = 'yes'; surf.doors = 'yes';
    } else if (w || c || tr || d) {
      surf.walls = w ? 'yes' : 'no';
      surf.ceilings = c ? 'yes' : 'no';
      surf.trim = tr ? 'yes' : 'no';
      surf.doors = d ? 'yes' : 'no';
    }
  }
  if (surf.walls !== undefined) patch.interiorWalls = surf.walls;`);
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
console.log('ok');
