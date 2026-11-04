const fs = require('fs');
const p = 'scripts/estimatorConversations.ts';
const raw = fs.readFileSync(p, 'utf8');
const crlf = raw.includes('\r\n');
let s = raw.replace(/\r\n/g, '\n');
const marker = "setLLMReaderForTests(undefined);\nconsole.log(failures";
if (!s.includes(marker)) throw new Error('marker');
const block = String.raw`// ---------------------------------------------------------------------------------------------------------------------------------
// 9. Multi-unit properties: size of a typical unit (averaged), doors counted across the property, new construction, and the ceiling height question
// ---------------------------------------------------------------------------------------------------------------------------------
{
  const big = await play([
    'I have an 80 unit apartment complex in 91941, new construction. interior.',
    'all 80',
    '40 one bedrooms at 700 sq ft and 40 two bedrooms at 950',
    'all walls, all ceilings, baseboards and 200 pre-primed doors. walls have never been primed, new trim needs caulking and nail holes filled. no cabinets',
  ]);
  const c = big.state.ctx;
  check('80 units: the unit size is the count-weighted average of the sizes given', c.squareFeet === 825 && c.unitCount === 80, JSON.stringify({ sq: c.squareFeet, u: c.unitCount }));
  check('200 doors across 80 units is 2.5 a unit', c.doorCount === 2.5, JSON.stringify(c.doorCount));
  check('new construction is picked up', c.projectCondition === 'new_construction', c.projectCondition);
  const e = calculateEstimate(c);
  const prime = e.lineItems.find((l) => /Prime Coat/.test(l.description));
  check('the new-drywall priming is priced for every unit, not once', !!prime && /80 units/.test(prime.description) && prime.amount > 10000, JSON.stringify(prime));
  const perSqft = e.total / (80 * 825);
  check('80 new-construction units cost a production price (about $2 to $4.50 a sq ft of floor), not a retail one nor a one-house price', perSqft > 2 && perSqft < 4.5, 'per sq ft: ' + perSqft.toFixed(2) + ', total ' + Math.round(e.total));
  const single = await play(['I have a duplex, interior', 'all 2', 'about 900 sq ft', 'walls and ceilings']);
  const one = calculateEstimate({ ...single.state.ctx, unitCount: 1, propertyType: 'single_family' });
  const two = calculateEstimate(single.state.ctx);
  check('two units in a duplex cost less than twice one unit (same layout again)', two.total < one.total * 2 && two.total > one.total * 1.5, one.total + ' vs ' + two.total);

  // the ceiling height question: asked on its own for a whole inside with walls, never folded into the closing "anything else?"
  const flow = await play(['I have a fourplex, inside', 'all 4', 'about 900 sq ft', 'walls and ceilings']);
  let st = flow.state;
  let sawCeiling = false;
  let wrapText = '';
  for (let i = 0; i < 30 && !sawCeiling && !/anything else/i.test(wrapText); i++) {
    const q = st.history[st.history.length - 1].text;
    if (/standard ceiling height|ceilings standard/i.test(q)) { sawCeiling = true; break; }
    if (/anything else/i.test(q)) { wrapText = q; break; }
    const answers: [RegExp, string][] = [[/home|rental/i, 'I own it'], [/brand|painter choose/i, 'painter choice'], [/zip/i, '91941'], [/timeline|when|living there|anyone/i, 'next month, nobody lives there'], [/color|changing/i, 'a different color'], [/common areas/i, 'no, just the units']];
    st = (await play([answers.find(([re]) => re.test(q))?.[1] ?? 'no'], [], st)).state;
  }
  check('the ceiling height is asked as its own question (standard height?) for an inside with walls and ceilings', sawCeiling, st.history[st.history.length - 1].text);
  check('"anything else?" does not mention ceiling height', !/ceiling height|how tall/i.test(wrapText), wrapText);
  const std = await play(['yes, standard'], [], st);
  check('"yes, standard" is recorded and not asked again', std.state.ctx.ceilingHeightKnown === true && std.state.ctx.ceilingHeight === 'standard' && !/standard ceiling height/i.test(std.last), std.last);
}

`;
s = s.replace(marker, () => block + marker);
fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('ok');
