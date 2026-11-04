const fs = require('fs');
const f = 'src/lib/chatEstimator/extractors.ts';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const from = "  const color = extractColorChange(text);\n  if (color && !prev.interiorColorChange) {";
if (!t.includes(from)) throw new Error('nf');
t = t.replace(from, `  let color = extractColorChange(text);
  if (!color && lastBotTopicId === 'color_change') {
    // A terse reply to "same color or a different one?" ("different, light", "keep it", "going grey") is an answer to that question.
    const lower = text.toLowerCase();
    if (/\b(same|keep|keeping|existing|current|match|no change|unchanged|stay)\b/.test(lower)) color = 'same';
    else if (/\b(dark|black|navy|charcoal)\b/.test(lower) && /\b(light|white|cream)\b/.test(lower)) color = 'dramatic';
    else if (/\b(different|new|change|changing|switch|go(?:ing)?|lighter|darker|light|dark|grey|gray|white|blue|green|red|navy|beige|black|bold|bright|color|colour)\b/.test(lower)) color = 'different';
  }
  if (color && !prev.interiorColorChange) {`);
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
