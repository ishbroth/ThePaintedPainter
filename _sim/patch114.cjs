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

// ---------------- types
{
  const f = 'src/lib/types.ts';
  const o = load(f);
  rep(o, "  addedSurfaces?: string[];", "  addedSurfaces?: string[];\n  /** Exterior questions (ext_*) the customer has answered, so each is asked once and never counted as answered when it wasn't. */\n  extAnswered?: string[];");
  save(f, o);
}

// ---------------- extractors: a bare number answers the exterior size question; ext answers are not read as interior surface limiters
{
  const f = 'src/lib/chatEstimator/extractors.ts';
  const o = load(f);
  rep(o, "(lastBotTopicId === 'room_size' || lastBotTopicId === 'house_size')", "(lastBotTopicId === 'room_size' || lastBotTopicId === 'house_size' || lastBotTopicId === 'ext_size')");
  rep(o, "const surf = lastBotTopicId && scopeBlockedBy.includes(lastBotTopicId) ?", "const surf = lastBotTopicId && (scopeBlockedBy.includes(lastBotTopicId) || lastBotTopicId.startsWith('ext_')) ?");
  save(f, o);
}

// ---------------- topics: the exterior interview
{
  const f = 'src/lib/chatEstimator/topics.ts';
  const o = load(f);
  rep(o, "  // ——————————————————————————————————————————\n  // Building up the job:", `  // ——————————————————————————————————————————
  // Exterior interview: size, then what else beyond the siding gets painted (one question each), the windows, the shape the
  // outside is in and the repairs it needs, and the color. Each is asked once; location and timing come after.
  // ——————————————————————————————————————————
  {
    id: 'ext_size',
    priority: 46,
    relevant: (c) => isExteriorJob(c) && !c.squareFeet && !c.bedroomCount,
    alreadyAnswered: (c) => !!c.squareFeet || !!c.bedroomCount,
    ask: (c) =>
      pick(
        [
          'About how big is the house, in square feet?',
          "Roughly how many square feet is the house? A rough number is fine.",
        ],
        seed(c),
      ),
    clarify: () => "The size of the house (the living space, not the lot) is what I use to estimate how much surface there is to paint.",
    example: () => "Something like '2,000 square feet', or '4 bedrooms' if you don't know the number.",
  },
  {
    id: 'ext_trim',
    priority: 48.1,
    relevant: (c) => isExteriorJob(c) && c.exteriorTrim !== 'yes',
    alreadyAnswered: (c) => c.exteriorTrim === 'yes' || extDone(c, 'ext_trim'),
    ask: (c) => pick(["Are we painting the trim too? That's the fascia boards and the trim around the windows and doors.", "What about the trim, the fascia and the trim around the windows and doors?"], seed(c)),
    clarify: () => "The trim is the boards that frame the roofline, windows and doors. It's usually painted along with the siding.",
    example: () => "Just say 'yes, the trim too' or 'no, just the siding'.",
  },
  {
    id: 'ext_doors',
    priority: 48.2,
    relevant: (c) => isExteriorJob(c) && c.entryDoor !== 'yes',
    alreadyAnswered: (c) => c.entryDoor === 'yes' || extDone(c, 'ext_doors'),
    ask: (c) => pick(["What about the front door, is that getting painted?", "Is the front door part of the job?"], seed(c)),
    clarify: () => "I mean the front entry door, and any other exterior doors you want painted.",
    example: () => "Just say 'yes, the front door' or 'no'.",
  },
  {
    id: 'ext_garage',
    priority: 48.3,
    relevant: (c) => isExteriorJob(c) && c.garageDoor === 'none',
    alreadyAnswered: (c) => c.garageDoor !== 'none' || extDone(c, 'ext_garage'),
    ask: (c) => pick(["And the garage door?", "Does the garage door get painted too?"], seed(c)),
    clarify: () => "Garage doors are painted separately from the walls, so I want to know whether to include them.",
    example: () => "Just say 'yes, one garage door', 'yes, two' or 'no'.",
  },
  {
    id: 'ext_garage_count',
    priority: 48.35,
    relevant: (c) => isExteriorJob(c) && c.garageDoor === 'single',
    alreadyAnswered: (c) => c.garageDoor === 'double' || extDone(c, 'ext_garage_count'),
    ask: () => 'Is that one garage door, or two?',
    clarify: () => "A two-car garage often has two single doors or one wide double door; either way I just need to know how many there are.",
    example: () => "Just say 'one' or 'two'.",
  },
  {
    id: 'ext_gutters',
    priority: 48.4,
    relevant: (c) => isExteriorJob(c) && c.gutters !== 'yes',
    alreadyAnswered: (c) => c.gutters === 'yes' || extDone(c, 'ext_gutters'),
    ask: (c) => pick(["Do the gutters and downspouts need painting too?", "What about the gutters and downspouts, are those getting painted?"], seed(c)),
    clarify: () => "Gutters and downspouts can be painted to match the house.",
    example: () => "Just say 'yes, the gutters too' or 'no'.",
  },
  {
    id: 'ext_eaves',
    priority: 48.5,
    relevant: (c) => isExteriorJob(c) && c.soffitsEaves !== 'yes',
    alreadyAnswered: (c) => c.soffitsEaves === 'yes' || extDone(c, 'ext_eaves'),
    ask: (c) => pick(["And the eaves and soffits, the underside of the roof overhang?", "Should we include the eaves and soffits?"], seed(c)),
    clarify: () => "The eaves and soffits are the underside of the part of the roof that hangs out past the walls.",
    example: () => "Just say 'yes, the eaves too' or 'no'.",
  },
  {
    id: 'ext_windows',
    priority: 48.6,
    relevant: (c) => isExteriorJob(c) && c.exteriorWindows === 'none',
    alreadyAnswered: (c) => c.exteriorWindows !== 'none' || extDone(c, 'ext_windows'),
    ask: (c) => pick(["What kind of windows does the house have? Vinyl windows don't need painting.", "What are the windows made of?"], seed(c)),
    clarify: () => "Vinyl windows are usually left alone. Wood windows (and French-pane windows with lots of little panes) take real painting time, and aluminum frames sometimes just need the trim around them done.",
    example: () => "Just say 'vinyl', 'wood', 'aluminum', 'French pane', or 'a mix'.",
  },
  {
    id: 'ext_window_count',
    priority: 48.7,
    relevant: (c) => isExteriorJob(c) && c.exteriorWindows !== 'none' && !c.exteriorWindowCount,
    alreadyAnswered: (c) => !!c.exteriorWindowCount || extDone(c, 'ext_window_count'),
    ask: (c) => pick(["About how many windows are getting painted?", "How many windows would that be?"], seed(c)),
    clarify: () => "A rough count of the windows that need painting is fine.",
    example: () => "Something like '12 windows' or 'about 20'.",
  },
  {
    id: 'ext_condition',
    priority: 48.8,
    relevant: (c) => isExteriorJob(c),
    alreadyAnswered: (c) => extDone(c, 'ext_condition'),
    ask: (c) => pick(["How is the paint holding up on the outside right now?", "What shape is the outside in right now?"], seed(c)),
    clarify: () => "I mean whether the paint is in decent shape, or fading, peeling or flaking. Peeling paint needs extra prep.",
    example: () => "Something like 'it's faded but fine' or 'peeling in a few spots'.",
  },
  {
    id: 'ext_repairs',
    priority: 48.9,
    relevant: (c) => isExteriorJob(c),
    alreadyAnswered: (c) => extDone(c, 'ext_repairs'),
    ask: (c) => pick(["Is there any repair work needed before painting?", "Any repairs needed first, like rotted wood, cracks or gaps?"], seed(c)),
    clarify: () => "Repairs are things like rotted wood to replace, cracks in the stucco, or gaps that need caulking before the paint goes on.",
    example: () => "Something like 'a few rotted boards' or 'no repairs needed'.",
  },
  {
    id: 'ext_color',
    priority: 49,
    relevant: (c) => isExteriorJob(c),
    alreadyAnswered: (c) => !!c.exteriorColorChange || extDone(c, 'ext_color'),
    ask: (c) => pick(["Is the house staying the same color, or going a different color?", "Are you keeping the current color, or changing it?"], seed(c)),
    clarify: () => "A new color usually takes an extra coat, and a big change like dark to light takes more.",
    example: () => "Just say 'same color' or 'a different color'.",
  },

  // ——————————————————————————————————————————
  // Building up the job:`);
  rep(o, "export const TOPICS: Topic[] = [", `/** An outside job (the house itself, not just a fence or a deck): the exterior interview applies. */
function isExteriorJob(c: EstimatorContext): boolean {
  return (c.projectType === 'exterior' || c.projectType === 'both') && c.exteriorBody !== 'no';
}

/** An exterior question (ext_*) the customer has already answered. */
function extDone(c: EstimatorContext, id: string): boolean {
  return (c.extAnswered ?? []).includes(id);
}

export const TOPICS: Topic[] = [`);
  save(f, o);
}

// ---------------- clarify labels and typing-box hints
{
  const f = 'src/lib/chatEstimator/clarify.ts';
  const o = load(f);
  rep(o, "  upsell_ceilings: 'whether to add the ceilings',", "  ext_size: 'the size of the house',\n  ext_trim: 'whether the trim is painted',\n  ext_doors: 'whether the front door is painted',\n  ext_garage: 'whether the garage door is painted',\n  ext_garage_count: 'how many garage doors',\n  ext_gutters: 'whether the gutters are painted',\n  ext_eaves: 'whether the eaves and soffits are painted',\n  ext_windows: 'what the windows are made of',\n  ext_window_count: 'how many windows',\n  ext_condition: 'how the paint is holding up',\n  ext_repairs: 'what repairs are needed',\n  ext_color: 'whether the color is changing',\n  upsell_ceilings: 'whether to add the ceilings',");
  save(f, o);
}
{
  const f = 'src/lib/promptHints.ts';
  const o = load(f);
  rep(o, "  upsell_ceilings: 'Add the ceilings?',", "  ext_size: 'Please estimate square feet',\n  ext_trim: 'Paint the trim?',\n  ext_doors: 'Paint the front door?',\n  ext_garage: 'Paint the garage door?',\n  ext_garage_count: 'One or two garage doors?',\n  ext_gutters: 'Paint the gutters?',\n  ext_eaves: 'Paint the eaves and soffits?',\n  ext_windows: 'What are the windows made of?',\n  ext_window_count: 'How many windows?',\n  ext_condition: 'How is the paint holding up?',\n  ext_repairs: 'Any repairs needed?',\n  ext_color: 'Same color or a new one?',\n  upsell_ceilings: 'Add the ceilings?',");
  // the timing fallback must not talk about the house being occupied unless the question did; the wrap-up is its own prompt
  rep(o, "  timeline_and_access: 'When, and is it occupied or empty?',", "  timeline_and_access: 'When would you like it done?',");
  rep(o, "export function composerPrompt(botText: string, topicId?: string | null): string {\n  const q = coreQuestion(botText);", "export function composerPrompt(botText: string, topicId?: string | null): string {\n  // the last question before pricing (\"Anything else I should know?... say 'run it'\")\n  if (/\\brun it\\b/i.test(botText)) return 'Anything else to add?';\n  const q = coreQuestion(botText);");
  save(f, o);
}

// ---------------- engine: answers to the exterior questions, and a wrap-up that fits the job
{
  const f = 'src/lib/chatEstimator/chatEngine.ts';
  const o = load(f);
  rep(o, "  if (state.ctx.exteriorColorChange !== 'different' && ctxWithExplicit.exteriorColorChange === 'different'", `  // Answers to the exterior questions (ext_*): yes adds the thing, no leaves it out, and each answer is recorded so the question isn't
  // asked again (or counted as answered when it wasn't).
  {
    const asked = state.lastBotTopic?.id;
    if (asked && asked.startsWith('ext_')) {
      const low = trimmed.toLowerCase();
      const target = ctxWithExplicit as unknown as Record<string, unknown>;
      const yes = /^\\s*(?:yes|yeah|yep|yup|sure|ok|okay|please|definitely|absolutely|why not|sounds good|do it|go ahead|of course|that too|them too|it too)\\b/.test(low);
      const no = /^\\s*(?:no|nope|nah|not (?:needed|really|this time)|skip|pass|leave (?:it|them)|none|that'?s (?:ok|okay|fine)|no thanks|just the siding)\\b/.test(low);
      const yesNo: Record<string, { field: string; on: string }> = {
        ext_trim: { field: 'exteriorTrim', on: 'yes' },
        ext_doors: { field: 'entryDoor', on: 'yes' },
        ext_garage: { field: 'garageDoor', on: 'single' },
        ext_gutters: { field: 'gutters', on: 'yes' },
        ext_eaves: { field: 'soffitsEaves', on: 'yes' },
      };
      const offer = yesNo[asked];
      if (offer) {
        if (yes && !no) target[offer.field] = offer.on;
        else if (no) target[offer.field] = (state.ctx as unknown as Record<string, unknown>)[offer.field];
        if (asked === 'ext_garage' && /\\b(?:two|2|double|both|pair)\\b/.test(low) && !no) target.garageDoor = 'double';
      }
      if (asked === 'ext_garage_count') {
        if (/\\b(?:two|2|double|both|pair|2-car|two-car)\\b/.test(low)) ctxWithExplicit.garageDoor = 'double';
      }
      if (asked === 'ext_windows') {
        if (/\\bvinyl\\b/.test(low) && !/\\b(?:wood|aluminum|aluminium|french|mix|some)\\b/.test(low)) ctxWithExplicit.exteriorWindows = 'none';
        else if (/\\b(?:wood|wooden|french|divided|pane|panes|grid|grids|mix|mixed|some)\\b/.test(low)) ctxWithExplicit.exteriorWindows = 'full';
        else if (/\\b(?:aluminum|aluminium|metal)\\b/.test(low)) ctxWithExplicit.exteriorWindows = 'trim_only';
        else if (/\\b(?:not sure|don'?t know|no idea|unsure)\\b/.test(low)) ctxWithExplicit.exteriorWindows = 'trim_only';
        if (/\\b(?:french|divided|panes?|grids?)\\b/.test(low) && !ctxWithExplicit.windowTypes.includes('french_pane')) {
          ctxWithExplicit.windowTypes = [...ctxWithExplicit.windowTypes, 'french_pane'];
        }
      }
      if (asked === 'ext_window_count') {
        const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20 };
        const digits = low.match(/\\b(\\d{1,3})\\b/);
        const word = Object.keys(words).find((w) => new RegExp('\\\\b' + w + '\\\\b').test(low));
        const n = digits ? parseInt(digits[1], 10) : word ? words[word] : null;
        if (n && n > 0 && n < 200) ctxWithExplicit.exteriorWindowCount = n;
      }
      if (asked === 'ext_condition') {
        if (/\\b(?:peeling|peel|flaking|flake|chipping|chipped|bad|rough|terrible|awful|failing|cracking|blistering|bare|worn out|rundown|run down)\\b/.test(low)) ctxWithExplicit.exteriorCondition = 'poor';
        else if (/\\b(?:fading|faded|fade|worn|dull|chalky|some|okay|ok|fair|so-so|older|dated|dirty|mildew)\\b/.test(low)) ctxWithExplicit.exteriorCondition = 'fair';
        else if (/\\b(?:good|great|fine|excellent|decent|new|pristine|solid|nice)\\b/.test(low)) ctxWithExplicit.exteriorCondition = 'good';
        if (/\\b(?:peeling|flaking|chipping|blistering)\\b/.test(low) && !ctxWithExplicit.prepWork.includes('power_washing')) ctxWithExplicit.prepWork = [...ctxWithExplicit.prepWork, 'power_washing'];
      }
      if (asked === 'ext_repairs' && !no) {
        const prep = new Set(ctxWithExplicit.prepWork);
        if (/\\b(?:rot|rotted|rotten|rotting|dry rot|soft wood|damaged wood|wood damage)\\b/.test(low)) prep.add('wood_rot');
        if (/\\b(?:caulk|caulking|gaps?|seams?|cracks?|cracked|stucco|holes?)\\b/.test(low)) {
          prep.add('caulking');
          if (ctxWithExplicit.caulkingExtent !== 'extensive') ctxWithExplicit.caulkingExtent = /\\b(?:lots|many|extensive|everywhere|all over)\\b/.test(low) ? 'extensive' : 'moderate';
        }
        if (/\\b(?:mold|mildew|moss|algae)\\b/.test(low)) prep.add('mold_treatment');
        if (yes && prep.size === ctxWithExplicit.prepWork.length) prep.add('caulking'); // "yes, some repairs" without detail: priced as typical caulking and patching
        ctxWithExplicit.prepWork = [...prep];
      }
      if (asked === 'ext_color') {
        if (/\\b(?:same|keep|keeping|current|existing|match|matching|stay|staying)\\b/.test(low) && !/\\bdifferent|new color|change\\b/.test(low)) ctxWithExplicit.exteriorColorChange = 'same';
        else if (/\\b(?:different|new|change|changing|switch|switching|another|dark|light|paint it)\\b/.test(low)) ctxWithExplicit.exteriorColorChange = 'different';
      }
      // a question back ("what do you mean?") is not an answer
      if (!trimmed.endsWith('?')) {
        ctxWithExplicit.extAnswered = [...new Set([...(state.ctx.extAnswered ?? []), asked])];
      }
    }
  }
  if (state.ctx.exteriorColorChange !== 'different' && ctxWithExplicit.exteriorColorChange === 'different'`);
  rep(o, "              \"Anything else I should know, like the ceiling height? \" +", "              `Anything else I should know, like ${\n                ctxNext.projectType === 'exterior'\n                  ? 'fences, overhangs, chimneys, decks or shutters'\n                  : ctxNext.projectType === 'both'\n                    ? 'the ceiling height, fences, decks or shutters'\n                    : 'the ceiling height'\n              }? ` +");
  save(f, o);
}
console.log('ok');
