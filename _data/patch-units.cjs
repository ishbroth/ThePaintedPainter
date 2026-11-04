const fs = require('fs');
const edit = (p, fn) => { const raw = fs.readFileSync(p, 'utf8'); const crlf = raw.includes('\r\n'); const s = fn(raw.replace(/\r\n/g, '\n')); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); };
const rep = (s, a, b, l) => { if (!s.includes(a)) throw new Error('missing: ' + l); return s.replace(a, () => b); };

edit('src/lib/estimateEngine.ts', (s) => {
  // the factor: what a unit costs when many alike are painted by a production crew, against the retail price of one house
  const a = s.indexOf('/** Repeat-unit efficiency on a multi-unit job');
  const b = s.indexOf('export function calculateEstimate');
  s = s.slice(0, a) + `/**
 * What each unit costs, against the price of the same rooms in one house, when a production crew paints many alike. The rates in this engine are what a homeowner
 * pays for one job: furniture to move, colours to talk over, a small crew. Apartment work is a different trade: empty units, the same layout again and again, spray
 * for the primer and finish coats, paint bought by the drum, and a crew that learns the unit. Contractors bid it by the unit, in the region of $1.50 to $3.00 per
 * square foot of floor for a full new-construction scope (primer, two finish coats, ceilings, trim and doors) in a high-wage market like San Diego, against $4 to $8 retail.
 */
export function repeatUnitFactor(units: number): number {
  return units >= 50 ? 0.38 : units >= 25 ? 0.44 : units >= 10 ? 0.55 : units >= 4 ? 0.70 : units >= 2 ? 0.88 : 1;
}

` + s.slice(b);

  // the old scaling inside the block goes (it only reached the lines made before it; the priming and prep come later)
  s = rep(s, `    const eff = repeatUnitFactor(unitsPainted);
    const scale = unitsPainted * eff;
    for (let i = interiorStart; i < lineItems.length; i++) {
      lineItems[i] = { ...lineItems[i], amount: lineItems[i].amount * scale, description: \`\${lineItems[i].description} x \${unitsPainted} units\` };
    }
`, '', 'old loop');

  // scale everything inside, once all of it is made
  s = rep(s, "  // ===== SUBTOTAL =====\n  let subtotal", `  // Multi-unit, inside: every line above was priced for ONE typical unit (priming, caulking and filling included). Each unit repeats it, at the production price.
  if (unitsPainted > 0 && !off('units')) {
    const scale = unitsPainted * repeatUnitFactor(unitsPainted);
    const inside = (item: EstimateLineItem) =>
      item.key !== 'common_areas' && (item.category === 'Interior' || ((item.category === 'Specialty' || item.category === 'Prep Work') && (ctx.projectType === 'interior' || !/exterior|siding|stucco|pressure|wash|fence|deck|gutter|soffit|fascia/i.test(item.description))));
    for (let i = 0; i < lineItems.length; i++) {
      if (inside(lineItems[i])) lineItems[i] = { ...lineItems[i], amount: lineItems[i].amount * scale, description: \`\${lineItems[i].description} x \${unitsPainted} units\` };
    }
  }

  // ===== SUBTOTAL =====
  let subtotal`, 'scale');
  s = rep(s, "  const interiorStart = lineItems.length;\n", '', 'unused start');
  return s;
});
console.log('ok');
