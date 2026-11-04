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

// ---- types
{
  const o = load('src/lib/types.ts');
  rep(o, "  extAnswered?: string[];", "  extAnswered?: string[];\n  /** The paint: a brand the customer wants (or 'painter_choice'), how nice it is (economy, standard, premium) and the finish. */\n  paintBrand?: string;\n  paintGrade?: string;\n  paintFinish?: string;");
  save('src/lib/types.ts', o);
}

// ---- topics
{
  const o = load('src/lib/chatEstimator/topics.ts');
  rep(o, "  // ——————————————————————————————————————————\n  // Building up the job:", `  // ——————————————————————————————————————————
  // The paint itself: a brand if they have one, how nice, and the finish. These change the price (premium paint costs more, and a
  // customer who says the painter can choose gets the usual mid-grade assumption) and are passed to painters.
  // ——————————————————————————————————————————
  {
    id: 'paint_brand',
    priority: 37,
    relevant: (c) => paintingJob(c),
    alreadyAnswered: (c) => !!c.paintBrand || extDone(c, 'paint_brand'),
    ask: (c) =>
      pick(
        [
          'Do you have a paint brand in mind, or should the painter choose?',
          'Is there a paint brand you prefer, or is it up to the painter?',
        ],
        seed(c),
      ),
    clarify: () => "Some customers love a particular brand, like Sherwin-Williams, Benjamin Moore or Behr. If you don't have a preference, the painter picks a good one.",
    example: () => "Just say a brand like 'Benjamin Moore', or 'painter's choice'.",
  },
  {
    id: 'paint_grade',
    priority: 38,
    relevant: (c) => paintingJob(c),
    alreadyAnswered: (c) => !!c.paintGrade || extDone(c, 'paint_grade'),
    ask: (c) =>
      pick(
        [
          'Would you like standard mid-grade paint, or a premium line?',
          'Standard mid-grade paint, or a deluxe premium paint?',
        ],
        seed(c),
      ),
    clarify: () => "Standard mid-grade paint is what most painters use and holds up well. Premium lines (like Emerald or Aura) cost more per gallon but cover better, last longer and look richer.",
    example: () => "Just say 'standard', 'premium', or 'budget'.",
  },
  {
    id: 'paint_finish',
    priority: 39,
    relevant: (c) => paintingJob(c),
    alreadyAnswered: (c) => !!c.paintFinish || extDone(c, 'paint_finish'),
    ask: (c) =>
      pick(
        [
          'Do you have a finish in mind, or should the painter pick the right one for each surface?',
          'Any particular finish you want, or is the painter free to choose?',
        ],
        seed(c),
      ),
    clarify: () => "The finish is how shiny the paint is: flat or matte, eggshell, satin, semi-gloss or gloss. Painters normally choose the right one for each surface, like flat on ceilings and semi-gloss on trim.",
    example: () => "Just say 'eggshell', 'satin', or 'painter's choice'.",
  },

  // ——————————————————————————————————————————
  // Building up the job:`);
  rep(o, "/** An exterior question (ext_*) the customer has already answered. */", "/** Something is actually being painted (not just washed), so the paint questions apply. */\nfunction paintingJob(c: EstimatorContext): boolean {\n  if (!c.projectType) return false;\n  const washOnly = c.projectType === 'exterior' && c.exteriorBody === 'no' && c.prepWork.includes('power_washing') && c.fence === 'none' && c.deck === 'none' && !c.standaloneStructure;\n  return !washOnly;\n}\n\n/** An exterior question (ext_*) the customer has already answered. */");
  save('src/lib/chatEstimator/topics.ts', o);
}
{
  const o = load('src/lib/chatEstimator/clarify.ts');
  rep(o, "  ext_size: 'the size of the house',", "  paint_brand: 'which paint brand',\n  paint_grade: 'standard or premium paint',\n  paint_finish: 'the paint finish',\n  ext_size: 'the size of the house',");
  save('src/lib/chatEstimator/clarify.ts', o);
}
{
  const o = load('src/lib/promptHints.ts');
  rep(o, "  ext_size: 'Please estimate square feet',", "  paint_brand: 'Brand, or painter’s choice?',\n  paint_grade: 'Standard or premium paint?',\n  paint_finish: 'Finish, or painter’s choice?',\n  ext_size: 'Please estimate square feet',");
  save('src/lib/promptHints.ts', o);
}

// ---- the answers
{
  const o = load('src/lib/chatEstimator/chatEngine.ts');
  rep(o, "  // Answers to the exterior questions (ext_*): yes adds the thing", `  // Answers about the paint (brand, grade, finish). Anything said earlier about them is read too ("we want Benjamin Moore").
  {
    const asked = state.lastBotTopic?.id;
    const low = trimmed.toLowerCase();
    const brands: [RegExp, string][] = [
      [/@bsherwin[- ]?williams@b|@bsw@b/, 'Sherwin-Williams'],
      [/@bbenjamin[- ]?moore@b|@bbm@b/, 'Benjamin Moore'],
      [/@bbehr@b/, 'Behr'],
      [/@bdunn[- ]?edwards@b/, 'Dunn-Edwards'],
      [/@bkelly[- ]?moore@b/, 'Kelly-Moore'],
      [/@bfarrow ?(?:and|&) ?ball@b/, 'Farrow & Ball'],
      [/@bvalspar@b/, 'Valspar'],
      [/@bppg@b/, 'PPG'],
      [/@bglidden@b/, 'Glidden'],
      [/@bfrazee@b/, 'Frazee'],
      [/@bvista@b/, 'Vista'],
    ];
    const painterChoice = /@b(?:painter'?s? (?:choice|call|pick|decision)|up to (?:the )?painter|you (?:pick|choose|decide)|their choice|your choice|doesn'?t matter|don'?t care|no preference|no brand|any(?:thing)? (?:is )?(?:fine|works|ok|okay)|whatever (?:they|you)|not picky|let (?:them|him|her|the painter) (?:pick|choose|decide))@b/.test(low);
    if (!state.ctx.paintBrand) {
      const named = brands.find(([re]) => re.test(low));
      if (named) ctxWithExplicit.paintBrand = named[1];
      else if (asked === 'paint_brand' && painterChoice) ctxWithExplicit.paintBrand = 'painter_choice';
      else if (asked === 'paint_brand' && /@b(?:no|none|nope)@b/.test(low) && !/@bbrand@b/.test(low)) ctxWithExplicit.paintBrand = 'painter_choice';
    }
    if (!state.ctx.paintGrade) {
      if (/@b(?:premium|deluxe|top[- ]?(?:of[- ]the[- ]line|shelf|tier)|high[- ]?end|luxury|best|highest quality|emerald|aura|regal select|duration|super ?paint|the good stuff|nice paint)@b/.test(low)) ctxWithExplicit.paintGrade = 'premium';
      else if (/@b(?:budget|cheap|cheapest|economy|basic|bargain|lowest cost|inexpensive|builder'?s? grade)@b/.test(low) && (asked === 'paint_grade' || /@bpaint@b/.test(low))) ctxWithExplicit.paintGrade = 'economy';
      else if (asked === 'paint_grade' && /@b(?:standard|regular|normal|mid|mid-?grade|middle|average|typical|usual|default|good|decent|medium|ok|okay|fine)@b/.test(low)) ctxWithExplicit.paintGrade = 'standard';
      else if (asked === 'paint_grade' && painterChoice) ctxWithExplicit.paintGrade = 'standard';
      else if (/@b(?:benjamin[- ]?moore|farrow ?(?:and|&) ?ball)@b/.test(low) && asked === 'paint_brand') ctxWithExplicit.paintGrade = 'premium'; // these brands are premium lines by default
    }
    if (!state.ctx.paintFinish) {
      const finish = low.match(/@b(flat|matte|eggshell|satin|semi[- ]?gloss|high[- ]?gloss|gloss|velvet)@b/);
      if (finish) ctxWithExplicit.paintFinish = finish[1].replace(/@s+/g, ' ');
      else if (asked === 'paint_finish' && (painterChoice || /@b(?:no|none|nope)@b/.test(low))) ctxWithExplicit.paintFinish = 'painter_choice';
    }
    if (asked && (asked === 'paint_brand' || asked === 'paint_grade' || asked === 'paint_finish') && !trimmed.endsWith('?')) {
      ctxWithExplicit.extAnswered = [...new Set([...(ctxWithExplicit.extAnswered ?? state.ctx.extAnswered ?? []), asked])];
      // answering one of the paint questions with the others in the same breath ("premium Benjamin Moore") covers them
      if (ctxWithExplicit.paintBrand && ctxWithExplicit.paintGrade) {
        ctxWithExplicit.extAnswered = [...new Set([...(ctxWithExplicit.extAnswered ?? []), 'paint_brand', 'paint_grade'])];
      }
    }
  }

  // Answers to the exterior questions (ext_*): yes adds the thing`);
  // the "@b" markers above are word boundaries (written this way so the file survives shell quoting)
  o.t = o.t.split('@b').join('\\b').split('@s').join('\\s');
  save('src/lib/chatEstimator/chatEngine.ts', o);
}

// ---- price
{
  const o = load('src/lib/estimateEngine.ts');
  rep(o, "  // Low-VOC / eco-friendly paint requested", `  // The paint grade the customer chose. Premium lines cost a good deal more per gallon (and take a bit more care); economy paint costs a
  // little less. "Standard" and "painter's choice" are the usual mid-grade assumption already built into the base rates.
  if (ctx.paintGrade === 'premium') {
    multipliers.push({ label: 'Premium Paint', factor: 1.08 });
  } else if (ctx.paintGrade === 'economy') {
    multipliers.push({ label: 'Economy Paint', factor: 0.97 });
  }

  // Low-VOC / eco-friendly paint requested`);
  save('src/lib/estimateEngine.ts', o);
}

// ---- what painters see
{
  const o = load('src/lib/chatEstimator/responseSummary.ts');
  rep(o, "  'stateComplianceNotes',\n]);", "  'stateComplianceNotes',\n  'extAnswered',\n  'excludedSurfaces',\n  'addedSurfaces',\n  'zipCity',\n]);");
  rep(o, "  lowVocRequested: 'Low-VOC paint requested',", "  lowVocRequested: 'Low-VOC paint requested',\n  paintBrand: 'Paint brand',\n  paintGrade: 'Paint grade',\n  paintFinish: 'Paint finish',");
  save('src/lib/chatEstimator/responseSummary.ts', o);
}
console.log('ok');
