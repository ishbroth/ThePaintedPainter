// ============================================================================
// Jobs made of several different things
// ============================================================================
// "A door, a chair and the soffit on one side of my house", "my living room and the stair railings", "two interior doors and my front door". The rest
// of the estimator reads one kind of job at a time (a whole house, a furniture job, a railing, an exterior), so a request that mixes kinds used to lose
// parts of itself (the chair dropped) or gain parts nobody asked for (the whole inside walls, the siding). When one statement names two or more
// different kinds of work, this settles ONE consistent scope from it: only what was named is priced, and the questions that follow are about those parts.
// Single-kind requests are left to the existing readers.
// ============================================================================

import type { EstimatorContext } from '../types';
import { extractRooms } from './extractors';
import { detectItems } from './items';

type Patch = Partial<EstimatorContext>;

const STAIR_RAIL = /\bstair(?:s|case|way)?\s*(?:rail(?:ing)?s?|banisters?|spindles?)\b|\bbanisters?\b|\bhand[\s-]?rails?\b/i;
const OTHER_DOOR = /\b(?:front|entry|garage|exterior|outside|patio|sliding|screen|back|barn|french)\s+doors?\b/gi;
const SOFFIT = /\bsoffits?\b|\beaves?\b/i;
const FASCIA_OR_TRIM = /\bfascia\b|\b(?:exterior|outside)\s+trim\b/i;
const ENTRY = /\b(?:front|entry)\s+door\b/i;
const GARAGE_DOOR = /\bgarage\s+doors?\b/i;
const FENCE = /\bfence\b/i;
const DECK = /\bdeck\b/i;
/** The whole outside of the house: then the siding is part of the job, and nothing here narrows it. */
const BODY = /\bhouse exterior\b|\bexterior of (?:the|my|our) (?:whole )?house\b|\b(?:the )?whole (?:outside|exterior|house)\b|\bsiding\b|\bstucco\b|\boutside of (?:the|my|our) house\b|\b(?:paint|painting|repaint)\w* (?:the |my |our )?(?:whole )?house\b|\bexterior (?:paint|job|painting)\b/i;
const INTENT = /\b(?:need|needs|want|wants|looking|would like|quote|get|have|paint(?:ed|ing)?|refinish|restain|redo|done|do)\b/i;

const NUM_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, couple: 2, three: 3, few: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

function interiorDoorCount(text: string): number | null {
  const t = text.replace(OTHER_DOOR, ' ');
  if (!/\bdoors?\b/i.test(t)) return null;
  const m = /\b(\d{1,2}|an?|one|two|couple of|couple|three|few|four|five|six|seven|eight|nine|ten)\s+(?:(?:interior|bedroom|closet|wood(?:en)?|paneled|old|new|bathroom|bi-?fold|pocket)\s+){0,2}doors?\b/i.exec(t);
  if (!m) return /\binterior doors?\b/i.test(t) ? 1 : null; // a bare "doors" is a surface ("walls, ceilings, trim and doors"), not a door job
  const w = m[1].toLowerCase().replace(/ of$/, '');
  return /^\d/.test(w) ? parseInt(w, 10) : NUM_WORDS[w] ?? 1;
}

/** "one side of the house", "two sides", "just the front": how much of the outside. */
function sidesOf(text: string): number | null {
  const m = /\b(?:just |only )?(one|1|two|2|three|3)\s+sides?\b/i.exec(text) ?? /\b(?:just |only )(?:the )?(?:front|back|left|right|north|south|east|west)(?: side)?(?: of the house)?\b/i.exec(text);
  if (!m) return null;
  if (!m[1]) return 1;
  const w = m[1].toLowerCase();
  return w === 'one' || w === '1' ? 1 : w === 'two' || w === '2' ? 2 : 3;
}

export interface JobParts {
  rooms: string[];
  stairRail: boolean;
  interiorDoors: number | null;
  entryDoor: boolean;
  garageDoor: boolean;
  soffit: boolean;
  fasciaOrTrim: boolean;
  fence: boolean;
  deck: boolean;
  sides: number | null;
  body: boolean;
  items: { key: string; count: number | null }[];
}

/** "not the siding or eaves", "no fence", "without the garage door": named only to be left out, so they are not parts of the job. */
export function withoutRuledOut(text: string): string {
  return text.replace(/\b(?:not|no|without|except(?:\s+for)?|excluding|skip(?:ping)?|don'?t (?:need|want|do)(?: the)?|leave out|other than)\s+(?:the\s+|any\s+|my\s+)?[\w'-]+(?:\s*(?:,|or|and|nor)\s*(?:the\s+)?[\w'-]+){0,3}/gi, ' ');
}

export function readJobParts(rawText: string): JobParts {
  const text = withoutRuledOut(rawText);
  // words that name an item or a door, not a room ("bedroom doors", "kitchen table", "dining chair")
  const forRooms = text
    .replace(/\bgarage\s+doors?\b/gi, ' ')
    .replace(/\b(?:bedroom|bathroom|closet|kitchen|pantry|living room|dining room)\s+(?:doors?|tables?|chairs?|stools?|sets?|cabinets?)\b/gi, ' ')
    .replace(/\b(?:dining|kitchen|patio|picnic|end|side|coffee|accent|console)\s+(?:tables?|chairs?)\b/gi, ' ')
    .replace(STAIR_RAIL, ' ');
  const items = INTENT.test(text) ? detectItems(text) : [];
  return {
    rooms: extractRooms(forRooms),
    stairRail: STAIR_RAIL.test(text),
    interiorDoors: interiorDoorCount(text),
    entryDoor: ENTRY.test(text),
    garageDoor: GARAGE_DOOR.test(text),
    soffit: SOFFIT.test(text),
    fasciaOrTrim: FASCIA_OR_TRIM.test(text),
    fence: FENCE.test(text),
    deck: DECK.test(text),
    sides: sidesOf(text),
    body: BODY.test(text),
    items,
  };
}

/** How many different kinds of work one statement names (rooms, stair railings, interior doors, the outside parts, a fence, a deck, furniture). */
export function kindsOf(p: JobParts): string[] {
  const k: string[] = [];
  if (p.rooms.length > 0) k.push('rooms');
  if (p.stairRail) k.push('stairs');
  if (p.interiorDoors != null) k.push('interior_doors');
  if (p.entryDoor) k.push('entry_door');
  if (p.garageDoor) k.push('garage_door');
  if (p.soffit || p.fasciaOrTrim) k.push('ext_trim');
  if (p.fence) k.push('fence');
  if (p.deck) k.push('deck');
  if (p.items.length > 0) k.push('items');
  return k;
}

/**
 * The scope for a statement that names two or more kinds of work. `opening` = the first message of the conversation: only then are the things NOT
 * named switched off (no whole-house walls, no siding); later messages only add.
 */
export function reconcileJobParts(text: string, prev: EstimatorContext, opening: boolean): Patch | null {
  const parts = readJobParts(text);
  const kinds = kindsOf(parts);
  if (kinds.length < 2) return null;

  const interior = parts.rooms.length > 0 || parts.stairRail || parts.interiorDoors != null;
  const exterior = parts.entryDoor || parts.garageDoor || parts.soffit || parts.fasciaOrTrim || parts.fence || parts.deck;
  const patch: Patch = {};

  patch.projectType = interior && exterior ? 'both' : interior ? 'interior' : exterior ? 'exterior' : prev.projectType;
  patch.itemsOnly = false;

  // ---- inside ----
  if (interior) {
    if (parts.rooms.length > 0) {
      patch.selectedRooms = [...new Set([...(prev.selectedRooms ?? []), ...parts.rooms])];
      if (prev.interiorScope !== 'whole_house') patch.interiorScope = 'specific_rooms';
      if (opening) patch.interiorWalls = 'yes';
    } else if (opening) {
      // nothing but railings, doors and pieces on the inside: no walls, ceilings or trim were asked for
      patch.interiorWalls = 'no';
      patch.interiorCeilings = 'no';
      patch.interiorTrim = 'no';
      patch.surfacesAddressed = true;
      patch.interiorScope = '';
      patch.selectedRooms = [];
    }
    if (parts.stairRail) {
      patch.stairways = 'yes';
      patch.stairwayDetails = 'railings_only';
    }
    if (parts.interiorDoors != null) {
      patch.interiorDoors = 'some';
      patch.doorsIncluded = true;
      if (!prev.doorCount && parts.interiorDoors) patch.doorCount = parts.interiorDoors;
    } else if (opening && parts.rooms.length === 0) {
      patch.interiorDoors = 'none';
    }
  }

  // ---- outside ----
  if (exterior && !parts.body) {
    if (opening) {
      patch.exteriorPartsOnly = true;
      patch.exteriorBody = 'no';
      patch.exteriorTrim = parts.fasciaOrTrim ? 'yes' : 'no';
      patch.soffitsEaves = parts.soffit ? 'yes' : 'no';
    } else {
      if (parts.fasciaOrTrim) patch.exteriorTrim = 'yes';
      if (parts.soffit) patch.soffitsEaves = 'yes';
    }
    if (parts.entryDoor) patch.entryDoor = 'yes';
    if (parts.garageDoor) patch.garageDoor = /\b(?:double|two[\s-]car|2[\s-]car|two)\b/i.test(text) ? 'double' : 'single';
    if (parts.fence) patch.fence = 'yes';
    if (parts.deck) patch.deck = 'yes';
    if (parts.sides && (parts.soffit || parts.fasciaOrTrim)) patch.exteriorSides = parts.sides;
  }

  // ---- pieces of furniture ----
  if (parts.items.length > 0 && (prev.furnitureItems ?? []).length === 0) {
    const list: string[] = [];
    for (const f of parts.items) for (let i = 0; i < Math.min(f.count ?? 1, 500); i++) list.push(f.key);
    patch.furnitureItems = list;
    patch.furnitureUnspecified = false;
    patch.furnitureCountKnown = parts.items.every((f) => f.count != null);
    if (!prev.specialtyServices.includes('furniture')) patch.specialtyServices = [...prev.specialtyServices, 'furniture'];
  }
  return patch;
}
