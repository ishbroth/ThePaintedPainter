// ============================================================================
// Default Scope Assumptions
// ============================================================================
// Every paint job has "assumed" work that an experienced contractor folds in
// without asking. This module bakes that in based on what the user has told
// us so far.
//
// Heuristics Isaac described:
//   - Straightforward repaint of a previously-painted house:
//       → light caulking on previously-caulked trim
//       → minor nail-hole fill on walls
//       → standard 2-coat
//   - Renovation / new construction / post-contractor:
//       → extensive caulking (all trim is new, needs full caulk)
//       → extensive nail-hole fill (new drywall/trim has lots of fasteners)
//       → prime new drywall (handled by pricingConfig + engine already)
//   - If user mentions other trades working on the project and doesn't say
//     what's been done, assume the painter needs to do the finish work.
// ============================================================================

import type { EstimatorContext } from '../types';
import { isIsolatedDetailJob, TRIM_FEET_PER_ROOM } from './details';

export interface Assumption {
  label: string;
  reason: string;
  /** Optional prepWork keys to add to ctx.prepWork. */
  prepWork?: string[];
  /** Optional context field patches. */
  patch?: Partial<EstimatorContext>;
}

/**
 * Given the current context, return the assumptions a seasoned contractor
 * would automatically bundle in. The chat engine applies these right before
 * calling the estimator so the user doesn't have to spell them out.
 */
export function defaultAssumptions(ctx: EstimatorContext): Assumption[] {
  const out: Assumption[] = [];
  const isReno = ctx.projectCondition === 'renovation' || ctx.projectCondition === 'new_construction';

  if (isReno) {
    out.push({
      label: 'Extensive caulking',
      reason: 'New trim on renovation/new construction requires full caulking of all seams.',
      prepWork: ['caulking'],
      patch: { caulkingExtent: 'extensive' },
    });
    out.push({
      label: 'Extensive nail-hole fill',
      reason: 'Freshly installed trim and drywall have numerous fasteners to fill.',
      patch: {
        drywallRepairExtent:
          ctx.drywallRepairExtent === 'major' ? 'major' : 'moderate',
      },
    });
    if (ctx.projectCondition === 'new_construction') {
      out.push({
        label: 'Prime all new drywall',
        reason: 'New drywall requires a primer coat before finish paint.',
      });
    }
    out.push({
      label: 'Spot-prime bare wood / raw trim',
      reason: 'Any bare wood exposed by trim carpenters needs primer before paint.',
    });
  } else if ((ctx.projectType === 'interior' || ctx.projectType === 'both') && (ctx.projectCondition === 'repaint' || ctx.interiorWalls !== 'no')) {
    // Interior wall-repaint prep only — a pure exterior job (a front door, a garage door) never belonged here just because
    // interiorWalls sits at its untouched default; it has nothing to do with an interior wall.
    // Default "straightforward repaint" scope
    out.push({
      label: 'Light caulking on previously caulked trim',
      reason: 'Standard refresh of any caulk lines that have cracked or pulled away.',
      prepWork: ['caulking'],
      patch: { caulkingExtent: ctx.caulkingExtent || 'minor' },
    });
    out.push({
      label: 'Minor nail-hole fill',
      reason: 'Routine spackle of small nail holes from picture hanging, minor dings.',
      patch: {
        drywallRepairExtent: ctx.drywallRepairExtent || 'minor',
      },
    });
    out.push({
      label: 'Two-coat finish (standard)',
      reason: 'Two coats on walls for full, even coverage — industry standard.',
    });
  }

  // Exterior-specific baked-in scope
  if (ctx.projectType === 'exterior' || ctx.projectType === 'both') {
    if (ctx.exteriorBody !== 'no') out.push({
      label: 'Power wash prior to paint',
      reason: 'All exterior surfaces pressure-washed to remove chalk, dust, cobwebs before painting.',
      prepWork: ['power_washing'],
    });
    if (ctx.exteriorBody !== 'no') out.push({
      label: 'Spot-prime bare wood / failing paint',
      reason: 'Any areas of bare wood or peeling paint get spot primer before finish coats.',
    });
    if (ctx.exteriorBody !== 'no' && (ctx.sidingType === 'stucco' || !ctx.sidingType)) {
      out.push({
        label: 'Hairline crack fill on stucco',
        reason: 'Typical hairline stucco cracks get caulk-filled before paint.',
      });
    }
  }

  // Trim and doors: the prep that goes with how they are finished now
  if (ctx.interiorTrim === 'yes' || (ctx.interiorDoors && ctx.interiorDoors !== 'none')) {
    const finishes = [ctx.interiorTrim === 'yes' ? ctx.trimFinish : '', ctx.interiorDoors !== 'none' ? ctx.doorFinish : ''];
    if (finishes.includes('bare_wood')) out.push({ label: 'Bare trim/door wood: sand + primer', reason: 'Bare wood is sanded smooth and sealed with a full primer coat before the finish coats.' });
    if (finishes.includes('stained')) out.push({ label: 'Stained trim/doors: degloss + stain-blocking primer', reason: 'Stained or varnished wood is deglossed and sealed with a stain-blocking primer so the old finish does not bleed through the paint.' });
    if (finishes.includes('primed')) out.push({ label: 'Pre-primed trim/doors: light scuff-sand', reason: 'Factory-primed wood only needs a light scuff-sand and cleaning before the finish coats.' });
  }

  // Cabinet-specific
  if (ctx.cabinets && ctx.cabinets !== 'none') {
    const byFinish: Record<string, { label: string; reason: string }> = {
      painted: { label: 'Cabinet clean, scuff-sand + bond primer', reason: 'Already-painted cabinets get a degreasing clean, a scuff-sand and a bonding primer so the new paint holds.' },
      bare_wood: { label: 'Bare cabinet wood: sand + primer', reason: 'Bare wood is sanded smooth and sealed with a full coat of primer (and grain filler if it is open-grain, like oak) before the finish coats.' },
      stained: { label: 'Stained cabinets: degloss + stain-blocking primer', reason: 'Stained or varnished wood is deglossed and sealed with a stain-blocking primer so the old finish and wood tannins do not bleed through the paint.' },
      primed: { label: 'Pre-primed cabinets: light scuff-sand', reason: 'Factory-primed cabinets only need a light scuff-sand and cleaning before the finish coats.' },
      laminate: { label: 'Laminate cabinets: adhesion primer', reason: 'Laminate, melamine and thermofoil need a special adhesion primer and slower, careful work; the result is less durable than on wood, and some painters decline it.' },
    };
    out.push(byFinish[ctx.cabinetFinish] ?? {
      label: 'Cabinet degloss + bond primer',
      reason: 'Existing cabinets must be deglossed and primed with a bonding primer for paint adhesion.',
    });
  }

  // Pre-1978 construction — federal law (EPA RRP) requires lead-safe work
  // practices on any pre-1978 home getting interior surfaces disturbed.
  if (ctx.yearBuilt && ctx.yearBuilt < 1978 && (ctx.projectType === 'interior' || ctx.projectType === 'both')
    && !ctx.prepWork.includes('lead_test')) {
    out.push({
      label: 'EPA lead-safe work practices (pre-1978 home)',
      reason: 'Federally required lead-safe containment and cleanup for any home built before 1978.',
      prepWork: ['lead_test'],
      patch: {
        specialtyReferrals: [
          ...ctx.specialtyReferrals,
          {
            type: 'lead_paint',
            reason: 'Home built before 1978 — EPA RRP lead-safe practices are legally required.',
            severity: 'warning',
          },
        ],
      },
    });
  }

  // Sizes and counts the customer did not give: what was assumed, so it can be corrected in the price breakdown.
  const interior = ctx.projectType === 'interior' || ctx.projectType === 'both';
  const detailOnly = isIsolatedDetailJob(ctx);
  const byRooms = detailOnly && ctx.detailRoomCount ? ' from ' + ctx.detailRoomCount + ' room' + (ctx.detailRoomCount === 1 ? '' : 's') + ' (about ' + TRIM_FEET_PER_ROOM + ' ft each)' : ' from the size of the home';
  const guess = (label: string, reason: string) => out.push({ label, reason: reason + ' Change it in the price breakdown if you know the real number.' });
  if (interior && ctx.interiorDoors !== 'none' && ctx.doorsIncluded && ctx.doorCount == null) guess('Number of doors estimated', 'You did not give a door count, so the doors are counted' + byRooms + '.');
  if (interior && ctx.interiorWindows !== 'none' && ctx.windowCount == null) guess('Number of windows estimated', 'You did not give a window count, so the windows are counted' + byRooms + '.');
  if (interior && ctx.closets !== 'none' && ctx.closetCount == null) guess('Number of closets estimated', 'You did not give a closet count, so the closets are counted' + byRooms + '.');
  if (ctx.furnitureItems.includes('chair') && ctx.chairCount == null) guess('Number of chairs assumed', 'You did not say how many chairs, so ' + ctx.furnitureItems.filter((i) => i === 'chair').length + ' are priced.');
  if (interior && ctx.crownMolding === 'yes' && ctx.crownLinearFeet == null) guess('Crown moulding length estimated', 'You did not give the length of crown moulding, so it is estimated' + byRooms + '.');
  if (interior && ctx.chairRail === 'yes' && ctx.chairRailLinearFeet == null) guess('Chair rail length estimated', 'You did not give the length of chair rail, so it is estimated' + byRooms + '.');
  if (interior && ctx.wainscoting === 'yes' && ctx.wainscotSqft == null) guess('Wainscoting area estimated', 'You did not give the area of wainscoting, so it is estimated at about 3 ft high along the walls' + byRooms + '.');
  if (detailOnly && ctx.interiorTrim === 'yes' && ctx.trimLinearFeet == null) guess('Baseboard length estimated', 'You did not give the length of baseboard, so it is estimated' + byRooms + '.');
  if (ctx.fence === 'yes') {
    if (ctx.fenceLinearFeet == null) guess('Fence length assumed (100 ft)', 'You did not give the length of the fence.');
    if (ctx.fenceHeightFt == null && ctx.fenceType !== 'chain_link') guess('Fence height assumed (' + (ctx.fenceType === 'picket_4ft' ? '4' : '6') + ' ft)', 'You did not give the height of the fence, so the usual height for that kind of fence is priced.');
  }
  if (ctx.deck === 'yes' && ctx.deckSqft == null) guess('Deck size assumed', 'You did not give the size of the deck, so a ' + (ctx.deckSize || 'medium') + ' deck is priced.');
  if (ctx.overhangs === 'yes' && ctx.overhangSqft == null) guess('Overhang size estimated', 'You did not give the size of the overhang or patio cover, so it is estimated from the footprint of the house.');
  if (ctx.railings === 'yes' && ctx.stairRailFeet == null) guess('Railing length estimated', 'You did not give the length of the railing, so it is estimated from the size of the house.');
  if (ctx.exteriorShutters === 'yes' && ctx.exteriorShutterCount == null) guess('Number of shutters assumed (8)', 'You did not say how many shutters.');
  if (detailOnly) {
    out.push({
      label: 'Small job: minimum service charge applies',
      reason: 'With only trim details in the job, a painter still has to come, set up and mask, so the price will not go below the minimum service charge.',
    });
  }

  return out;
}

/**
 * Merge assumption patches into the context in order. Does not mutate.
 */
export function applyAssumptions(
  ctx: EstimatorContext,
  assumptions: Assumption[],
): EstimatorContext {
  let next = { ...ctx };
  const prepSet = new Set(next.prepWork);
  for (const a of assumptions) {
    if (a.prepWork) for (const k of a.prepWork) prepSet.add(k);
    if (a.patch) next = { ...next, ...a.patch };
  }
  next.prepWork = Array.from(prepSet);
  return next;
}
