// ============================================================================
// When the customer is arguing with where the conversation is going
// ============================================================================
// "Why are we talking about kitchen cabinets?", "I only said two bedrooms", "you're not even listening", "how are we talking about exteriors now?":
// the questions have gone down the wrong path. A real estimator stops, says where things stand and asks whether that is right, instead of asking
// the next question on the list. This reads those messages, reads "only the bedrooms / no exterior" narrowing statements, and writes the
// "here is the job as I have it" recap.
// ============================================================================

import type { EstimatorContext } from '../types';
import { STANDARD_ROOMS } from '../surfaceAreaEngine';
import { extractRooms } from './extractors';
import { describeClosetKinds, itemsPhrase } from './items';

const PUSHBACK: RegExp[] = [
  /\b(?:why|how)\b[^.?!]{0,25}\b(?:are|did|do|does|is|were|was)\s+(?:we|you|it|this)\b[^.?!]{0,30}\b(?:talk\w*|ask\w*|stuck|get|got|go\w*|bring\w*|on)\b/i,
  /\bhow did we get (?:stuck )?(?:on|to|here)\b/i,
  /\bi (?:only|just) (?:said|asked for|wanted|mentioned|told you)\b/i,
  /\ball i (?:ever )?(?:wanted|asked|said|need(?:ed)?|want)\b/i,
  /\bwe(?:'re| are| r) (?:only|just) (?:doing|painting|talking)\b/i,
  /\b(?:not|never) talking about\b/i,
  /\byou(?:'re| are| r) not (?:even )?listening\b/i,
  /\b(?:stop|quit) (?:asking|going|doing)\b/i,
  /\b(?:that'?s|thats|this is|this'?s) what i mean\b/i,
  /\byou (?:have to|need to|should) (?:start )?(?:pick(?:ing)? up|back up|listen)\b/i,
];

/** The customer is pushing back on the line of questions ("why are we talking about...", "I only said...", "you're not listening"). */
export function isPushback(text: string): boolean {
  return PUSHBACK.some((re) => re.test(text));
}

type Patch = Partial<EstimatorContext>;
const ONLY = /\b(?:only|just|all i (?:ever )?(?:wanted|asked for|said|need(?:ed)?|want)(?: was| is)?|we(?:'re| are| r) only (?:doing|painting)|i only said)\b/i;
const NEG_OUT = /\b(?:no|not|without|skip|nothing|never|don'?t (?:need|want|do))\b(?: (?:talking|doing|painting|asking) about)?\s+(?:the\s+|any\s+)?(?:exteriors?|outside|outdoors?|siding)\b/i;
const NEG_BATH = /\b(?:no|not|without|skip|nothing)\b\s+(?:the\s+|any\s+)?bath(?:room)?s?\b/i;

/**
 * "All I ever wanted was the 2 bedrooms", "we are only doing the bedrooms", "just the two bedrooms and closets", "no exterior": the job is those rooms
 * (and nothing outside). Corrects a scope the conversation wrongly widened to the whole house or the outside.
 */
export function narrowingPatch(text: string, ctx: EstimatorContext): Patch | null {
  const patch: Patch = {};
  // only the clause with the "only" in it names the job ("i only said two bedrooms to begin with"): the rest of a complaint mentions rooms it does not want
  const onlyAt = ONLY.exec(text);
  const clause = onlyAt ? text.slice(onlyAt.index).split(/[.?!;,]/)[0] : '';
  const rooms = extractRooms(clause.replace(/\bgarage\s+doors?\b/gi, ' '));
  if (onlyAt && rooms.length > 0) {
    patch.selectedRooms = rooms;
    patch.interiorScope = 'specific_rooms';
    patch.includedExtraRooms = [];
    patch.projectType = ctx.projectType === 'exterior' ? ctx.projectType : 'interior';
    patch.bathroomCount = null;
    patch.stories = null;
  }
  if (NEG_OUT.test(text) && ctx.projectType !== 'exterior') {
    patch.projectType = 'interior';
    patch.exteriorBody = 'no';
  }
  if (NEG_BATH.test(text) && ctx.interiorScope === 'specific_rooms') patch.selectedRooms = (patch.selectedRooms ?? ctx.selectedRooms).filter((r) => !r.startsWith('bathroom'));
  return Object.keys(patch).length > 0 ? patch : null;
}

const roomName = (key: string) => (STANDARD_ROOMS[key]?.label ?? key.replace(/_/g, ' ')).toLowerCase();

/** The job as the estimator has it, in plain words: "2 bedrooms (about 600 sq ft) and 5 interior doors, walls only, and 1 standard closet". */
export function scopeRecap(c: EstimatorContext): string {
  const things: string[] = [];
  const bedrooms = c.selectedRooms.filter((r) => /bedroom/.test(r));
  const otherRooms = c.selectedRooms.filter((r) => !/bedroom/.test(r));
  if (c.interiorScope === 'whole_house') things.push('the whole inside');
  else {
    if (bedrooms.length > 0) things.push(bedrooms.length === 1 ? '1 bedroom' : `${bedrooms.length} bedrooms`);
    for (const r of otherRooms) things.push('the ' + roomName(r));
  }
  if (c.doorCount) things.push(c.doorCount === 1 ? '1 interior door' : `${c.doorCount} interior doors`);
  if (c.closets !== 'none') things.push(c.closetKinds ? describeClosetKinds(c.closetKinds) : 'the closets');
  if (c.cabinets !== 'none') things.push('the cabinets');
  if (c.stairways === 'yes' && c.stairwayDetails === 'railings_only') things.push('the stair railings');
  if (c.furnitureItems.length > 0) things.push(itemsPhrase(c.furnitureItems));
  const outside = c.projectType === 'exterior' || c.projectType === 'both';
  if (outside) {
    if (c.exteriorBody !== 'no') things.push('the outside of the house');
    if (c.entryDoor === 'yes') things.push('the front door');
    if (c.garageDoor !== 'none' && c.garageDoor !== '') things.push('the garage door');
    if (c.soffitsEaves === 'yes') things.push('the soffits');
    if (c.fence === 'yes') things.push('a fence');
    if (c.deck === 'yes') things.push('a deck');
  }
  const surfaces: string[] = [];
  if (c.surfacesAddressed && (c.projectType === 'interior' || c.projectType === 'both') && c.interiorScope) {
    if (c.interiorWalls !== 'no') surfaces.push('walls');
    if (c.interiorCeilings === 'yes') surfaces.push('ceilings');
    if (c.interiorTrim === 'yes') surfaces.push('baseboards and trim');
    const skipped = [c.interiorCeilings !== 'yes' ? 'ceilings' : '', c.interiorTrim !== 'yes' ? 'baseboards' : ''].filter(Boolean);
    if (surfaces.length > 0) surfaces.push(skipped.length > 0 ? `(no ${skipped.join(' or ')})` : '');
  }
  const size = c.selectedRoomsSqft ? `, about ${c.selectedRoomsSqft} sq ft in all` : '';
  const list = things.length === 0 ? 'nothing pinned down yet' : things.length === 1 ? things[0] : things.slice(0, -1).join(', ') + ' and ' + things[things.length - 1];
  const how = surfaces.filter(Boolean).join(' ');
  return `${list}${size}${how ? `; painting the ${how}` : ''}`;
}
