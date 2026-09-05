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
  } else if (ctx.projectCondition === 'repaint' || ctx.interiorWalls !== 'no') {
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
    out.push({
      label: 'Power wash prior to paint',
      reason: 'All exterior surfaces pressure-washed to remove chalk, dust, cobwebs before painting.',
      prepWork: ['power_washing'],
    });
    out.push({
      label: 'Spot-prime bare wood / failing paint',
      reason: 'Any areas of bare wood or peeling paint get spot primer before finish coats.',
    });
    if (ctx.sidingType === 'stucco' || !ctx.sidingType) {
      out.push({
        label: 'Hairline crack fill on stucco',
        reason: 'Typical hairline stucco cracks get caulk-filled before paint.',
      });
    }
  }

  // Cabinet-specific
  if (ctx.cabinets && ctx.cabinets !== 'none') {
    out.push({
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
