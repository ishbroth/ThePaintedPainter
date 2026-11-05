// ============================================================================
// Counts, lengths and areas the customer gives for doors, windows, chairs, fences, decks, overhangs and the smaller trim details
// (crown moulding, chair rail, wainscoting, baseboards, closet shelves, railings, shutters, garage doors).
// ============================================================================
// Used by the follow-up questions in topics.ts ("how many doors?", "how long is the fence, and how tall?", "about how many square feet is the
// deck?") and read the same way from a message that volunteers them. "20 x 20", "20 by 20" and "20x20 ft" are a length and a width: 400 sq ft.
// ============================================================================

import type { EstimatorContext } from '../types';
import { extractCeilingHeight } from './extractors';
import { detectItems, itemsPhrase, mentionsGenericFurniture, parseFurnitureFinish, saysItemsOnly } from './items';

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

// ----------------------------------------------------------------------------------------------------------------------------
// Multi-unit properties and ceiling height
// ----------------------------------------------------------------------------------------------------------------------------

/** Words that make a property a multi-unit one: duplex, triplex, fourplex, "12 unit building", apartment building or complex, townhomes, rental units... */
export const MULTI_UNIT_RE = /\b(?:duplex(?:es)?|triplex(?:es)?|four[\s-]?plex(?:es)?|quad[\s-]?plex(?:es)?|\d[\s-]?plex|multi[\s-]?(?:unit|family)|apartment (?:complex|building|buildings|community|house)|condo(?:minium)?s? (?:complex|building|buildings|community)|town ?homes|town ?houses|rental units|rental properties|units? (?:building|complex)|several units|multiple units|(?:\d{1,3}|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|a dozen)[\s-]+(?:(?!bed)\w+[\s-]+){0,2}(?:units|apartments|condos|town ?homes|town ?houses)\b)/i;

export function isMultiUnitText(text: string): boolean {
  return MULTI_UNIT_RE.test(text);
}

/**
 * How many units are in the job. "12 unit building" and "a duplex" say how many there are in all (`total`); "all 12", "two of the six" and a plain number in
 * answer to the units question say how many are being painted (`painted`).
 */
export function parseUnits(text: string, answering: boolean, knownTotal: number | null): { painted: number | null; total: number | null } {
  const t = digitize(text);
  let painted: number | null = null;
  let total: number | null = null;
  const part = t.match(/\b(\d{1,3})\s+(?:\w+\s+)?(?:of|out of)\s+(?:the\s+|my\s+|our\s+)?(\d{1,3})\b/);
  if (part && parseInt(part[1], 10) <= parseInt(part[2], 10)) {
    painted = parseInt(part[1], 10);
    total = parseInt(part[2], 10);
  }
  const all = t.match(/\ball\s+(?:of\s+)?(?:the\s+|my\s+|our\s+)?(\d{1,3})\b/);
  if (painted == null && all) { painted = total = parseInt(all[1], 10); }
  if (painted == null && answering && /\b(?:all|every|each|whole|entire)\b/.test(t) && knownTotal) painted = knownTotal;
  if (painted == null && total == null) {
    const n = t.match(/\b(\d{1,3})[\s-]+(?:\w+[\s-]+){0,2}?(?:units?|apartments?|condos?|town ?homes?|town ?houses?|rental units?)\b/) || t.match(/\b(\d{1,3})[\s-]?plex\b/);
    if (n && !/\bbed(?:room)?s?\b/.test(n[0])) total = parseInt(n[1], 10);
    else if (/\bduplex/.test(t)) total = 2;
    else if (/\btriplex/.test(t)) total = 3;
    else if (/\b(?:four|quad)[\s-]?plex/.test(t)) total = 4;
  }
  if (painted == null && answering && !part) {
    const c = parseCount(text, 1, 500);
    if (c) painted = c;
  }
  if (painted != null && (painted < 1 || painted > 500)) painted = null;
  if (total != null && (total < 1 || total > 500)) total = null;
  return { painted, total };
}

/** The ceiling height said, or "standard" (8 ft): { height } is the tier for a taller ceiling; { standard: true } when it is the usual height. */
export function parseCeilingAnswer(text: string, answering: boolean): { height: ReturnType<typeof extractCeilingHeight>; standard: boolean } {
  const t = text.toLowerCase();
  const height = extractCeilingHeight(text, answering);
  const standard =
    !height &&
    (/\bstandard\s+(?:ceiling|height)s?\b|\b(?:normal|regular|typical|average)\s+(?:ceiling|height)s?\b|\b(?:8|eight)[\s-]?(?:ft|foot|feet|')\s*(?:tall\s+|high\s+)?ceilings?\b|\bceilings?\b[^.]{0,25}\b(?:standard|normal|regular|(?:8|eight)\s*(?:ft|feet|foot|'))/.test(t) ||
      (answering && /^\W*(?:yes|yeah|yep|yup|yes it is|standard|normal|regular|typical|average|8|eight|8\s*(?:ft|feet|foot|')|eight (?:feet|foot)|sure|i think so|probably|just standard)\b/.test(t)));
  return { height, standard };
}

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

/**
 * The size of the typical unit from what the customer says about the units they know: one size ("about 850 sq ft each"), several ("studios 500, one-bedrooms
 * 700 and twos 950") averaged, or a mix with how many of each ("40 one-bedrooms at 700 and 40 twos at 950") averaged by count. Null if no size is there.
 */
export function parseUnitSizes(text: string, bare = false): { average: number; sizes: number; weighted: boolean } | null {
  const t = digitize(text).replace(/(\d),(\d{3})/g, '$1$2');
  const unit = '(?:sq\\.?\\s*ft\\.?|sqft|sf|square\\s*f(?:ee|oo)t)';
  // "40 one-bedrooms at 700", "30 studios, 450 sq ft each": a count, what they are, then the size
  const withCounts: { n: number; size: number }[] = [];
  const re = new RegExp('(\\d{1,3})\\s+(?:[a-z0-9-]+\\s+){0,3}?(?:units?|apartments?|apts?|studios?|condos?|townhomes?|flats?|bedrooms?|br|bd)\\b[^\\d.]{0,24}?(\\d{3,4})\\s*(?:' + unit + ')?', 'g');
  for (const m of t.matchAll(re)) {
    const n = parseInt(m[1], 10), size = parseInt(m[2], 10);
    if (n >= 1 && n <= 999 && size >= 250 && size <= 4500) withCounts.push({ n, size });
  }
  if (withCounts.length >= 2) {
    const total = withCounts.reduce((a, b) => a + b.n, 0);
    return { average: Math.round(withCounts.reduce((a, b) => a + b.n * b.size, 0) / total), sizes: withCounts.length, weighted: true };
  }
  // plain sizes: every number with a square-foot unit (or, in answer to the size question, every number that looks like one)
  const sizes: number[] = [];
  for (const m of t.matchAll(new RegExp('(\\d{3,4})\\s*(?:' + unit + ')', 'g'))) sizes.push(parseInt(m[1], 10));
  if (sizes.length === 0 && bare) for (const m of t.matchAll(/\b(\d{3,4})\b/g)) sizes.push(parseInt(m[1], 10));
  const ok = sizes.filter((n) => n >= 250 && n <= 4500);
  if (ok.length === 0) return null;
  return { average: Math.round(ok.reduce((a, b) => a + b, 0) / ok.length), sizes: ok.length, weighted: false };
}

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

  // a multi-unit property: how many units there are, or are being painted ("12 unit building", "paint all 8 units", "two of the six")
  if (ctx.propertyType === 'multi_unit' || isMultiUnitText(text)) {
    const u = parseUnits(text, askedId === 'unit_count', ctx.unitsTotal);
    if (u.painted != null && (askedId === 'unit_count' || ctx.unitCount == null)) { patch.unitCount = u.painted; acks.push(u.painted + ' unit' + (u.painted === 1 ? '' : 's')); }
    if (u.total != null && (ctx.unitsTotal == null || askedId === 'unit_count')) patch.unitsTotal = u.total;
    if (u.painted == null && u.total != null && ctx.unitsTotal == null) acks.push(u.total + '-unit property');
    if (askedId === 'building_count') {
      const b = parseCount(text, 1, 100);
      if (b) { patch.buildingCount = b; acks.push(b + ' building' + (b === 1 ? '' : 's')); }
    }
    if (/\b(?:hall(?:way)?s?|corridors?|stair(?:well)?s?|lobb(?:y|ies)|laundry (?:room|area)|common (?:areas?|spaces?)|breezeways?|mail ?rooms?|clubhouse|leasing office)\b/i.test(text) && ctx.commonAreas === '' && !negated(/hall(?:way)?s?|corridors?|stair(?:well)?s?|lobb(?:y|ies)|laundry|common (?:areas?|spaces?)/)) {
      patch.commonAreas = 'yes';
      acks.push('common areas');
    }
  }
  // the size of a typical unit: one size, or the sizes they know averaged (weighted by how many of each, when they say)
  if ((ctx.propertyType === 'multi_unit' || isMultiUnitText(text)) && ctx.projectType !== 'exterior' && !/\?\s*$/.test(text.trim())) {
    const sizes = parseUnitSizes(text, askedId === 'house_size');
    if (sizes && (sizes.sizes >= 2 || askedId === 'house_size' || /\b(?:each|per unit|every unit|a unit|typical unit|average)\b/i.test(text))) {
      patch.squareFeet = sizes.average;
      if (sizes.sizes >= 2) acks.push('units average about ' + sizes.average.toLocaleString('en-US') + ' sq ft');
    }
  }
  // doors counted across the whole property ("200 pre-primed doors" in 80 units) are per unit for the price: 2.5 each
  {
    const unitsHere = patch.unitCount ?? ctx.unitCount ?? ctx.unitsTotal;
    const dm = t.match(/\b(\d{2,4})\s+(?:[a-z-]+\s+){0,3}?doors?\b/);
    if ((ctx.propertyType === 'multi_unit' || patch.propertyType === 'multi_unit' || isMultiUnitText(text)) && unitsHere && unitsHere >= 2 && dm && !/\bgarage\s+doors/.test(t)) {
      const total = parseInt(dm[1], 10);
      if (total >= unitsHere && total <= unitsHere * 30) {
        patch.doorCount = Math.round((total / unitsHere) * 2) / 2;
        if (ctx.interiorDoors === 'none') patch.interiorDoors = 'some';
        patch.doorsIncluded = true;
        acks.push(total + ' doors in all, about ' + patch.doorCount + ' a unit');
      }
    }
  }
  if (askedId === 'common_areas' && !/\?\s*$/.test(text.trim())) {
    if (/^\W*(?:no|nope|nah|none|just the units|only the units|units only|not (?:the )?common)/i.test(text)) { patch.commonAreas = 'no'; }
    else if (/^\W*(?:yes|yeah|yep|yup|sure|please|all of them|both)/i.test(text)) { patch.commonAreas = 'yes'; acks.push('common areas'); }
    const sq = parseArea(text, false);
    if (sq && patch.commonAreas !== 'no') { patch.commonAreaSqft = sq; patch.commonAreas = 'yes'; }
  }
  if (askedId === 'balcony_count' && !/\?\s*$/.test(text.trim())) {
    const n = parseCount(text, 1, 400);
    if (n) { patch.balconyCount = n; acks.push(n + ' balconies'); }
  }
  if (askedId === 'ext_mu_access') {
    // balconies, exterior stairwells, railings and breezeways on the buildings
    if (/\bbalcon/i.test(text) && ctx.balconies === 'none') patch.balconies = 'yes';
    if (/\b(?:stair|railing|rail|breezeway|walkway|catwalk|landing)/i.test(text) && ctx.railings === 'none') patch.railings = 'yes';
    if (/^\W*(?:yes|yeah|yep|yup|sure|all of them|both|all)\b/i.test(text)) {
      if (ctx.balconies === 'none') patch.balconies = 'yes';
      if (ctx.railings === 'none') patch.railings = 'yes';
    }
  }

  // ceiling height: said anywhere ("10 foot ceilings", "standard ceilings"), or in answer to the ceiling question
  if (ctx.projectType !== 'exterior' && !ctx.ceilingHeightKnown) {
    const c = parseCeilingAnswer(text, askedId === 'ceiling_height');
    if (c.height) {
      if (c.height !== ctx.ceilingHeight) patch.ceilingHeight = c.height;
      patch.ceilingHeightKnown = true;
    } else if (c.standard) {
      patch.ceilingHeightKnown = true;
      if (askedId === 'ceiling_height') acks.push('standard ceiling height');
    } else if (askedId === 'ceiling_height' && !/\?\s*$/.test(text.trim())) {
      if (/\b(?:high|tall|taller|higher|lofty|vaulted|cathedral|soaring)\b/i.test(text) || /^\W*(?:no|nope|nah|not standard|not really)\b/i.test(text)) {
        // taller than usual, no height given: priced as 10 ft (the dearer reading), editable after the price
        patch.ceilingHeight = 'ten_plus';
        patch.ceilingHeightKnown = true;
        acks.push('taller ceilings');
      }
    }
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
  // movable pieces to paint (chairs, a table, a dresser...): a patio set is counted piece by piece elsewhere, and chair rail is trim, not a chair
  const itemText = t.replace(/chair[\s-]*rails?/g, ' ');
  const patioSet = /\b(?:patio|outdoor|garden|deck)\s*(?:furniture|set|chairs?|table)|\bloungers?\b|\bchaise\b|\bwrought iron\b/.test(itemText);
  const askedItems = askedId === 'chair_count' || askedId === 'furniture_kind' || askedId === 'furniture_finish';
  const paintVerb = /\b(?:paint(?:ed|ing)?|refinish(?:ed|ing)?|repaint(?:ed|ing)?|restain(?:ed|ing)?|re-stain(?:ed|ing)?|stain(?:ed|ing)?|spray(?:ed|ing)?|sand(?:ed|ing)?|strip(?:ped|ping)?|varnish(?:ed|ing)?)\b/.test(itemText);
  const bareNoun = itemText.trim().split(/\s+/).length <= 5;
  const found = detectItems(itemText);
  if (found.length > 0 && !patioSet && (paintVerb || askedItems || ctx.furnitureItems.length > 0 || ctx.furnitureUnspecified || (bareNoun && !ctx.projectType && ctx.selectedRooms.length === 0))) {
    const list: string[] = [];
    let allCounted = true;
    for (const f of found) {
      if (f.count == null) allCounted = false;
      for (let i = 0; i < Math.min(f.count ?? 1, 60); i++) list.push(f.key);
    }
    // numbers given with the pieces (or when asked how many) replace the guess; a bare repeat of a piece already counted changes nothing
    if (!ctx.furnitureCountKnown || (askedId === 'chair_count' && allCounted)) {
      const kinds = [...new Set([...ctx.furnitureItems, ...list])];
      const merged = askedId === 'chair_count' || ctx.furnitureItems.length === 0
        ? list
        : kinds.flatMap((k) => (list.includes(k) ? list.filter((x) => x === k) : ctx.furnitureItems.filter((x) => x === k)));
      if (merged.slice().sort().join(',') !== ctx.furnitureItems.slice().sort().join(',') || (allCounted && !ctx.furnitureCountKnown)) {
        patch.furnitureItems = merged;
        patch.furnitureUnspecified = false;
        if (merged.includes('chair') && allCounted) patch.chairCount = merged.filter((x) => x === 'chair').length;
        if (allCounted) patch.furnitureCountKnown = true;
        if (!ctx.specialtyServices.includes('furniture')) patch.specialtyServices = [...ctx.specialtyServices, 'furniture'];
        acks.push(itemsPhrase(merged));
      }
    }
  } else if (!patioSet && ctx.furnitureItems.length === 0 && mentionsGenericFurniture(itemText) && (paintVerb || saysItemsOnly(itemText) || bareNoun)) {
    if (!ctx.furnitureUnspecified) patch.furnitureUnspecified = true;
    if (!ctx.specialtyServices.includes('furniture')) patch.specialtyServices = [...ctx.specialtyServices, 'furniture'];
  }
  // sprayed or brushed cabinets, said in passing
  if (!ctx.cabinetMethod && (ctx.cabinets !== 'none' || /\bcabinet|\bvanit/.test(t))) {
    if (/\bspray(?:ed|ing)?\b/.test(t)) patch.cabinetMethod = 'sprayed';
    else if (/\b(?:brushed|brush and roll|brushed and rolled)\b/.test(t)) patch.cabinetMethod = 'brushed';
  }
  if (saysItemsOnly(itemText) && (patch.furnitureItems || ctx.furnitureItems.length > 0 || ctx.furnitureUnspecified)) {
    acks.push(`just ${itemsPhrase(patch.furnitureItems ?? ctx.furnitureItems).replace(/^the pieces$/, 'the furniture')}, no rooms or walls`);
  }
  if (patch.furnitureItems || ctx.furnitureItems.length > 0 || ctx.furnitureUnspecified || patch.furnitureUnspecified) {
    const fin = parseFurnitureFinish(itemText);
    if (fin.treatment && (askedId === 'furniture_finish' || !ctx.furnitureTreatment || (fin.treatment === 'strip_refinish' && ctx.furnitureTreatment !== 'strip_refinish'))) patch.furnitureTreatment = fin.treatment;
    if (fin.material && !ctx.furnitureMaterial) patch.furnitureMaterial = fin.material;
    if (fin.sanding && !ctx.furnitureSanding) patch.furnitureSanding = true;
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
      case 'chair_count': {
        // "3", "a couple", "just the one", or "2 chairs and a table": a lone number counts the one kind of piece
        if (patch.furnitureItems) break; // the counted pieces were read above
        const kinds = [...new Set(ctx.furnitureItems)];
        const n = /\b(?:just|only)?\s*(?:the\s+)?one\b|^\W*(?:a|an)\W*$/i.test(text) ? 1 : parseCount(text, 1, 60);
        if (n && kinds.length >= 1) {
          // one number for several kinds means that many of each
          patch.furnitureItems = kinds.flatMap((k) => Array.from({ length: n }, () => k));
          patch.furnitureCountKnown = true;
          if (kinds.includes('chair')) patch.chairCount = n;
          acks.push(itemsPhrase(patch.furnitureItems));
        }
        break;
      }
      case 'cabinet_count': { const n = parseCount(text, 2, 300); if (n) { patch.cabinetDoorCount = n; acks.push(`${n} doors and drawers`); } break; }
      case 'builtin_count': { const n = parseCount(text, 1, 40); if (n) { patch.builtInCount = n; acks.push(`${n} built-in${n === 1 ? '' : 's'}`); } break; }
      case 'cabinet_scope': {
        const low = text.toLowerCase();
        if (/\b(?:inside|insides|inner|interior|boxes|both|everything|all of it)\b/.test(low) && !/\b(?:no|not|without|don'?t)\b[^.]{0,20}\b(?:inside|insides|boxes)\b/.test(low)) { patch.cabinetScope = 'inside_too'; acks.push('the insides too'); }
        else if (/^\W*(?:no|nope|nah)\b|\b(?:outsides?|outside only|fronts?|just the doors|only the doors|doors only|exterior)\b/.test(low)) { patch.cabinetScope = 'fronts_only'; acks.push('outsides only'); }
        break;
      }
      case 'cabinet_method': {
        const low = text.toLowerCase();
        if (/\bspray/.test(low)) { patch.cabinetMethod = 'sprayed'; acks.push('sprayed'); }
        else if (/\b(?:brush|brushed|roll|rolled|roller|either|fine|painter'?s? (?:choice|call)|up to (?:you|the painter)|no preference|doesn'?t matter)\b/.test(low)) { patch.cabinetMethod = 'brushed'; acks.push('brushed and rolled'); }
        break;
      }
      case 'cabinet_hardware': {
        const low = text.toLowerCase();
        if (/\b(?:replac|new|install|swap|upgrad)/.test(low) && !/\b(?:no|not|don'?t|won'?t)\b[^.]{0,12}\b(?:replac|new)/.test(low)) { patch.hardwareReplacement = 'yes'; acks.push('new hardware'); }
        else if (/\b(?:keep|reuse|re-use|same|existing|stay|staying|as[\s-]is|no|nope|nah|not replacing)\b/.test(low)) acks.push('keeping the hardware');
        break;
      }
      case 'color_change': {
        // for the pieces: "same stain color", "keep it", "refresh the stain" (the same) or "a darker shade", "paint them white" (different)
        if (!(ctx.itemsOnly || patch.furnitureItems)) break;
        const low = text.toLowerCase();
        if (/\b(?:same|existing|current|matching|match|keep|keeping|as is|as it is|refresh\w*|touch(?:ing)? up|original|natural)\b/.test(low) && !/\b(?:different|change|changing|new color|new colour|instead)\b/.test(low)) { patch.interiorColorChange = 'same'; acks.push('the same color going back'); }
        else if (/\b(?:different|change|changing|switch|new|darker|lighter|another|instead|white|black|gr[ae]y|blue|red|green|yellow|navy|cream|espresso|walnut|ebony)\b/.test(low)) { patch.interiorColorChange = 'different'; acks.push('a new color'); }
        break;
      }
      case 'furniture_finish': {
        const fin = parseFurnitureFinish(text);
        if (!fin.treatment && !patch.furnitureTreatment && /\b(?:same|existing|current|matching)\b/.test(text.toLowerCase())) patch.furnitureTreatment = ctx.furnitureTreatment || 'restain';
        if (fin.treatment || fin.material || fin.sanding || patch.furnitureTreatment) acks.push('how the pieces are finished');
        break;
      }
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
  'unit_count', 'building_count', 'ceiling_height', 'common_areas', 'balcony_count', 'ext_mu_access',
  'door_count', 'window_count', 'chair_count', 'furniture_kind', 'furniture_finish', 'cabinet_count', 'cabinet_scope', 'cabinet_method', 'cabinet_hardware', 'builtin_count', 'shutter_count', 'closet_count', 'fence_size', 'fence_height', 'deck_size', 'overhang_size', 'railing_length',
  'detail_rooms', 'detail_feet_crown', 'detail_feet_chair_rail', 'detail_feet_trim', 'detail_sqft_wainscot',
]);
