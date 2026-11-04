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

// ---- price breakdown: one line for trim, fascia, soffits and eaves
{
  const o = load('src/lib/estimateEngine.ts');
  const a = o.t.indexOf("    // Trim/fascia\n");
  const b = o.t.indexOf("    // Shutters\n");
  if (a < 0 || b < 0) throw new Error('engine block');
  o.t = o.t.slice(0, a) + `    // Trim, fascia, soffits and eaves are one item: the boards around the roofline and the underside of the overhang
    if ((ctx.exteriorTrim === 'yes' || ctx.soffitsEaves === 'yes') && !off('ext_trim')) {
      const trimPart = ctx.exteriorTrim === 'yes' ? extSurface.trimLinFt * BASE_RATES.exterior.fascia_per_linft : 0;
      const soffitPart = ctx.soffitsEaves === 'yes' ? extSurface.soffitSqFt * BASE_RATES.exterior.soffit_per_sqft : 0;
      lineItems.push({
        category: 'Exterior',
        description: 'Trim, Fascia, Soffits & Eaves',
        amount: (trimPart + soffitPart) * regionalMult,
        key: 'ext_trim',
      });
    }

` + o.t.slice(b);
  save('src/lib/estimateEngine.ts', o);
}

// ---- topics: one question; the eaves question is gone
{
  const o = load('src/lib/chatEstimator/topics.ts');
  const a = o.t.indexOf("  {\n    id: 'ext_trim',");
  const b = o.t.indexOf("  {\n    id: 'ext_doors',");
  if (a < 0 || b < 0) throw new Error('trim topic');
  o.t = o.t.slice(0, a) + `  {
    id: 'ext_trim',
    priority: 48.1,
    relevant: (c) => isExteriorJob(c) && c.exteriorTrim !== 'yes' && c.soffitsEaves !== 'yes',
    alreadyAnswered: (c) => c.exteriorTrim === 'yes' || c.soffitsEaves === 'yes' || extDone(c, 'ext_trim'),
    ask: (c) =>
      pick(
        [
          "Are we painting the trim, fascia, soffits and eaves too?",
          "What about the trim, fascia, eaves and soffits, are those getting painted?",
        ],
        seed(c),
      ),
    clarify: () => "That's the boards around the roofline and around the windows and doors (trim and fascia), plus the underside of the roof overhang (eaves and soffits). They're usually painted along with the siding.",
    example: () => "Just say 'yes, all of it' or 'no, just the siding'.",
  },
` + o.t.slice(b);
  const c = o.t.indexOf("  {\n    id: 'ext_eaves',");
  const d = o.t.indexOf("  {\n    id: 'ext_windows',");
  if (c < 0 || d < 0) throw new Error('eaves topic');
  o.t = o.t.slice(0, c) + o.t.slice(d);
  save('src/lib/chatEstimator/topics.ts', o);
}
{
  const o = load('src/lib/chatEstimator/clarify.ts');
  rep(o, "  ext_trim: 'whether the trim is painted',", "  ext_trim: 'whether the trim, fascia, soffits and eaves are painted',");
  rep(o, "  ext_eaves: 'whether the eaves and soffits are painted',\n", "");
  save('src/lib/chatEstimator/clarify.ts', o);
}
{
  const o = load('src/lib/promptHints.ts');
  rep(o, "  ext_trim: 'Paint the trim?',", "  ext_trim: 'Paint the trim and eaves?',");
  rep(o, "  ext_eaves: 'Paint the eaves and soffits?',\n", "");
  save('src/lib/promptHints.ts', o);
}

// ---- engine: one yes/no sets both; and either one volunteered brings the other along
{
  const o = load('src/lib/chatEstimator/chatEngine.ts');
  rep(o, "        ext_eaves: { field: 'soffitsEaves', on: 'yes' },\n", "");
  rep(o, "        if (yes && !no) target[offer.field] = offer.on;\n        else if (no) target[offer.field] = (state.ctx as unknown as Record<string, unknown>)[offer.field];", "        const fields = asked === 'ext_trim' ? [offer.field, 'soffitsEaves'] : [offer.field]; // trim, fascia, soffits and eaves go together\n        if (yes && !no) for (const field of fields) target[field] = offer.on;\n        else if (no) for (const field of fields) target[field] = (state.ctx as unknown as Record<string, unknown>)[field];");
  rep(o, "  // Surfaces added at the estimator's suggestion stay in", `  // Trim, fascia, soffits and eaves are one item on an outside job: either one named brings the other.
  if ((ctxNext.projectType === 'exterior' || ctxNext.projectType === 'both') && (ctxNext.exteriorTrim === 'yes' || ctxNext.soffitsEaves === 'yes')) {
    ctxNext.exteriorTrim = 'yes';
    ctxNext.soffitsEaves = 'yes';
  }

  // Surfaces added at the estimator's suggestion stay in`);
  save('src/lib/chatEstimator/chatEngine.ts', o);
}
console.log('ok');
