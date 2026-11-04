// ============================================================================
// Counts, lengths and areas the customer gives for doors, windows, chairs, fences, decks, overhangs and the smaller trim details
// (crown moulding, chair rail, wainscoting, baseboards, closet shelves, railings, shutters, garage doors).
// ============================================================================
// Used by the follow-up questions in topics.ts ("how many doors?", "how long is the fence, and how tall?", "about how many square feet is the
// deck?") and read the same way from a message that volunteers them. "20 x 20", "20 by 20" and "20x20 ft" are a length and a width: 400 sq ft.
// ============================================================================

import type { EstimatorContext } from '../types';

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, eighteen: 18, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  dozen: 12, couple: 2, pair: 2, few: 3,
};

/** Spelled-out numbers become digits ("six foot fence" -> "6 foot fence", "a dozen" -> "12"), so the digit rules read both. */
function digitize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\ba\s+dozen\b|\bdozen\b/g, '12')
    .replace(/\ba\s+couple(?:\s+of)?\b|\bcouple(?:\s+of)?\b/g, '2')
    .replace(/\ba\s+few\b/g, '3')
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|eighteen|twenty|thirty|forty|fifty)\b/g, (w) => String(NUMBER_WORDS[w]));
}

const num = (s: string): number => parseFloat(s.replace(/,/g, ''));

/** A plain count ("12", "about 8", "twelve", "a dozen", "a couple"). Null when no number is there or it is outside min..max. */
export function parseCount(text: string, min = 1, max = 200): number | null {
  const t = digitize(text);
  // a dimension pair ("3 x 6") is not a count
  if (parseDimensionPair(t)) return null;
  const m = t.match(/\b(\d{1,3}(?:,\d{3})*)\b/);
  if (!m) return null;
  const n = Math.round(num(m[1]));
  return n >= min && n <= max ? n : null;
}

/** A length and a width: "20 x 20", "20 by 20", "20x20 ft", "20' x 20'", "12.5 by 14". Null when there is no such pair. */
export function parseDimensionPair(text: string): { a: number; b: number; area: number } | null {
  const m = text.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(?:ft\.?|feet|foot|'|’)?\s*(?:x|by|×|\*)\s*(\d+(?:\.\d+)?)\s*(?:ft\.?|feet|foot|'|’)?(?![\d])/);
  if (!m) return null;
  const a = parseFloat(m[1]);
  const b = parseFloat(m[2]);
  if (!isFinite(a) || !isFinite(b) || a <= 0 || b <= 0) return null;
  return { a, b, area: Math.round(a * b) };
}

/**
 * An area in square feet: "400 sq ft", "20 x 20" (400), "20 by 20 feet", or, when the reply is the answer to an area question (`bare`), a plain number.
 * Null when nothing sensible was said (outside 10 to 10,000 sq ft).
 */
export function parseArea(text: string, bare = false): number | null {
  const t = digitize(text);
  const explicit = t.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft\.?|sqft|square\s*(?:feet|foot|ft)|sf)\b/);
  if (explicit) {
    const n = Math.round(num(explicit[1]));
    return n >= 10 && n <= 10000 ? n : null;
  }
  const pair = parseDimensionPair(t);
  if (pair) return pair.area >= 10 && pair.area <= 10000 ? pair.area : null;
  if (bare) {
    const m = t.match(/(?:^|[^\d.])(\d[\d,]*)(?![\d.]*\d)/);
    if (m) {
      const n = Math.round(num(m[1]));
      return n >= 10 && n <= 10000 ? n : null;
    }
  }
  return null;
}

/** Linear feet: "150 feet", "150 ft", "150 linear feet", "150 lf", or (when answering a length question) a plain number. */
export function parseLinearFeet(text: string, bare = false, min = 3, max = 20000): number | null {
  const t = digitize(text);
  const m = t.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:linear\s*|lin\.?\s*)?(?:feet|foot|ft\.?|lf|')/);
  let n: number | null = m ? Math.round(num(m[1])) : null;
  if (n == null && bare) {
    const b = t.match(/(?:^|[^\d.])(\d[\d,]*)(?![\d.]*\d)/);
    if (b) n = Math.round(num(b[1]));
  }
  return n != null && n >= min && n <= max ? n : null;
}

/** A fence: how long it is and how tall ("about 150 feet, 6 ft tall", "100 ft of 4 foot picket", "150 x 6"). Each is null when not said. */
export function parseFenceAnswer(text: string, bare = true): { feet: number | null; height: number | null } {
  let t = digitize(text);
  let height: number | null = null;
  const tall =
    t.match(/(\d{1,2}(?:\.\d+)?)\s*(?:-\s*)?(?:ft\.?|feet|foot|')\s*(?:tall|high)\b/) ||
    t.match(/\b(?:height|tall|high)\b\D{0,14}?(\d{1,2}(?:\.\d+)?)\b/) ||
    t.match(/(\d{1,2}(?:\.\d+)?)\s*(?:-\s*)?(?:ft\.?|feet|foot|')\s*(?:\w+\s+){0,2}fence\b/);
  if (tall) {
    const h = parseFloat(tall[1]);
    if (h >= 2 && h <= 12) {
      height = h;
      t = t.replace(tall[0], ' ');
    }
  }
  let feet: number | null = null;
  const pair = height == null ? parseDimensionPair(t) : null;
  if (pair && Math.min(pair.a, pair.b) <= 12 && Math.max(pair.a, pair.b) >= 10) {
    feet = Math.round(Math.max(pair.a, pair.b));
    height = Math.min(pair.a, pair.b);
  } else {
    feet = parseLinearFeet(t, bare, 8, 3000);
  }
  return { feet, height };
}

// ----------------------------------------------------------------------------------------------------------------------------
// What a message mentions (read the same whichever reader handled the rest of it)
// ----------------------------------------------------------------------------------------------------------------------------

export const CHAIR_RAIL_RE = /\bchair[\s-]*rails?\b/i;
export const CROWN_RE = /\bcrown\s*-?\s*(?:molding|moulding)s?\b|\bcrown\b(?=[^.]{0,20}\b(?:paint|trim|molding|moulding)\b)/i;
export const WAINSCOT_RE = /\bwainscot(?:t)?(?:ing)?\b|\bbead\s*board\b|\bboard and batten\b|\b(?:wall|wood|picture frame)\s+panell?ing\b|\bpanell?ing\b/i;
export const CLOSET_SHELF_RE = /\bclosets?\s+(?:shelves|shelving|shelf|rods?)\b|\b(?:shelves|shelving|shelf)\s+(?:in|inside|of)\s+(?:the\s+|my\s+|our\s+)?closets?\b|\bpantry\s+shelv/i;
const INTERIOR_WINDOWS_RE = /\bwindows?\s*(?:frames?|trim|sills?|casings?|jambs?)\b|\b(?:paint|painting|include|including|and|plus|with)\s+(?:the\s+|all\s+(?:the\s+)?|all\s+of\s+the\s+)?windows?\b|\bwindows?\s+(?:too|as well|included)\b/i;

/** The trim details a message names (they are interior by nature). */
export function mentionedDetails(text: string): { chairRail: boolean; crown: boolean; wainscot: boolean; closetShelves: boolean } {
  return { chairRail: CHAIR_RAIL_RE.test(text), crown: CROWN_RE.test(text), wainscot: WAINSCOT_RE.test(text), closetShelves: CLOSET_SHELF_RE.test(text) };
}

/**
 * The job is only the small trim details (crown moulding, chair rail, wainscoting, baseboards, closet shelves...), nothing else inside:
 * walls and ceilings are out and something of that kind is in.
 */
export function isIsolatedDetailJob(c: EstimatorContext): boolean {
  return (
    (c.projectType === 'interior' || c.projectType === 'both') &&
    c.interiorWalls === 'no' &&
    c.interiorCeilings === 'no' &&
    c.cabinets === 'none' &&
    c.surfacesAddressed &&
    (c.crownMolding === 'yes' || c.chairRail === 'yes' || c.wainscoting === 'yes' || c.interiorTrim === 'yes')
  );
}

/** An average room has about this much trim run along its walls (perimeter less the door openings). */
export const TRIM_FEET_PER_ROOM = 44;

type Patch = Partial<EstimatorContext>;

/**
 * Facts about the small details in a message: crown moulding, chair rail, wainscoting, closet shelves, interior windows; counts of doors, windows and
 * shutters said in passing; and the answer to whichever follow-up question was just asked (`askedId`). Returns what is new, with short acknowledgements.
 */
export function extractDetails(text: string, ctx: EstimatorContext, askedId: string | null): { patch: Patch; acks: string[] } {
  const patch: Patch = {};
  const acks: string[] = [];
  const t = digitize(text);
  const mention = mentionedDetails(text);
  const interiorish = ctx.projectType !== 'exterior';
  const negated = (re: RegExp) => new RegExp('\\b(?:no|not|without|skip|except|don\'?t (?:need|want|paint))\\s+(?:the\\s+|any\\s+)?(?:' + re.source + ')', 'i').test(text);

  if (mention.chairRail && ctx.chairRail !== 'yes' && !negated(CHAIR_RAIL_RE)) { patch.chairRail = 'yes'; acks.push('chair rail'); }
  if (mention.crown && ctx.crownMolding !== 'yes' && !negated(CROWN_RE)) { patch.crownMolding = 'yes'; acks.push('crown moulding'); }
  if (mention.wainscot && ctx.wainscoting !== 'yes' && !negated(WAINSCOT_RE)) { patch.wainscoting = 'yes'; acks.push('wainscoting'); }
  if (mention.closetShelves && ctx.closets === 'none' && !negated(CLOSET_SHELF_RE)) {
    patch.closets = 'standard';
    if (ctx.closetShelving === 'none') patch.closetShelving = /\bwire\b/i.test(text) ? 'wire' : 'built_in';
    acks.push('closet shelves');
  }
  if (interiorish && ctx.interiorWindows === 'none' && INTERIOR_WINDOWS_RE.test(text) && !/\b(?:exterior|outside|outdoor)\b/i.test(text) && (ctx.projectType === 'interior' || ctx.projectType === 'both' || /\b(?:inside|interior|indoors?|bedrooms?|bathrooms?|kitchen|living room|dining room|hallway|office|nursery|closets?|basement|apartment|condo|rooms?)\b/i.test(text)) && !negated(/windows?/)) {
    patch.interiorWindows = 'some';
    acks.push('window frames');
  }
  if ((mention.chairRail || mention.crown || mention.wainscot || mention.closetShelves) && !ctx.projectType) patch.projectType = 'interior';
  // the interior doors named as part of the job (not the front door, garage door or an exterior door, and not ruled out)
  if (interiorish && !ctx.doorsIncluded && ctx.interiorDoors !== 'none') {
    const inside = text.toLowerCase().replace(/\b(?:garage|front|entry|exterior|outside|screen|patio|storm|back|barn)\s+doors?\b/g, ' ');
    const everything = askedId === 'surfaces' && /\b(everything|all of it|the works|full (?:scope|package)|(?:the )?whole (?:thing|room|place|house|home|apartment|unit))\b/.test(inside);
    if ((/\bdoors?\b/.test(inside) && !negated(/doors?/) && !/\b(?:just|only)\b[^.]{0,30}\b(?:walls?|ceilings?)\b/.test(inside)) || everything) patch.doorsIncluded = true;
  }

  // measurements said along the way
  const pluralCount = (word: RegExp) => {
    const m = t.match(new RegExp('\\b(\\d{1,3})\\s+(?:(?:interior|bedroom|closet|wood(?:en)?|french|old|new|paneled|panel|solid|hollow|sliding|bi-?fold|pocket|double|single|small|big|large|bathroom|kitchen|exterior)\\s+){0,2}' + word.source + '\\b'));
    return m ? parseInt(m[1], 10) : null;
  };
  const doors = pluralCount(/doors/);
  if (doors && doors >= 1 && doors <= 80 && ctx.doorCount == null && !/\bgarage\s+doors/.test(t) && askedId !== 'door_count') {
    patch.doorCount = doors;
    if (ctx.interiorDoors === 'none') patch.interiorDoors = 'some';
    acks.push(`${doors} doors`);
  }
  const windows = pluralCount(/windows/);
  if (windows && windows >= 1 && windows <= 100 && interiorish && ctx.windowCount == null && ctx.projectType !== 'exterior' && askedId !== 'window_count' && askedId !== 'ext_window_count' && (ctx.interiorWindows !== 'none' || patch.interiorWindows)) {
    patch.windowCount = windows;
    acks.push(`${windows} windows`);
  }
  const shutters = pluralCount(/shutters/);
  if (shutters && shutters >= 1 && shutters <= 60) {
    if (/\binterior\b|\binside\b/.test(t) && ctx.interiorShutterCount == null) patch.interiorShutterCount = shutters;
    else if (ctx.exteriorShutterCount == null && askedId !== 'shutter_count') patch.exteriorShutterCount = shutters;
  }
  const chairs = t.match(/\b(\d{1,2})\s+(?:\w+\s+){0,2}chairs\b/);
  if (chairs && ctx.chairCount == null && askedId !== 'chair_count') patch.chairCount = parseInt(chairs[1], 10);
  // chairs to paint (not the chair rail, and not a patio set, which is counted piece by piece elsewhere)
  const chairText = t.replace(/chair[\s-]*rails?/g, ' ');
  if (/\bchairs?\b/.test(chairText) && /\b(?:paint|painting|refinish|repaint|restain|spray)\b/.test(chairText) && !ctx.furnitureItems.includes('chair') && !/\b(?:patio|outdoor|garden|deck)\s*(?:furniture|set|chairs?|table)|\bloungers?\b|\bchaise\b|\bwrought iron\b/.test(chairText)) {
    patch.furnitureItems = [...ctx.furnitureItems, 'chair'];
    if (!ctx.specialtyServices.includes('furniture')) patch.specialtyServices = [...ctx.specialtyServices, 'furniture'];
    acks.push('chairs');
  }
  if (ctx.chairRailLinearFeet == null) {
    const m = t.match(/(\d[\d,]*)\s*(?:linear\s*|lin\.?\s*)?(?:feet|foot|ft\.?|lf)\s*(?:of\s*)?(?:the\s*)?chair[\s-]*rail/) || t.match(/chair[\s-]*rails?\b[^.]{0,30}?(\d[\d,]*)\s*(?:linear\s*|lin\.?\s*)?(?:feet|foot|ft\.?|lf)\b/);
    if (m) {
      const n = Math.round(num(m[1]));
      if (n >= 5 && n <= 5000) patch.chairRailLinearFeet = n;
    }
  }
  if (ctx.wainscotSqft == null && mention.wainscot) {
    const m = t.match(/(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|square\s*(?:feet|foot|ft))[^.]{0,20}(?:wainscot|bead\s*board|panel)|(?:wainscot|bead\s*board|panel)[^.]{0,30}?(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|square\s*(?:feet|foot|ft))/);
    if (m) {
      const n = Math.round(num(m[1] || m[2]));
      if (n >= 10 && n <= 5000) patch.wainscotSqft = n;
    }
  }

  // a fence or an overhang described in passing ("my 150 foot fence, 6 ft tall", "a 12 x 20 patio cover"); a clause at a time so the numbers belong to it
  for (const clause of text.split(/[.;!?\n]/)) {
    if (/\bfences?\b/i.test(clause)) {
      const f = parseFenceAnswer(clause, false);
      if (f.feet && ctx.fenceLinearFeet == null && patch.fenceLinearFeet == null && askedId !== 'fence_size') patch.fenceLinearFeet = f.feet;
      if (f.height && ctx.fenceHeightFt == null && patch.fenceHeightFt == null && askedId !== 'fence_size' && askedId !== 'fence_height') patch.fenceHeightFt = f.height;
    }
    if (/\b(?:overhangs?|patio\s*covers?|porch\s*(?:roof|ceiling)|pergola|carport)\b/i.test(clause) && ctx.overhangSqft == null && askedId !== 'overhang_size') {
      const a = parseArea(clause, false);
      if (a) patch.overhangSqft = a;
    }
  }

  // the answer to the follow-up question just asked
  if (askedId && !/\?\s*$/.test(text.trim())) {
    switch (askedId) {
      case 'door_count': { const n = parseCount(text, 1, 80); if (n) { patch.doorCount = n; acks.push(`${n} doors`); } break; }
      case 'window_count': { const n = parseCount(text, 1, 100); if (n) { patch.windowCount = n; acks.push(`${n} windows`); } break; }
      case 'chair_count': { const n = parseCount(text, 1, 60); if (n) { patch.chairCount = n; acks.push(`${n} chairs`); } break; }
      case 'shutter_count': {
        const n = parseCount(text, 1, 60);
        if (n) {
          if (ctx.exteriorShutters === 'yes') patch.exteriorShutterCount = n;
          else patch.interiorShutterCount = n;
          acks.push(`${n} shutters`);
        }
        break;
      }
      case 'closet_count': { const n = parseCount(text, 1, 40); if (n) { patch.closetCount = n; acks.push(`${n} closets`); } break; }
      case 'ext_garage_count': break;
      case 'fence_size': {
        const f = parseFenceAnswer(text);
        if (f.feet && ctx.fenceLinearFeet == null) { patch.fenceLinearFeet = f.feet; acks.push(`${f.feet} ft of fence`); }
        if (f.height) { patch.fenceHeightFt = f.height; acks.push(`${f.height} ft tall`); }
        break;
      }
      case 'fence_height': {
        const f = parseFenceAnswer(text);
        const h = f.height ?? parseCount(text, 2, 12);
        if (h) { patch.fenceHeightFt = h; acks.push(`${h} ft tall`); }
        break;
      }
      case 'deck_size': { const a = parseArea(text, true); if (a) { patch.deckSqft = a; acks.push(`${a} sq ft deck`); } break; }
      case 'overhang_size': { const a = parseArea(text, true); if (a) { patch.overhangSqft = a; acks.push(`${a} sq ft overhang`); } break; }
      case 'railing_length': { const n = parseLinearFeet(text, true, 3, 500); if (n) { patch.stairRailFeet = n; acks.push(`${n} ft of railing`); } break; }
      case 'detail_rooms': { const n = parseCount(text, 1, 40); if (n) { patch.detailRoomCount = n; acks.push(`${n} room${n === 1 ? '' : 's'}`); } break; }
      case 'detail_feet_crown': { const n = parseLinearFeet(text, true, 5, 5000); if (n) { patch.crownLinearFeet = n; acks.push(`${n} ft of crown`); } break; }
      case 'detail_feet_chair_rail': { const n = parseLinearFeet(text, true, 5, 5000); if (n) { patch.chairRailLinearFeet = n; acks.push(`${n} ft of chair rail`); } break; }
      case 'detail_feet_trim': { const n = parseLinearFeet(text, true, 5, 20000); if (n) { patch.trimLinearFeet = n; acks.push(`${n} ft of baseboard`); } break; }
      case 'detail_sqft_wainscot': { const a = parseArea(text, true); if (a) { patch.wainscotSqft = a; acks.push(`${a} sq ft of wainscoting`); } break; }
    }
  }
  return { patch, acks };
}

/** Topic ids of the follow-up questions in this file (their answers are recorded so they are never asked twice). */
export const DETAIL_TOPIC_IDS = new Set([
  'door_count', 'window_count', 'chair_count', 'shutter_count', 'closet_count', 'fence_size', 'fence_height', 'deck_size', 'overhang_size', 'railing_length',
  'detail_rooms', 'detail_feet_crown', 'detail_feet_chair_rail', 'detail_feet_trim', 'detail_sqft_wainscot',
]);
