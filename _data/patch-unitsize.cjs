const fs = require('fs');
const edit = (p, fn) => { const raw = fs.readFileSync(p, 'utf8'); const crlf = raw.includes('\r\n'); const s = fn(raw.replace(/\r\n/g, '\n')); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); };
const rep = (s, a, b, l) => { if (!s.includes(a)) throw new Error('missing: ' + l); return s.replace(a, () => b); };

const parser = String.raw`
/**
 * The size of the typical unit from what the customer says about the units they know: one size ("about 850 sq ft each"), several ("studios 500, one-bedrooms
 * 700 and twos 950") averaged, or a mix with how many of each ("40 one-bedrooms at 700 and 40 twos at 950") averaged by count. Null if no size is there.
 */
export function parseUnitSizes(text: string, bare = false): { average: number; sizes: number; weighted: boolean } | null {
  const t = digitize(text).replace(/(\d),(\d{3})/g, '$1$2');
  const unit = '(?:sq\\.?\\s*ft\\.?|sqft|sf|square\\s*f(?:ee|oo)t)';
  // "40 one-bedrooms at 700", "30 studios, 450 sq ft each": a count, what they are, then the size
  const withCounts: { n: number; size: number }[] = [];
  const re = new RegExp('(\\d{1,3})\\s+(?:[a-z0-9-]+\\s+){0,3}?(?:units?|apartments?|apts?|studios?|condos?|townhomes?|flats?|bedrooms?|br|bd)\\b[^\\d.]{0,24}?(\\d{3,4})\\s*(?:' + unit + ')?', 'g');
  for (const m of t.matchAll(re)) {
    const n = parseInt(m[1], 10), size = parseInt(m[2], 10);
    if (n >= 1 && n <= 999 && size >= 250 && size <= 4500) withCounts.push({ n, size });
  }
  if (withCounts.length >= 2) {
    const total = withCounts.reduce((a, b) => a + b.n, 0);
    return { average: Math.round(withCounts.reduce((a, b) => a + b.n * b.size, 0) / total), sizes: withCounts.length, weighted: true };
  }
  // plain sizes: every number with a square-foot unit (or, in answer to the size question, every number that looks like one)
  const sizes: number[] = [];
  for (const m of t.matchAll(new RegExp('(\\d{3,4})\\s*(?:' + unit + ')', 'g'))) sizes.push(parseInt(m[1], 10));
  if (sizes.length === 0 && bare) for (const m of t.matchAll(/\b(\d{3,4})\b/g)) sizes.push(parseInt(m[1], 10));
  const ok = sizes.filter((n) => n >= 250 && n <= 4500);
  if (ok.length === 0) return null;
  return { average: Math.round(ok.reduce((a, b) => a + b, 0) / ok.length), sizes: ok.length, weighted: false };
}
`;

edit('src/lib/chatEstimator/details.ts', (s) => {
  s = rep(s, 'export function extractDetails(', parser + '\nexport function extractDetails(', 'parser');
  // the typical unit's size, and the door total across the units
  s = rep(s, "  if (askedId === 'common_areas' && !/\\?\\s*$/.test(text.trim())) {", String.raw`  // the size of a typical unit: one size, or the sizes they know averaged (weighted by how many of each, when they say)
  if ((ctx.propertyType === 'multi_unit' || isMultiUnitText(text)) && ctx.projectType !== 'exterior' && !/\?\s*$/.test(text.trim())) {
    const sizes = parseUnitSizes(text, askedId === 'house_size');
    if (sizes && (sizes.sizes >= 2 || askedId === 'house_size' || /\b(?:each|per unit|every unit|a unit|typical unit|average)\b/i.test(text))) {
      patch.squareFeet = sizes.average;
      acks.push(sizes.sizes >= 2 ? 'units average about ' + sizes.average.toLocaleString('en-US') + ' sq ft' : sizes.average.toLocaleString('en-US') + ' sq ft a unit');
    }
  }
  // doors counted across the whole property ("200 pre-primed doors" in 80 units) are per unit for the price: 2.5 each
  {
    const unitsHere = patch.unitCount ?? ctx.unitCount ?? ctx.unitsTotal;
    const dm = t.match(/\b(\d{2,4})\s+(?:[a-z-]+\s+){0,3}?doors?\b/);
    if ((ctx.propertyType === 'multi_unit' || patch.propertyType === 'multi_unit' || isMultiUnitText(text)) && unitsHere && unitsHere >= 2 && dm && !/\bgarage\s+doors/.test(t)) {
      const total = parseInt(dm[1], 10);
      if (total >= unitsHere && total <= unitsHere * 30) {
        patch.doorCount = Math.round((total / unitsHere) * 2) / 2;
        if (ctx.interiorDoors === 'none') patch.interiorDoors = 'some';
        patch.doorsIncluded = true;
        acks.push(total + ' doors in all, about ' + patch.doorCount + ' a unit');
      }
    }
  }
  if (askedId === 'common_areas' && !/\?\s*$/.test(text.trim())) {`, 'unit size block');
  return s;
});

edit('src/lib/chatEstimator/topics.ts', (s) => rep(s,
  'return "About how big is a typical unit, in square feet? Or how many bedrooms?";',
  'return "About how big is a typical unit, in square feet? If they vary, give me the sizes you know (like \'studios 500, one-bedrooms 700, twos 950\', or with how many of each) and I\'ll work out the average. Or how many bedrooms?";', 'ask'));
console.log('ok');
