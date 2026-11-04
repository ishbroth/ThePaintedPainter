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
const NUM = '(\\d{1,2}|a couple of|a couple|a pair of|a pair|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';

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
