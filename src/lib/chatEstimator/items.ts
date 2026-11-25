// ============================================================================
// Movable items: chairs, tables, dressers... painted on their own (no rooms, no walls)
// ============================================================================
// Recognises the piece (and how many), what is being done to it (repaint, refresh the stain, strip and refinish), what it is made of,
// and whether the customer said it is only furniture. The engine uses this to skip every room question (inside/outside, rooms, walls,
// ceilings, trim, doors, ceiling height, who lives there) and to ask about the pieces instead.

import type { EstimatorContext } from '../types';

export interface ItemMatch {
  /** The key used by the price table (furniture_<key>) */
  key: string;
  /** null = said in the plural without a number ("some chairs") */
  count: number | null;
}

const WORD_NUM: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  couple: 2, pair: 2, 'a couple': 2, 'a pair': 2,
};
// \d{1,3}: a commercial job ("120 chairs" for a restaurant) can give a count well past a house's handful.
const NUM = '(\\d{1,3}|a couple of|a couple|a pair of|a pair|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';

// Order matters: the first pattern that claims a word wins (so "nightstand" is not also a "stand" and "end table" is not a dining table).
const ITEM_PATTERNS: { key: string; re: string; label: [string, string] }[] = [
  { key: 'nightstand', re: 'night[\\s-]?stands?|bed[\\s-]?side tables?', label: ['nightstand', 'nightstands'] },
  { key: 'table_end', re: '(?:end|side|coffee|accent|console|sofa) tables?', label: ['small table', 'small tables'] },
  { key: 'table_dining', re: '(?:dining |kitchen |patio |picnic |farm ?house )?tables?', label: ['table', 'tables'] },
  { key: 'dresser', re: 'dressers?|chests? of drawers|chests?|head[\\s-]?boards?|cribs?|bed ?frames?', label: ['dresser', 'dressers'] },
  { key: 'bookcase', re: 'book[\\s-]?cases?|book[\\s-]?shel(?:f|ves)|shelving units?|etageres?', label: ['bookcase', 'bookcases'] },
  { key: 'desk', re: 'desks?', label: ['desk', 'desks'] },
  { key: 'bench', re: 'benches|bench|ottomans?', label: ['bench', 'benches'] },
  { key: 'lounger', re: 'loungers?|chaises?(?: lounges?)?|lounge chairs?', label: ['lounger', 'loungers'] },
  { key: 'cabinet', re: '(?:china|curio|bar|media|file|storage|display) cabinets?|hutchs?|hutches|buffets?|sideboards?|credenzas?|armoires?|wardrobes?|tv stands?|entertainment centers?', label: ['cabinet', 'cabinets'] },
  { key: 'chair', re: 'chairs?|stools?|bar ?stools?|rockers?|rocking chairs?|high ?chairs?', label: ['chair', 'chairs'] },
];

/** Chair rail is trim, not a chair. */
const stripLookalikes = (t: string) => t.replace(/chair[\s-]*rails?/g, ' ').replace(/\b(?:kitchen|bathroom|vanity|base|wall|upper|lower) cabinets?\b/g, ' ').replace(/\btable ?top\b/g, 'table');

/** Every kind of piece named in the text, with its count when a number was given. */
export function detectItems(text: string): ItemMatch[] {
  const t = stripLookalikes(text.toLowerCase());
  const out: ItemMatch[] = [];
  let rest = t;
  for (const { key, re } of ITEM_PATTERNS) {
    const find = new RegExp(`(?:\\b${NUM}\\s+(?:[a-z-]+\\s+){0,2})?\\b(${re})\\b`, 'g');
    let m: RegExpExecArray | null;
    let count: number | null = null;
    let found = false;
    while ((m = find.exec(rest)) !== null) {
      found = true;
      const word = m[2];
      const plural = /s$|ves$|men$/.test(word) && !/(?:^|\s)(?:glass|bass|chaise lounge)$/.test(word) || /\bbenches\b|\bhutches\b/.test(word);
      if (m[1]) {
        const n = WORD_NUM[m[1].replace(/ of$/, '')] ?? parseInt(m[1], 10);
        count = (count ?? 0) + n;
      } else if (!plural) {
        count = (count ?? 0) + 1;
      }
      rest = rest.slice(0, m.index) + ' '.repeat(m[0].length) + rest.slice(m.index + m[0].length);
      find.lastIndex = m.index + m[0].length;
    }
    if (found) out.push({ key, count });
  }
  return out;
}

export function itemLabel(key: string, count: number): string {
  const l = ITEM_PATTERNS.find((p) => p.key === key)?.label ?? [key, key + 's'];
  return count === 1 ? l[0] : l[1];
}

/** "2 chairs and a table" from the list of pieces on the context (one entry per piece). */
export function itemsPhrase(items: string[]): string {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  const parts = [...counts.entries()].map(([k, n]) => (n === 1 ? `a ${itemLabel(k, 1)}` : `${n} ${itemLabel(k, n)}`));
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0] ?? 'the pieces';
}

/** "furniture", "moveable", "pieces": a piece or pieces of furniture, without saying which. */
export function mentionsGenericFurniture(text: string): boolean {
  return /\b(?:furniture|movable|moveable|portable)\b|\bpieces? of (?:furniture|wood)\b|\bantiques?\b|\bheirlooms?\b/i.test(text);
}

/** The customer says the job is only the pieces: "furniture only", "only chairs", "no walls or ceilings", "nothing in a room", "not a room". */
export function saysItemsOnly(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(?:furniture|chairs?|tables?|pieces?|items?|dressers?|cabinets?|stools?|moveable|movable)\s+only\b/.test(t) ||
    /\bonly\s+(?:the\s+|my\s+|some\s+|a\s+|\d+\s+)?(?:furniture|chairs?|tables?|pieces?|items?|dressers?|stools?)\b/.test(t) ||
    /\b(?:nothing|no)\s+(?:in|at all in)\s+(?:a|the|any)\s+rooms?\b|\bno rooms?\b|\bnot (?:in |painting |doing )?(?:a|any|the)\s+rooms?\b|\bno walls?\b|\bnot (?:painting|doing) (?:any )?(?:walls?|ceilings?)\b/.test(t) ||
    /\b(?:moveable|movable)\s+(?:chairs?|furniture|tables?|items?|objects?)\b/.test(t) ||
    /\bnothing to do with (?:the |my )?(?:chairs?|furniture|tables?|pieces?|items?)\b/.test(t)
  );
}

/** What the customer said about how the pieces are finished and what should be done: "refreshing the stain", "same stain color", "needs sanding". */
export function parseFurnitureFinish(text: string): { treatment?: string; material?: string; sanding?: boolean } {
  const t = text.toLowerCase();
  const out: { treatment?: string; material?: string; sanding?: boolean } = {};
  if (/\b(?:strip(?:ped|ping)?|down to (?:the )?(?:bare )?wood|remove (?:the )?(?:old )?(?:paint|finish|varnish)|sand (?:it |them )?(?:all )?(?:off|down))\b/.test(t)) out.treatment = 'strip_refinish';
  else if (/\b(?:re-?stain(?:ing|ed)?|refresh\w*(?: the)? (?:stain|finish)|refinish\w*|re-?varnish\w*|(?:same|existing|current|matching|natural|original)\s+(?:stain|varnish|wood)|(?:stain|stained|varnish\w*|lacquer\w*|polyurethane|wood finish)\b)/.test(t)) out.treatment = 'restain';
  else if (/\b(?:re-?paint(?:ing|ed)?|paint(?:ed|ing)? over|bare|raw|unfinished|new (?:paint|color|colour)|(?:white|black|grey|gray|blue|red|green)\b|chalk paint|(?:currently|already|is|are|they're|its|it's)\s+painted)\b/.test(t)) out.treatment = 'repaint';
  if (/\b(?:sand|sanded|sanding|sands)\b/.test(t)) out.sanding = true;
  if (/\b(?:metal|iron|steel|aluminum|aluminium)\b/.test(t)) out.material = 'metal';
  else if (/\b(?:wood|wooden|oak|pine|teak|cedar|mahogany|walnut|maple)\b/.test(t)) out.material = 'wood';
  else if (/\b(?:plastic|resin|wicker|rattan|vinyl|laminate)\b/.test(t)) out.material = 'other';
  return out;
}

/** The job is only movable pieces. */
export const isItemsOnly = (c: EstimatorContext): boolean => c.itemsOnly === true;

export const CHAIR_KIND_LABEL: Record<string, string> = { dining: 'dining chairs', arm: 'armchairs', stool: 'bar stools', rocker: 'rocking chairs', upholstered: 'chairs with upholstered seats' };

/** What kind of chairs: said anywhere ("bar stools", "a rocking chair", "chairs with arms") or, when answering, in plain words ("regular dining chairs"). */
export function parseChairKind(text: string, answering: boolean): 'dining' | 'arm' | 'stool' | 'rocker' | 'upholstered' | null {
  const t = text.toLowerCase();
  if (/\brock(?:er|ers|ing)\b/.test(t)) return 'rocker';
  if (/\b(?:bar|counter)[\s-]?stools?\b|\bstools?\b/.test(t)) return 'stool';
  if (/\barm[\s-]?chairs?\b|\bchairs? with arms\b|\bcaptain'?s?[\s-]chairs?\b|\bwing[\s-]?backs?\b|\bclub chairs?\b|\brecliners?\b|\bwith arms\b/.test(t)) return 'arm';
  if (/\b(?:upholster\w*|cushion\w*|padded|fabric|leather) (?:seats?|chairs?)\b|\b(?:seats?|chairs?) (?:are|is|have|has) (?:upholster\w*|cushion\w*|padded)\b/.test(t)) return 'upholstered';
  if (/\b(?:dining|kitchen|desk|folding|side|ladder[\s-]?back|windsor|spindle|slat)[\s-]?chairs?\b|\bdining\b/.test(t)) return 'dining';
  if (answering && /^\s*(?:regular|normal|standard|plain|just|the usual|basic|simple|wood(?:en)?)\b/.test(t)) return 'dining';
  return null;
}

export const CABINET_STYLE_LABEL: Record<string, string> = { slab: 'flat slab doors', shaker: 'shaker doors', raised: 'raised-panel doors', detailed: 'detailed doors (glass, arches or glaze)' };
export const CABINET_CONDITION_LABEL: Record<string, string> = { good: 'cabinets in good shape', grain: 'heavy wood grain to fill', worn: 'worn cabinets needing repair' };

/** The style of the cabinet doors, said anywhere ("shaker", "raised panel") or in answer to the question. */
export function parseCabinetStyle(text: string, answering: boolean): 'slab' | 'shaker' | 'raised' | 'detailed' | null {
  const t = text.toLowerCase();
  if (/\b(?:glass[\s-]?front|glass (?:doors?|panels?|inserts?)|beadboard|ornate|carved|arched|glazed|glaze|distressed|mullion|fancy|very detailed)\b/.test(t)) return 'detailed';
  if (/\braised[\s-]?panels?\b|\bcathedral\b/.test(t)) return 'raised';
  if (/\bshaker\b|\brecessed[\s-]?panels?\b|\bflat[\s-]?panels?\b|\bfive[\s-]?piece\b/.test(t)) return 'shaker';
  if (/\bslab\b|\bflat[\s-]?(?:front|door|cabinet)s?\b|\bplain flat\b|\bmodern flat\b|\bsmooth flat\b/.test(t)) return 'slab';
  if (answering && /^\s*(?:flat|plain|smooth|simple|modern)\b/.test(t)) return 'slab';
  return null;
}

/** How the cabinets are holding up: worn (chips, grease, damage) beats heavy grain (oak) beats good. */
export function parseCabinetCondition(text: string, answering: boolean): 'good' | 'grain' | 'worn' | null {
  const t = text.toLowerCase();
  if (/\b(?:chipped|chipping|peeling|worn|damaged|damage|dings?|dented|scratch\w*|greasy|grease|grimy|sticky|water damage|warped|beat up|beaten|rough shape|needs? repairs?|falling apart|cracked)\b/.test(t)) return 'worn';
  if (/\b(?:oak|open[\s-]?grain|heavy grain|visible grain|deep grain|wood grain|grainy|knotty)\b/.test(t)) return 'grain';
  if (answering && /\b(?:good (?:shape|condition)|great (?:shape|condition)|fine|smooth|no (?:damage|issues?|problems?|chips?)|pretty good|decent|like new|clean|nothing)\b/.test(t)) return 'good';
  return null;
}

export interface ClosetKindsReading { kinds: { reach?: number; small?: number; walkin?: number; large?: number }; typed: boolean }

const CLOSET_N = '(\\d{1,2}|an?|one|two|three|four|five|six|seven|eight|nine|ten|a couple of|couple of|couple)';
const CLOSET_NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, couple: 2, 'couple of': 2, 'a couple of': 2 };

/**
 * How many closets of each kind, from a reply like "3 bedroom closets, a walk-in and a coat closet": standard bedroom reach-ins, small coat / linen / pantry
 * closets, walk-ins, and large walk-ins or dressing rooms. A bare number ("3 closets") is standard ones. `typed` says a kind was actually named.
 */
export function parseClosetKinds(text: string): ClosetKindsReading | null {
  let t = text.toLowerCase();
  const kinds: ClosetKindsReading['kinds'] = {};
  let typed = false;
  const take = (key: 'reach' | 'small' | 'walkin' | 'large', re: RegExp, isTyped: boolean) => {
    t = t.replace(re, (_m, n: string | undefined) => {
      const count = n ? (/^\d/.test(n) ? parseInt(n, 10) : CLOSET_NUM[n] ?? 1) : 1;
      kinds[key] = (kinds[key] ?? 0) + count;
      if (isTyped) typed = true;
      return ' ';
    });
  };
  take('large', new RegExp('(?:\\b' + CLOSET_N + '\\s+)?(?:(?:large|big|huge|oversized|giant|master)\\s+walk[\\s-]?ins?(?:\\s+closets?)?|dressing[\\s-]?rooms?)', 'g'), true);
  take('walkin', new RegExp('(?:\\b' + CLOSET_N + '\\s+)?walk[\\s-]?ins?(?:\\s+closets?)?', 'g'), true);
  take('small', new RegExp('(?:\\b' + CLOSET_N + '\\s+)?(?:(?:coat|linen|pantry|broom|utility|hall(?:way)?|small|tiny|little|shallow|storage|entry)\\s+closets?|pantr(?:y|ies))', 'g'), true);
  take('reach', new RegExp('(?:\\b' + CLOSET_N + '\\s+)?(?:standard|regular|normal|average|bedroom|reach[\\s-]?in|typical|ordinary)\\s+closets?', 'g'), true);
  take('reach', new RegExp('\\b' + CLOSET_N + '\\s+closets?\\b', 'g'), false);
  return Object.keys(kinds).length > 0 ? { kinds, typed } : null;
}

export const closetKindsTotal = (k: { reach?: number; small?: number; walkin?: number; large?: number }): number => (k.reach ?? 0) + (k.small ?? 0) + (k.walkin ?? 0) + (k.large ?? 0);

/** The single `closets` value the rest of the estimator reads: standard, walkin, or both. */
export function closetTypeOf(k: { reach?: number; small?: number; walkin?: number; large?: number }): 'standard' | 'walkin' | 'both' {
  const bigOnes = (k.walkin ?? 0) + (k.large ?? 0) > 0;
  const littleOnes = (k.reach ?? 0) + (k.small ?? 0) > 0;
  return bigOnes && littleOnes ? 'both' : bigOnes ? 'walkin' : 'standard';
}

export function describeClosetKinds(k: { reach?: number; small?: number; walkin?: number; large?: number }): string {
  const bits: string[] = [];
  if (k.reach) bits.push(k.reach + ' standard');
  if (k.small) bits.push(k.small + ' small (coat, linen or pantry)');
  if (k.walkin) bits.push(k.walkin + ' walk-in');
  if (k.large) bits.push(k.large + ' large walk-in');
  return bits.join(', ') + ' closet' + (closetKindsTotal(k) === 1 ? '' : 's');
}
