const fs = require('fs');
function load(f) {
  const t = fs.readFileSync(f, 'utf8');
  return { crlf: t.includes('\r\n'), t: t.split('\r\n').join('\n') };
}
function save(f, o) {
  fs.writeFileSync(f, o.crlf ? o.t.split('\n').join('\r\n') : o.t);
}
function rep(o, a, b, label) {
  if (!o.t.includes(a)) throw new Error('NF ' + (label || a.slice(0, 70)));
  o.t = o.t.replace(a, () => b);
}

{
  const o = load('src/lib/types.ts');
  rep(o, "  extAnswered?: string[];", "  extAnswered?: string[];\n  /** The job is a separate building like a shed (named here), not a house: no live-here/rental or house questions, just its size and what it's made of. */\n  standaloneStructure?: string;");
  save('src/lib/types.ts', o);
}
{
  const o = load('src/lib/chatEstimator/derivation.ts');
  rep(o, "  // Exterior jobs that are about features, not the house body\n", `  // A separate building (shed, barn, gazebo...): its own small job, nothing to do with a house
  if (!ctx.standaloneStructure) {
    const s = t.match(/\\b(shed|barn|gazebo|playhouse|dog ?house|workshop|outbuilding|greenhouse|pergola)\\b/);
    const aboutAHouse = /\\b(?:my|the|our|a)\\s+(?:house|home)\\b|\\bsiding\\b|\\bstucco\\b|\\bwhole (?:house|exterior)\\b/.test(t.replace(/dog ?house|play ?house|green ?house/g, ' '));
    if (s && !aboutAHouse && !/\\b(?:bed|bath)rooms?\\b|\\bkitchen\\b|\\bliving room\\b/.test(t)) {
      out.push({ patch: { standaloneStructure: s[1].replace('doghouse', 'dog house'), projectType: ctx.projectType || 'exterior', stories: ctx.stories ?? 1 }, reason: 'A separate building, not a house' });
    }
  }

  // Exterior jobs that are about features, not the house body
`);
  save('src/lib/chatEstimator/derivation.ts', o);
}
{
  const o = load('src/lib/chatEstimator/topics.ts');
  rep(o, "export function isStandaloneOnlyJob(c: EstimatorContext): boolean {\n", "export function isStandaloneOnlyJob(c: EstimatorContext): boolean {\n  if (c.standaloneStructure) return true;\n");
  rep(o, "function isExteriorJob(c: EstimatorContext): boolean {\n  return (c.projectType === 'exterior' || c.projectType === 'both') && c.exteriorBody !== 'no';", "function isExteriorJob(c: EstimatorContext): boolean {\n  return (c.projectType === 'exterior' || c.projectType === 'both') && c.exteriorBody !== 'no' && !c.standaloneStructure;");
  // size question for a shed
  rep(o, "    relevant: (c) => isExteriorJob(c) && !c.squareFeet && !c.bedroomCount,\n    alreadyAnswered: (c) => !!c.squareFeet || !!c.bedroomCount,\n    ask: (c) =>\n      pick(", "    relevant: (c) => (isExteriorJob(c) || !!c.standaloneStructure) && !c.squareFeet && !c.bedroomCount,\n    alreadyAnswered: (c) => !!c.squareFeet || !!c.bedroomCount,\n    ask: (c) =>\n      c.standaloneStructure\n        ? `About how big is the ${c.standaloneStructure}, in square feet? Or its length and width.`\n        : pick(");
  save('src/lib/chatEstimator/topics.ts', o);
}
console.log('ok');
