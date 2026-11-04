const fs = require('fs');
const CR = String.fromCharCode(13), LF = String.fromCharCode(10);
function patch(file, edits) {
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes(CR + LF);
  let t = raw.split(CR + LF).join(LF);
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 90));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split(LF).join(CR + LF) : t);
}

patch('src/lib/chatEstimator/dateParsing.ts', [[
`  if (/\\bnext month\\b/.test(t)) {
    return { ...out, startDate: iso(new Date(today.getFullYear(), today.getMonth() + 1, 1)) };
  }
  return out;
}`,
`  if (/\\bnext month\\b/.test(t)) {
    return { ...out, startDate: iso(new Date(today.getFullYear(), today.getMonth() + 1, 1)) };
  }

  // "this weekend" / "next weekend": the coming Saturday (a week later for "next")
  if ((m = /\\b(this|next) weekend\\b/.exec(t))) {
    const diff = (6 - today.getDay() + 7) % 7 || 7;
    return { ...out, startDate: iso(addDays(today, diff + (m[1] === 'next' ? 7 : 0))) };
  }

  // "before the holidays" / "before Thanksgiving/Christmas": a deadline
  if (/\\bbefore (?:the )?(?:holidays?|christmas|thanksgiving)\\b/.test(t)) {
    const dec = new Date(today.getFullYear(), /thanksgiving/.test(t) ? 10 : 11, /thanksgiving/.test(t) ? 20 : 20);
    return { ...out, flexible: true, endDate: iso(dec >= today ? dec : new Date(dec.getFullYear() + 1, dec.getMonth(), dec.getDate())) };
  }

  // A month with no day: "sometime in March", "mid-November", "early June", "late August"
  if ((m = new RegExp(\`\\\\b(?:(early|mid|late|end of|beginning of|start of)[\\\\s-]+|(?:in|during|sometime in|sometime|around|by the end of|by)\\\\s+(?:the\\\\s+)?(?:(early|mid|late)[\\\\s-]+)?)\${MONTH_RE}\\\\b(?!\\\\.?\\\\s*\\\\d)\`, 'i').exec(t))) {
    const part = (m[1] || m[2] || '').toLowerCase();
    const monthIdx = MONTHS[m[3].toLowerCase()];
    let year = today.getFullYear();
    if (new Date(year, monthIdx + 1, 0) < today) year += 1;
    const first = new Date(year, monthIdx, 1);
    const last = new Date(year, monthIdx + 1, 0);
    let start = first;
    let end = last;
    if (part === 'early' || part === 'beginning of' || part === 'start of') end = new Date(year, monthIdx, 10);
    else if (part === 'mid') { start = new Date(year, monthIdx, 10); end = new Date(year, monthIdx, 20); }
    else if (part === 'late' || part === 'end of') start = new Date(year, monthIdx, 20);
    if (start < today) start = today;
    if (end >= start) return { ...out, flexible: true, startDate: iso(start), endDate: iso(end) };
  }
  return out;
}`]]);
console.log('ok');
