// ============================================================================
// How much work each part needs: a repaint, one coat, or a few touch ups
// ============================================================================
// Customers say it part by part: "the living room is going gray, the bedroom stays the same color, and a few touch ups in the hall", "the railings
// only need a refresher", "the exterior trim just needs freshening". A second coat is a fraction of the work once a surface is prepped and coated, so:
//   full      a repaint (a new color, a real repaint)                   100%
//   one_coat  the same color going back on, or a refresher              85%   (about 85% of the price, not 50%)
//   touch_up  spot work next to real work                               70%
// This reads those statements into ctx.roomTreatments (interior rooms) and ctx.areaTreatments (a priced part, keyed by its price line), and says whether
// the job is ONLY touch ups (which we don't really do). The pricing is in estimateEngine (ONE_COAT_FACTOR, TOUCH_UP_FACTOR).
// ============================================================================

import { extractRooms } from './extractors';
import { roomsByDescriptor } from './roomTraits';

export type Tier = 'full' | 'one_coat' | 'touch_up';

const TOUCH_UP = /\btouch(?:ed|es|ing)?[\s-]?ups?\b|\bspot[\s-]?(?:paint|painting|fix|fixes)\b|\ba few (?:spots|marks|scuffs)\b|\bscuffs? (?:and|&) (?:marks|nail)/i;
const ONE_COAT = /\b(?:same colou?r|same as (?:it is|now|before|what it is)|(?:keep|keeping|staying|stays?|stay) (?:the )?(?:same|existing|current) colou?r|matching (?:the )?(?:existing|current) colou?r|one[\s-]coat|1[\s-]coat|single[\s-]coat|(?:just |only )?(?:needs?|wants?) (?:a |just a )?(?:quick |little )?(?:refresh(?:er)?|freshening|freshen(?:ing)? up|facelift|pick[\s-]?me[\s-]?up)|(?:a |just a )?(?:quick |little )?(?:refresh(?:er)?|freshen(?:ing)?(?: up)?)|a fresh coat|just a coat)\b/i;
const NEW_COLOR = /\b(?:new colou?r|different colou?r|changing (?:the )?colou?r|change (?:the )?colou?r|going (?:to|with) (?:a )?(?:\w+ )?(?:gray|grey|white|blue|green|beige|tan|taupe|yellow|red|black|navy|sage|cream|darker|lighter)|going (?:gray|grey|white|blue|green|beige|tan|taupe|yellow|red|black|navy|sage|cream|darker|lighter)|from \w+ to \w+|repaint(?:ed|ing)?|completely|fully)\b/i;

/** What a clause is about besides rooms: a priced part, by its price-line key. */
const PARTS: Array<[RegExp, string]> = [
  [/\bstair(?:s|case|way)?\s*(?:rail(?:ing)?s?|banisters?|spindles?)\b|\bbanisters?\b|\bhand[\s-]?rails?\b|\brail(?:ing)?s\b/i, 'stairs'],
  [/\b(?:exterior|outside) trim\b|\bfascia\b|\bsoffits?\b|\beaves?\b/i, 'ext_trim'],
  [/\bsiding\b|\bstucco\b|\b(?:exterior|outside) walls?\b|\bhouse exterior\b|\bthe (?:whole )?(?:outside|exterior) of (?:the|my) house\b/i, 'ext_body'],
  [/\bgarage doors?\b/i, 'garage_door'],
  [/\b(?:front|entry) doors?\b/i, 'entry_door'],
  [/\bfence\b/i, 'fence'],
  [/\bdeck\b/i, 'deck'],
  [/\bshutters?\b/i, 'ext_shutters'],
  [/\bceilings?\b/i, 'ceilings'],
  [/\bbase[\s-]?boards?\b|\binterior trim\b/i, 'trim'],
  [/\binterior doors?\b|\bdoors?\b/i, 'doors'],
];

/** Generic rooms said without a name ("one room", "another room") take ordinary bedroom-sized rooms, in order. */
const GENERIC_ROOM_POOL = ['bedroom_2', 'bedroom_3', 'bedroom_4', 'bedroom_5', 'master_bedroom'];
const COUNT_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, another: 1, two: 2, three: 3, four: 4 };

export interface TreatmentReading {
  rooms: Record<string, Tier>;
  parts: Record<string, 'one_coat' | 'touch_up'>;
  /** the customer said the rooms that are being repainted are changing color / staying the same color */
  colorChange?: 'different' | 'same';
  /** rooms that were named (so they can be added to the job) */
  namedRooms: string[];
  /** rooms named in the statement with no treatment said for them: the color question is still open for those */
  untreatedRooms: string[];
  /** the whole statement is nothing but touch ups: no real work to price */
  touchUpOnly: boolean;
}

/** One coat or a refresher said in so many words, not just "same color" (which makes an interior a one-coat job but never an exterior). */
const COAT_WORDS = /\b(?:one[\s-]coat|1[\s-]coat|single[\s-]coat|refresh(?:er)?|freshen(?:ing)?|facelift|a fresh coat|just a coat|pick[\s-]?me[\s-]?up)\b/i;
const EXTERIOR_PARTS = ['ext_body', 'ext_trim', 'garage_door', 'entry_door', 'fence', 'deck', 'ext_shutters'];

function tierOf(clause: string): Tier | null {
  if (TOUCH_UP.test(clause)) return 'touch_up';
  if (ONE_COAT.test(clause)) return 'one_coat';
  if (NEW_COLOR.test(clause)) return 'full';
  return null;
}

/** Splits "A, same color, and B touch up" into pieces that each carry a subject, a tier, or both. */
function clausesOf(text: string): string[] {
  return text
    .split(/(?<=[.;!?])\s+|,\s*|\s+(?:and|plus|but|also|while|then|along with|as well as)\s+/i)
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Part words in a clause, ignoring rooms: "the living room" is not "the ceilings". */
function partsIn(clause: string): string[] {
  const found: string[] = [];
  for (const [re, key] of PARTS) if (re.test(clause) && !found.includes(key)) found.push(key);
  // "front door"/"garage door" are not "doors"
  if ((found.includes('entry_door') || found.includes('garage_door')) && found.includes('doors') && !/\binterior doors?\b/i.test(clause)) found.splice(found.indexOf('doors'), 1);
  return found;
}

/** "one room", "another room", "two other rooms": rooms said without a name. */
function genericRoomCount(clause: string): number {
  const m = /\b(a|an|one|another|two|three|four)\s+(?:other |more |additional |different )?rooms?\b/i.exec(clause);
  return m ? COUNT_WORDS[m[1].toLowerCase()] ?? 1 : 0;
}

export function extractTreatments(text: string, usedRooms: string[] = [], projectType = '', traits?: Record<string, { vaulted?: boolean }>): TreatmentReading | null {
  const clauses = clausesOf(text);
  const out: TreatmentReading = { rooms: {}, parts: {}, namedRooms: [], untreatedRooms: [], touchUpOnly: false };
  const pool = GENERIC_ROOM_POOL.filter((r) => !usedRooms.includes(r));
  let sawAny = false;
  let sawReal = false; // something that is real work (not a touch up)
  let sawTouchUp = false;
  let pendingSubjects: { rooms: string[]; parts: string[]; generic: number } | null = null;
  let lastSubjects: { rooms: string[]; parts: string[]; generic: number } | null = null;
  let pendingAt = -2;
  let lastAt = -2;

  const assign = (subj: { rooms: string[]; parts: string[]; generic: number }, tier: Tier, tierText = '') => {
    sawAny = true;
    if (tier === 'touch_up') sawTouchUp = true; else sawReal = true;
    for (const r of subj.rooms) { out.rooms[r] = tier; if (!out.namedRooms.includes(r)) out.namedRooms.push(r); }
    for (let i = 0; i < subj.generic; i++) {
      const r = pool.shift();
      if (r) { out.rooms[r] = tier; out.namedRooms.push(r); }
    }
    for (const p of subj.parts) {
      if (tier === 'full') continue;
      // an exterior part is one coat only when that is asked for outright; "same color" leaves it at 100%
      if (EXTERIOR_PARTS.includes(p) && tier === 'one_coat' && !COAT_WORDS.test(tierText)) continue;
      out.parts[p] = tier;
    }
    // "one coat on the outside of the house" is the body and the trim
    if (subj.parts.includes('ext_body') && tier === 'one_coat' && COAT_WORDS.test(tierText) && /\b(?:outside|exterior|house)\b/i.test(tierText)) out.parts.ext_trim = 'one_coat';
    if (tier === 'full' && subj.rooms.length + subj.generic > 0) out.colorChange = out.colorChange ?? 'different';
    if ((tier === 'one_coat' || tier === 'touch_up') && subj.rooms.length + subj.generic > 0 && out.colorChange !== 'different') out.colorChange = 'same';
  };

  for (let ci = 0; ci < clauses.length; ci++) {
    const clause = clauses[ci];
    // garage doors are not a room called "garage"
    const forRooms = clause.replace(/\bgarage doors?\b/gi, ' ').replace(/\bstair(?:s|case|way)?\s*(?:rail(?:ing)?s?|banisters?)\b/gi, ' ');
    let rooms = extractRooms(forRooms);
    // "the room with the vaulted ceilings", "the other one": a room named by what is different about it
    if (rooms.length === 0) rooms = roomsByDescriptor(clause, usedRooms, traits);
    const parts = partsIn(clause);
    const generic = rooms.length === 0 ? genericRoomCount(clause) : 0;
    const hasSubject = rooms.length + parts.length + generic > 0;
    const tier = tierOf(clause);

    if (hasSubject && tier) {
      const subj = { rooms, parts, generic };
      // a bare list before this ("my living room and kitchen in the same color") takes this clause's tier too
      if (pendingSubjects && pendingAt === ci - 1) assign(pendingSubjects, tier, clause);
      pendingSubjects = null;
      assign(subj, tier, clause);
      lastSubjects = subj;
    } else if (hasSubject && !tier) {
      pendingSubjects = { rooms, parts, generic };
      pendingAt = ci;
      lastSubjects = pendingSubjects;
    } else if (!hasSubject && tier && lastSubjects && lastAt === ci - 1) {
      // "the living room, same color, ..." : the tier belongs to the subject just before it
      assign(pendingSubjects ?? lastSubjects, tier, clause);
      pendingSubjects = null;
    } else {
      pendingSubjects = null; // an unrelated clause in between ends any list
    }
    if (hasSubject) lastAt = ci;
  }

  // An outside job stays at 100% unless the customer is specifically asking for ONE COAT or a refresher on it ("I just want a one coat job on the outside",
  // "the house only needs a quick refresher"): "same color" alone does not make an exterior a one-coat job.
  if (!sawAny && /\b(?:one[\s-]coat|1[\s-]coat|single[\s-]coat|(?:quick |little )?refresh(?:er)?|freshen(?:ing)?(?: up)?)\b/i.test(text) && (projectType === 'exterior' || /\b(?:exterior|outside|the house|my house|our house)\b/i.test(text)) && projectType !== 'interior') {
    out.parts.ext_body = 'one_coat';
    out.parts.ext_trim = 'one_coat';
    sawAny = true;
    sawReal = true;
  }
  if (!sawAny) return null;
  out.untreatedRooms = extractRooms(text.replace(/\bgarage\s+doors?\b/gi, ' ')).filter((r) => !(r in out.rooms));
  // touch ups only: nothing else in the whole statement is real painting
  const withoutTouchUps = text.replace(/\btouch(?:ed|es|ing)?[\s-]?ups?\b/gi, ' ');
  out.touchUpOnly = sawTouchUp && !sawReal && !/\b(?:paint(?:ed|ing)?|repaint\w*|refinish\w*|stain\w*|new colou?r|different colou?r|a door|chairs?|dressers?|tables?|cabinets?|fence|deck)\b/i.test(withoutTouchUps);
  return out;
}

/** True when the customer asks for a touch-up job and nothing else (so there is no real job to hang the touch ups on). */
export function isTouchUpOnly(text: string): boolean {
  if (!TOUCH_UP.test(text)) return false;
  const rest = text.replace(/\btouch(?:ed|es|ing)?[\s-]?ups?\b/gi, ' ').replace(/\bspot[\s-]?(?:paint|painting|fix|fixes)\b/gi, ' ');
  return !/\b(?:paint(?:ed|ing)?|repaint\w*|refinish\w*|stain\w*|new colou?r|different colou?r|a door|doors?|chairs?|dressers?|tables?|cabinets?|fence|deck|ceilings?|exterior|outside|whole|entire|everything)\b/i.test(rest);
}
