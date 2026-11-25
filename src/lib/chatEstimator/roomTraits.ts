// ============================================================================
// What is different about one room: "vaulted ceilings in one bedroom, standard in the other"
// ============================================================================
// A job with several rooms is rarely uniform. Ceilings that are vaulted in one room only cost a ladder in that room, and the price should scale with it;
// "the room with the vaulted ceilings" then names that room for the color and coat answers that follow (see treatments.ts).
// ============================================================================

import type { EstimatorContext } from '../types';
import { STANDARD_ROOMS } from '../surfaceAreaEngine';
import { extractRooms } from './extractors';

type Patch = Partial<EstimatorContext>;

/** "vaulted", "vauted" (a typo), "cathedral", "tall", "high": a ceiling taller than usual. */
export const TALL_CEILING = /\b(?:vaul?ted|cathedral|tall|high|raised|9[\s-]?(?:ft|foot|feet)|10[\s-]?(?:ft|foot|feet)|12[\s-]?(?:ft|foot|feet))\s+ceilings?\b/i;
const STANDARD_CEILING = /\b(?:normal|standard|regular|flat|low|8[\s-]?(?:ft|foot|feet))\s+ceilings?\b/i;

const WORD_COUNT: Record<string, number> = { one: 1, '1': 1, two: 2, '2': 2, three: 3, '3': 3 };

function wallArea(key: string): number {
  return STANDARD_ROOMS[key]?.wallSqFt ?? 0;
}

/**
 * The rooms with taller ceilings, from what the customer says ("vaulted ceilings in one bedroom, standard in the other", "just in one room though",
 * "the master has cathedral ceilings"). Sets the share of the wall area that is tall, so the extra height is priced for those rooms only.
 */
export function readRoomTraits(text: string, ctx: EstimatorContext): Patch | null {
  const rooms = ctx.selectedRooms ?? [];
  if (rooms.length === 0) return null;
  const t = text.toLowerCase();
  const traits: Record<string, { vaulted?: boolean }> = { ...(ctx.roomTraits ?? {}) };
  const already = Object.keys(traits).filter((r) => traits[r].vaulted);

  const mentionsTall = TALL_CEILING.test(t);
  // the clause that names the tall ceilings (the rest of the message may be about colors in "the other room")
  const tallClause = t.split(/[.;?!]|,\s*/).find((c) => TALL_CEILING.test(c)) ?? '';
  const sayingIt = tallClause || t;
  // "in one bedroom", "in the master", "just in one room", "only one of them"
  const oneRoom = /\b(?:in|for|on)\s+(?:just\s+|only\s+)?(?:one|1)\s+(?:of the\s+)?(?:bed)?rooms?\b|\b(?:just|only)\s+(?:in\s+)?(?:one|1)\s+(?:of them\b|room\b|bedroom\b)|\bone\s+(?:bed)?room\s+(?:has|have|with)\b/.test(sayingIt) || (mentionsTall && /\bin the other\b/.test(t) && /\b(?:one|1)\s+(?:bed)?room\b/.test(sayingIt));
  const everyRoom = /\b(?:all|every|both)\b[^.;?]{0,15}\b(?:rooms?|bedrooms?)\b|\bthroughout\b/.test(t);
  const countWord = /\b(?:in|for)\s+(?:just\s+)?(one|two|1|2|three|3)\s+(?:of the\s+)?(?:bed)?rooms?\b/.exec(t);
  const named = extractRooms(t.replace(/\bgarage\s+doors?\b/g, ' ')).filter((r) => rooms.includes(r));

  const setVaulted = (keys: string[]) => {
    for (const k of keys) traits[k] = { ...traits[k], vaulted: true };
  };

  // the first time it is said sets which room; a later mention ("the room with the vaulted ceilings") only refers to it
  if (mentionsTall && !everyRoom && already.length === 0) {
    if (named.length > 0 && !oneRoom) setVaulted(named);
    else if (oneRoom || (countWord && WORD_COUNT[countWord[1]] === 1)) setVaulted([rooms.find((r) => !traits[r]?.vaulted) ?? rooms[0]]);
    else if (countWord) setVaulted(rooms.filter((r) => !traits[r]?.vaulted).slice(0, WORD_COUNT[countWord[1]] ?? 1));
  } else if (!mentionsTall && already.length === 0 && ctx.ceilingHeight && ctx.ceilingHeight !== 'standard' && oneRoom) {
    // the correction that follows a blanket "vaulted ceilings": "just in one room though"
    setVaulted([rooms[0]]);
  } else if (mentionsTall && everyRoom) {
    return null;
  }
  const vaulted = Object.keys(traits).filter((r) => traits[r].vaulted);
  if (vaulted.length === 0 || vaulted.length === already.length) return null;

  const total = rooms.reduce((s, r) => s + wallArea(r), 0);
  const tall = vaulted.reduce((s, r) => s + wallArea(r), 0);
  const share = total > 0 ? Math.min(1, tall / total) : vaulted.length / rooms.length;
  return { roomTraits: traits, tallCeilingShare: share, ceilingHeight: 'vaulted_mixed', ceilingHeightKnown: true };
}

/** The rooms a description points at: "the room with the vaulted ceilings", "the other bedroom", "the room with normal ceilings". */
export function roomsByDescriptor(clause: string, rooms: string[], traits: Record<string, { vaulted?: boolean }> | undefined): string[] {
  const t = clause.toLowerCase();
  const vaulted = rooms.filter((r) => traits?.[r]?.vaulted);
  const rest = rooms.filter((r) => !traits?.[r]?.vaulted);
  if (vaulted.length === 0) return [];
  if (/\b(?:room|bedroom|one)\s+with\s+(?:the\s+)?(?:vaul?ted|cathedral|tall|high)\b|\bthe (?:vaul?ted|tall|high) (?:one|room|bedroom)\b/.test(t)) return vaulted;
  if (STANDARD_CEILING.test(t) && /\b(?:room|bedroom|one)\s+with\b/.test(t)) return rest;
  if (/\bthe other (?:one|room|bedroom)\b|\bthe (?:normal|regular|standard) (?:one|room|bedroom)\b/.test(t)) return rest;
  return [];
}
