// ============================================================================
// Dismissive answers, and readings the customer didn't actually give
// ============================================================================
//
// 1. When a customer brushes a question off ("doesn't matter, just want it done", "whatever", "I don't care"), the estimator doesn't keep
//    asking and doesn't guess low. It takes the HIGHEST-priced answer to that question and moves on, and says so, so the number that comes
//    back is never short. (Someone who says "I'm not sure" is different: that gets a typical default, see statedUncertaintyDefault.)
//
// 2. The AI reader sometimes reads more into a message than the customer said ("I need a house with trim painted" came back as an
//    INTERIOR, WHOLE-HOUSE job, so the bot never asked inside or outside). sanitizeLlmPatch() throws out any inside/outside reading that
//    nothing in the message supports.

import { RESOLVED_BASE_RATES } from '../pricing/resolvedBaseRates';
import type { EstimatorContext } from '../types';
import { derive } from './derivation';
import { extractAll } from './extractors';

export interface Assumption {
  patch: Partial<EstimatorContext>;
  /** What the bot says: the assumption, in its own voice. */
  say: string;
  /** The answer can't be assumed (a ZIP code): explain why it is needed and ask again instead of moving on. */
  reask?: boolean;
  /** Re-ask every time it is brushed off, not just once (inside/outside has no safe default). */
  askUntilClear?: boolean;
}

/**
 * "Highest" means the highest REALISTIC answer, not the most extreme one: a dismissive customer should not get a quote for a stone castle.
 * The siding that costs the most to paint among the ones houses actually have, from the live price table.
 */
const COMMON_SIDING = ['stucco', 'wood', 'hardie', 'brick'];
function priciestSiding(): string {
  const rates = COMMON_SIDING.map((name) => [name, (RESOLVED_BASE_RATES.exterior as Record<string, number>)[`siding_${name}`] ?? 0] as const);
  rates.sort((a, b) => b[1] - a[1]);
  return rates[0][0];
}

/** A tall house for its size: two stories for an ordinary home, three only for a big one. */
const tallest = (ctx: EstimatorContext) => ((ctx.squareFeet ?? 0) >= 3000 ? 3 : 2);

const higher = (what: string) => `No problem, I'll go with ${what}, the higher-priced option, so the price won't come in short. A painter can adjust it once they see the place.`;

const withExt = (ctx: EstimatorContext, id: string): string[] => [...new Set([...(ctx.extAnswered ?? []), id])];

/**
 * The highest-priced answer to a topic's question, for a customer who brushed it off. null = nothing to assume for this topic (the engine
 * then just moves on). The paint questions are not here: "doesn't matter" about the paint already means the painter chooses.
 */
export function highestPriceAssumption(topicId: string, ctx: EstimatorContext): Assumption | null {
  switch (topicId) {
    case 'project_type':
      // never assumed: inside or outside changes the whole job, so it is asked again (any hint in later messages is picked up first)
      return { patch: {}, reask: true, say: "I do need to know which one, since inside and outside are priced very differently.", askUntilClear: true };
    case 'which_rooms':
      return { patch: { interiorScope: 'whole_house' }, say: higher('the whole inside') };
    case 'room_size':
      return { patch: { squareFeet: 300 }, say: higher('a large room') };
    case 'house_size':
    case 'ext_size':
      return { patch: { squareFeet: 2500 }, say: higher('a larger home, about 2,500 square feet') };
    case 'surfaces':
    case 'upsell_ceilings':
    case 'upsell_trim':
    case 'upsell_doors':
      return {
        patch: { interiorWalls: 'yes', interiorCeilings: 'yes', interiorTrim: 'yes', interiorDoors: 'all', surfacesAddressed: true, trimScopeAddressed: true },
        say: higher('everything: walls, ceilings, trim and doors'),
      };
    case 'trim_scope':
      return { patch: { doorFrames: 'yes', trimScopeAddressed: true }, say: higher('all of the trim, door frames included') };
    case 'condition':
      return { patch: { drywallRepairExtent: 'major', conditionAddressed: true }, say: higher('walls that need real prep and repair') };
    case 'color_change':
      return { patch: { interiorColorChange: 'dramatic' }, say: higher('a big color change') };
    case 'color_scope_clarify':
      return { patch: { colorClarificationNeeded: '' }, say: higher('painting every wall and room the new color') };
    case 'property_ownership':
      // owner-occupied is the highest of living there / renting it out / selling it (rentals and pre-sale get a lower finish level)
      return { patch: { propertyType: 'residential' }, say: higher('a standard owner-occupied home') };
    case 'commercial_access':
      return { patch: { afterHoursRequired: 'yes' }, say: higher('after-hours scheduling') };
    case 'siding': {
      const siding = priciestSiding();
      return { patch: { sidingType: siding }, say: higher(`${siding} siding`) };
    }
    case 'stories':
      {
      const stories = tallest(ctx);
      return { patch: { stories }, say: higher(`a ${stories}-story house`) };
    }
    case 'timeline_and_access':
      return { patch: { occupancy: ctx.occupancy || 'furnished', timeline: ctx.timeline || 'asap' }, say: higher('a furnished home and a quick start') };
    case 'ext_trim':
      return { patch: { exteriorTrim: 'yes', soffitsEaves: 'yes', extAnswered: withExt(ctx, 'ext_trim') }, say: higher('painting the trim, fascia and eaves') };
    case 'ext_doors':
      return { patch: { entryDoor: 'yes', extAnswered: withExt(ctx, 'ext_doors') }, say: higher('painting the doors') };
    case 'ext_garage':
    case 'ext_garage_count':
      return { patch: { garageDoor: 'double', extAnswered: [...new Set([...(ctx.extAnswered ?? []), 'ext_garage', 'ext_garage_count'])] }, say: higher('a two-car garage door') };
    case 'ext_gutters':
      return { patch: { gutters: 'yes', extAnswered: withExt(ctx, 'ext_gutters') }, say: higher('painting the gutters') };
    case 'ext_windows':
      return { patch: { exteriorWindows: 'full', extAnswered: withExt(ctx, 'ext_windows') }, say: higher('painting the full windows') };
    case 'ext_window_count':
      {
      const count = Math.max(10, Math.round((ctx.squareFeet ?? 1500) / 110)); // about one window per 110 sq ft
      return { patch: { exteriorWindowCount: count, extAnswered: withExt(ctx, 'ext_window_count') }, say: higher(`about ${count} windows`) };
    }
    case 'ext_condition':
      return { patch: { exteriorCondition: 'poor', extAnswered: withExt(ctx, 'ext_condition') }, say: higher('paint in rough shape') };
    case 'ext_repairs':
      return {
        patch: {
          prepWork: [...new Set([...ctx.prepWork, 'wood_rot', 'caulking'])] as EstimatorContext['prepWork'],
          caulkingExtent: 'extensive',
          extAnswered: withExt(ctx, 'ext_repairs'),
        },
        say: higher('repairs and caulking being needed'),
      };
    case 'ext_color':
      return { patch: { exteriorColorChange: 'different', extAnswered: withExt(ctx, 'ext_color') }, say: higher('a different color') };
    case 'paint_brand':
    case 'paint_grade':
    case 'paint_finish':
      // "doesn't matter" about paint means "the painter can choose" (standard grade): the paint answers already settle it
      return { patch: { extAnswered: withExt(ctx, topicId) }, say: "No problem, the painter will choose the paint." };
    case 'location':
      return {
        patch: {},
        reask: true,
        say: "I do need a ZIP code. It's how I find painters near you and price it for your area. Nothing else gets saved with it.",
      };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Readings the customer didn't give
// ---------------------------------------------------------------------------

/**
 * Takes the AI reader's reading of a message and removes the inside/outside reading when nothing in the message supports it. A bare
 * "house with trim" says neither: the bot has to ask. The scope fields the reader tacked on with it (whole house, walls yes) go too.
 * Anything the customer really said (the word inside or outside, a room, a siding or deck) is kept, and so is an answer to the
 * inside-or-outside question itself.
 */
export function sanitizeLlmPatch(
  text: string,
  ctx: EstimatorContext,
  lastTopicId: string | null,
  patch: Partial<EstimatorContext>,
): Partial<EstimatorContext> {
  if (!patch.projectType || ctx.projectType) return patch;
  if (lastTopicId === 'project_type') return patch;

  // what our own plain-rules reading supports: the words themselves, a room, an outside surface
  const local = extractAll(text, ctx, lastTopicId).patch;
  const merged = { ...ctx, ...local } as EstimatorContext;
  const derived = derive(merged, text).find((d) => d.patch.projectType !== undefined)?.patch.projectType;
  if (local.projectType || derived) return patch;

  const cleaned: Partial<EstimatorContext> = { ...patch };
  delete cleaned.projectType;
  for (const key of ['interiorScope', 'interiorWalls', 'interiorCeilings', 'interiorDoors', 'selectedRooms'] as const) {
    if (local[key] === undefined) delete cleaned[key];
  }
  return cleaned;
}
