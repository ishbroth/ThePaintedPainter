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

// ---- derivation: sheds and other separate structures are "features", not the house body
{
  const o = load('src/lib/chatEstimator/derivation.ts');
  rep(o, "const features = /\\b(fence|fences|deck|shutters?|", "const features = /\\b(fence|fences|sheds?|gazebos?|pergolas?|playhouses?|dog ?houses?|barns?|outbuildings?|workshops?|greenhouses?|arbors?|mailbox(?:es)?|swing sets?|overhangs?|patio covers?|deck|shutters?|");
  save('src/lib/chatEstimator/derivation.ts', o);
}

// ---- topics: no ownership / occupancy questions for separate items
{
  const o = load('src/lib/chatEstimator/topics.ts');
  rep(o, "/** An outside job (the house itself, not just a fence or a deck)", `/**
 * The whole job is things that stand apart from a house (a shed, a deck, a fence, patio furniture, an overhang, a piece of furniture):
 * whether the customer lives there, rents or owns it, and whether the home is occupied or empty, don't matter for those.
 */
export function isStandaloneOnlyJob(c: EstimatorContext): boolean {
  if (c.projectType === 'exterior' && c.exteriorBody === 'no') return true;
  const furnitureOnly = c.furnitureItems.length > 0 && c.selectedRooms.length === 0 && c.interiorScope === '' && !c.squareFeet && !c.bedroomCount;
  return furnitureOnly && (c.projectType === 'interior' || c.projectType === '');
}

/** An outside job (the house itself, not just a fence or a deck)`);
  rep(o, "    id: 'property_ownership',\n    priority: 32,\n    relevant: () => true,", "    id: 'property_ownership',\n    priority: 32,\n    relevant: (c) => !isStandaloneOnlyJob(c),");
  rep(o, "    alreadyAnswered: (c) => (c.projectType === 'exterior' ? hasTiming(c) : !!c.occupancy && hasTiming(c)),", "    alreadyAnswered: (c) => (c.projectType === 'exterior' || isStandaloneOnlyJob(c) ? hasTiming(c) : !!c.occupancy && hasTiming(c)),");
  rep(o, "      const exteriorOnly = c.projectType === 'exterior';\n      const commercial", "      const exteriorOnly = c.projectType === 'exterior' || isStandaloneOnlyJob(c);\n      const commercial");
  save('src/lib/chatEstimator/topics.ts', o);
}

// ---- engine: pricing doesn't wait on those answers either, nor on the siding of a house that isn't being painted
{
  const o = load('src/lib/chatEstimator/chatEngine.ts');
  rep(o, "      (ctxNext.projectType === 'exterior' || !!ctxNext.occupancy) &&\n      !!ctxNext.propertyType;", "      (ctxNext.projectType === 'exterior' || !!ctxNext.occupancy || isStandaloneOnlyJob(ctxNext)) &&\n      (!!ctxNext.propertyType || isStandaloneOnlyJob(ctxNext));");
  rep(o, "  if (ctx.projectType === 'exterior' || ctx.projectType === 'both') {\n    if (!ctx.sidingType) return false;\n  }", "  if (ctx.projectType === 'exterior' || ctx.projectType === 'both') {\n    if (!ctx.sidingType && ctx.exteriorBody !== 'no') return false;\n  }");
  rep(o, "  if ((ctx.projectType === 'exterior' || ctx.projectType === 'both') && !ctx.sidingType) {\n    return \"what's the exterior siding made of?\";", "  if ((ctx.projectType === 'exterior' || ctx.projectType === 'both') && !ctx.sidingType && ctx.exteriorBody !== 'no') {\n    return \"what's the exterior siding made of?\";");
  save('src/lib/chatEstimator/chatEngine.ts', o);
}
console.log('ok');
