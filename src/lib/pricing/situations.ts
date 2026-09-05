// ============================================================================
// Situation Library
// ============================================================================
// Narrative pricing rules Isaac feeds over time. Each situation is a story
// ("customer says X, reality is Y, so price Z% more/less") translated into a
// structured record. When a user describes their job in the estimator, each
// situation's triggers are matched against their input + context, and the
// matched adjustments STACK on top of the base pricing engine (never replace).
//
// Interplay:
//   - Reference library (referenceLibrary.ts) produces the base rate.
//   - pricingConfig.ts multipliers (condition, repair extent, etc.) apply.
//   - THEN matched situations multiply on top of that.
// ============================================================================

import type { EstimatorContext } from '../types';

// ===== Types =====

export interface SituationTrigger {
  /** Case-insensitive substring matches against the user's free-text input. */
  keywords?: string[];
  /** Regex patterns (as strings) matched against user input. */
  regex?: string[];
  /** Partial EstimatorContext — all listed fields must equal the user's ctx. */
  contextMatch?: Partial<EstimatorContext>;
}

export interface SituationAdjustment {
  /** Stacks multiplicatively with base price (e.g. 1.15 = +15%). */
  multiplier?: number;
  /** Flat dollar amount added/subtracted after multipliers. */
  addend?: number;
  /** Force confidence band up or down. */
  confidenceShift?: 'up' | 'down';
  /** If true, the matched situation should be surfaced to the user in the estimate explainer. */
  explainToUser?: boolean;
}

export interface Situation {
  id: string;
  title: string;
  /** Plain-English story — what Isaac actually told the estimator. */
  narrative: string;
  /** Short (one sentence) chat-ready version of the narrative, spoken to the user when adjust.explainToUser is true. Falls back to narrative if omitted. */
  userNote?: string;
  trigger: SituationTrigger;
  adjust: SituationAdjustment;
  /** Optional: canonical rate keys this situation relates to. Used for future UI linking. */
  relatedKeys?: string[];
  /** Date the situation was added (YYYY-MM-DD). */
  added: string;
}

export interface MatchedSituation {
  situation: Situation;
  matchedOn: Array<'keyword' | 'regex' | 'contextMatch'>;
}

// ===== Store =====
// Empty to start. Grows as Isaac feeds examples.

export const SITUATIONS: Situation[] = [
  // Example entry shape (commented out — not a live rule):
  // {
  //   id: 'heavy-cobwebs-2-story',
  //   title: 'Two-story exterior with heavy cobwebs/wasps',
  //   narrative:
  //     'On older two-story stucco houses in San Diego I often find heavy cobwebs and wasp nests under the eaves. ' +
  //     'That adds a full day of prep before any paint touches the wall.',
  //   trigger: {
  //     keywords: ['cobwebs', 'wasps', 'wasp nest', 'dirty eaves'],
  //     contextMatch: { projectType: 'exterior' },
  //   },
  //   adjust: { multiplier: 1.08, explainToUser: true },
  //   relatedKeys: ['exterior.siding.stucco'],
  //   added: '2026-04-22',
  // },

  {
    id: 'cabinet-spray-finish',
    title: 'Spray finish requested on cabinets',
    narrative: 'A sprayed factory-smooth finish means pulling every door/drawer, spraying in a controlled area, and extra coats — significantly more labor than brush-and-roll.',
    userNote: "Since you want a sprayed finish on the cabinets, I've priced that in — it's a smoother result but more labor than brush-and-roll.",
    trigger: { keywords: ['spray the cabinets', 'spray finish cabinets', 'sprayed cabinets', 'factory finish cabinets', 'spray my cabinets'] },
    adjust: { multiplier: 1.20, explainToUser: true },
    added: '2026-09-04',
  },
  {
    id: 'faux-finish-specialty',
    title: 'Faux finish / specialty technique',
    narrative: 'Venetian plaster, lime wash, rag rolling, and sponge techniques are slow, skilled work — several times the labor of a flat-color wall.',
    userNote: "That's a specialty technique, not a flat color — I've priced in the extra skill and time it takes.",
    trigger: { keywords: ['venetian plaster', 'lime wash', 'limewash', 'rag rolling', 'sponge painting', 'faux finish'] },
    adjust: { multiplier: 1.35, explainToUser: true },
    added: '2026-09-04',
  },
  {
    id: 'color-match-no-sample',
    title: 'Color matching with no can or code',
    narrative: 'Matching an existing color with no leftover paint and no color code means a trip to the store with a physical sample and a custom match fee.',
    trigger: { keywords: ['color match', 'match the existing color', 'no paint can', "don't know the color", 'match an old color', 'match the current color'] },
    adjust: { addend: 45 },
    added: '2026-09-04',
  },
  {
    id: 'poor-existing-coverage',
    title: 'Poor existing paint coverage needs extra coat',
    narrative: 'When the existing paint job is thin or flashing through, one extra coat is usually needed for full, even coverage.',
    userNote: "Sounds like the existing paint is pretty thin, so I've built in an extra coat for full coverage.",
    trigger: { keywords: ['see-through', 'previous painter did a bad job', 'thin coverage', 'flashing through', 'uneven coverage', 'patchy paint'] },
    adjust: { multiplier: 1.10, explainToUser: true },
    added: '2026-09-04',
  },
  {
    id: 'popcorn-asbestos-test',
    title: 'Popcorn ceiling removal — asbestos testing',
    narrative: 'Popcorn ceilings installed before the early 1980s may contain asbestos — removal requires testing first as standard practice.',
    userNote: "Since you're removing popcorn ceiling, I've included asbestos testing — standard practice for older textured ceilings before any scraping starts.",
    trigger: { keywords: ['asbestos test', 'test for asbestos', 'popcorn ceiling asbestos'], regex: ['popcorn.{0,20}(remov|scrape)'] },
    adjust: { addend: 150, explainToUser: true },
    added: '2026-09-04',
  },
  {
    id: 'historic-district-permit',
    title: 'Historic district / landmark exterior permit',
    narrative: 'Historic districts often require a permit or architectural review before an exterior color change — added coordination time and fees.',
    userNote: "Since it's in a historic district, I've included a placeholder for permit/review coordination — the exact fee varies by city.",
    trigger: { keywords: ['historic district', 'historic home', 'landmark home', 'need a permit', 'requires a permit'] },
    adjust: { addend: 200, explainToUser: true },
    added: '2026-09-04',
  },
  {
    id: 'insurance-bonding-required',
    title: 'Certificate of insurance / bonding required',
    narrative: 'Commercial buildings and some property managers require a certificate of insurance and/or background-checked crew — light admin overhead.',
    trigger: { keywords: ['certificate of insurance', 'proof of insurance', 'need us bonded', 'background check', 'coi required'] },
    adjust: { addend: 75 },
    added: '2026-09-04',
  },
  {
    id: 'customer-supplied-paint',
    title: 'Customer already owns the paint',
    narrative: "Labor-only pricing when the customer supplies their own paint — no markup on materials, but they're responsible for buying enough.",
    userNote: "Since you already have the paint, this is priced as labor-only — just make sure there's enough on hand.",
    trigger: { keywords: ['we already bought the paint', 'we have the paint', 'customer supplied paint', 'using our own paint', 'i already have the paint'] },
    adjust: { multiplier: 0.85, explainToUser: true },
    added: '2026-09-04',
  },
  {
    id: 'tight-schedule-window',
    title: 'Very limited access window',
    narrative: 'A narrow access window (weekends only, a couple hours a day, tenant-coordinated access) breaks up the work and slows the crew down.',
    trigger: { keywords: ['only available weekends', 'only on weekends', 'only a few hours', 'limited window', 'only when tenant is home', 'only when tenants are home'] },
    adjust: { multiplier: 1.08 },
    added: '2026-09-04',
  },
  {
    id: 'pets-kids-extra-care',
    title: 'Pets or young kids at home',
    narrative: 'Active pets or small kids at home mean extra care sealing off work areas and securing materials — beyond standard occupied-home precautions.',
    trigger: { keywords: ['dogs at home', 'cats at home', 'toddler', 'newborn', 'baby at home', 'kids running around', 'pets at home'] },
    adjust: { multiplier: 1.05 },
    added: '2026-09-04',
  },
  {
    id: 'painter-moves-furniture',
    title: 'Painter asked to move furniture',
    narrative: "Some customers want the crew to move and protect furniture themselves rather than doing it beforehand — that's extra labor.",
    trigger: { keywords: ['move the furniture', 'move our furniture', 'can you move the couch', 'move the heavy furniture'] },
    adjust: { addend: 100 },
    added: '2026-09-04',
  },
  {
    id: 'stain-blocking-primer',
    title: 'Water/smoke/nicotine stains need blocking primer',
    narrative: 'Water stains, smoke damage, and nicotine staining bleed through regular paint — they need a dedicated stain-blocking primer coat first.',
    userNote: "Those stains will bleed through regular paint, so I've included a stain-blocking primer coat.",
    trigger: { keywords: ['water stains', 'water damage stain', 'nicotine stains', 'smoke damage', 'smoke stains', 'cigarette smoke'] },
    adjust: { multiplier: 1.08, explainToUser: true },
    added: '2026-09-04',
  },
  {
    id: 'pet-odor-sealing-primer',
    title: 'Pet odor/urine needs sealing primer',
    narrative: 'Pet urine odor in walls needs an odor-sealing primer, not just regular paint — otherwise the smell comes back.',
    userNote: "For the pet odor, I've included a sealing primer — regular paint alone won't stop it from coming back.",
    trigger: { keywords: ['pet urine', 'pet odor', 'urine smell', 'animal odor', 'dog smell in the walls'] },
    adjust: { multiplier: 1.10, explainToUser: true },
    added: '2026-09-04',
  },
  {
    id: 'texture-match-patch',
    title: 'Texture matching on patched drywall',
    narrative: 'Matching orange-peel or knockdown texture on a drywall patch takes a skilled hand — it\'s easy to spot a bad match.',
    trigger: { keywords: ['orange peel texture', 'match the texture', 'knockdown texture', 'texture match'] },
    adjust: { multiplier: 1.08 },
    added: '2026-09-04',
  },
  {
    id: 'skim-coat-repair',
    title: 'Full skim coat needed before paint',
    narrative: 'Walls rough or damaged enough to need a full skim coat are a plastering job before they\'re a painting job.',
    userNote: "Those walls need a full skim coat before paint — I've priced that in separately since it's more like plastering than patching.",
    trigger: { keywords: ['skim coat', 'skim-coat', 'need the walls skim coated'] },
    adjust: { addend: 300, explainToUser: true },
    added: '2026-09-04',
  },
  {
    id: 'exposed-brick-sealer',
    title: 'Exposed interior brick needs sealer first',
    narrative: 'Exposed brick is porous and needs a masonry sealer before paint will hold properly — an extra prep step.',
    trigger: { keywords: ['exposed brick', 'brick wall inside', 'seal the brick before painting'] },
    adjust: { multiplier: 1.10 },
    added: '2026-09-04',
  },
  {
    id: 'clogged-gutters-prep',
    title: 'Gutters need cleaning before exterior work',
    narrative: 'Clogged gutters need clearing before ladders go up against the house — otherwise runoff ruins the fresh paint below.',
    trigger: { keywords: ['gutters are clogged', 'clean the gutters first', 'gutters full of leaves'] },
    adjust: { addend: 60 },
    added: '2026-09-04',
  },
  {
    id: 'coastal-climate-paint-grade',
    title: 'Coastal/extreme climate — premium paint grade',
    narrative: 'Salt air and intense coastal or desert sun break down standard paint fast — a premium, more UV/salt-resistant line lasts meaningfully longer.',
    userNote: "Given the climate there, I've priced in a premium, more weather-resistant paint line — it'll last a lot longer than standard grade.",
    trigger: { keywords: ['coastal', 'salt air', 'beachfront', 'oceanfront', 'desert heat', 'extreme sun exposure'] },
    adjust: { multiplier: 1.06, explainToUser: true },
    added: '2026-09-04',
  },
  {
    id: 'vacation-second-home',
    title: 'Vacation / second home, not full-time residence',
    narrative: "Like a rental, a second home that isn't lived in full-time usually doesn't need the same showroom-perfect finish as a primary residence.",
    userNote: "Since it's a second home rather than where you live full-time, I knocked a bit off — similar logic to a rental.",
    trigger: { keywords: ['vacation home', 'second home', "we don't live there full time", 'weekend house', 'weekend home'] },
    adjust: { multiplier: 0.95, explainToUser: true },
    added: '2026-09-04',
  },
];

// ===== Matching =====

export function addSituation(s: Situation): void {
  SITUATIONS.push(s);
}

/**
 * Test every situation against the user's input + context.
 * Returns matched situations with the subset of trigger clauses that fired.
 */
export function matchSituations(
  userInput: string,
  ctx: Partial<EstimatorContext> = {},
): MatchedSituation[] {
  const haystack = userInput.toLowerCase();
  const matched: MatchedSituation[] = [];

  for (const s of SITUATIONS) {
    const hits: MatchedSituation['matchedOn'] = [];

    if (s.trigger.keywords?.some((k) => haystack.includes(k.toLowerCase()))) {
      hits.push('keyword');
    }

    if (s.trigger.regex?.some((r) => new RegExp(r, 'i').test(userInput))) {
      hits.push('regex');
    }

    if (s.trigger.contextMatch && matchesContext(s.trigger.contextMatch, ctx)) {
      hits.push('contextMatch');
    }

    // A situation fires if ANY of its trigger clauses matches.
    if (hits.length > 0) matched.push({ situation: s, matchedOn: hits });
  }

  return matched;
}

/** Stacked multiplier across all matched situations (1.0 = no adjustment). */
export function stackedMultiplier(matches: MatchedSituation[]): number {
  return matches.reduce(
    (acc, m) => acc * (m.situation.adjust.multiplier ?? 1),
    1,
  );
}

/** Total flat addend across all matched situations. */
export function stackedAddend(matches: MatchedSituation[]): number {
  return matches.reduce((acc, m) => acc + (m.situation.adjust.addend ?? 0), 0);
}

function matchesContext(
  needle: Partial<EstimatorContext>,
  haystack: Partial<EstimatorContext>,
): boolean {
  for (const k of Object.keys(needle) as Array<keyof EstimatorContext>) {
    if ((haystack as Record<string, unknown>)[k] !== (needle as Record<string, unknown>)[k]) {
      return false;
    }
  }
  return true;
}
