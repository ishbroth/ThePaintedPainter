// ============================================================================
// Derivation Engine
// ============================================================================
// After explicit extraction, infer IMPLICIT facts from context + the cumulative
// transcript. The goal is to not ask the user about things that are already
// obvious from what they've said.
//
// Examples:
//   "I need a room painted"       → projectType=interior, scope=specific_rooms
//   "my master bedroom"           → + selectedRooms=[master_bedroom]
//   "just walls"                  → ceilings=no, trim=no, doors=none
//   "it's in good shape"          → projectCondition=repaint, prep minimal
//   "new drywall just went up"    → projectCondition=renovation, drywall yes
//
// Each derivation also returns a reason string that can be logged and
// optionally surfaced to the user ("Got it — assuming interior since you said
// 'a room'").
// ============================================================================

import type { EstimatorContext } from '../types';

export interface Derivation {
  /** Fields to merge into the context. */
  patch: Partial<EstimatorContext>;
  /** Human-readable reason, for debugging / "show your work". */
  reason: string;
}

export function derive(ctx: EstimatorContext, transcript: string): Derivation[] {
  const t = transcript.toLowerCase();
  const out: Derivation[] = [];

  // ——————————————————————————————————————————
  // Project type from room mentions
  // ——————————————————————————————————————————
  const mentionsIndoorRoom =
    /\b(room|rooms|bedroom|bathroom|kitchen|living room|dining|hallway|closet|pantry|nursery|office|den|foyer|mudroom|laundry room|apartment|apt\.?|condo(?:minium)?|duplex|rental unit|the unit|my unit|staircase|stairway|door frames?|door jambs?|cabinet interiors?|wainscoting|crown molding|baseboards?)\b/.test(
      t,
    );
  const mentionsExteriorSurface =
    /\b(siding|stucco|hardie|shiplap|clapboard|concrete block|cinder block|aluminum siding|fascia|soffit|eaves|gutter|exterior|outside|outdoor|deck|fence|picket fence|shed|garage door|driveway|patio|overhang|porch|balcony|balconies|foundation walls|window frames|window trim|entry door)\b/.test(t);

  if (!ctx.projectType) {
    if (mentionsIndoorRoom && !mentionsExteriorSurface) {
      out.push({
        patch: { projectType: 'interior' },
        reason: 'Mentioned a room → interior project',
      });
    } else if (mentionsExteriorSurface && !mentionsIndoorRoom) {
      out.push({
        patch: { projectType: 'exterior' },
        reason: 'Mentioned exterior surface → exterior project',
      });
    } else if (mentionsIndoorRoom && mentionsExteriorSurface) {
      out.push({
        patch: { projectType: 'both' },
        reason: 'Mentioned both interior and exterior elements',
      });
    } else if (/\b(rental unit|the unit|my unit|apartment|apt\.?|condo(?:minium)?|duplex|studio)\b/.test(t)) {
      out.push({
        patch: { projectType: 'interior' },
        reason: 'Rental unit/apartment phrasing → interior project',
      });
    }
  }

  // ——————————————————————————————————————————
  // Scope from single-room phrasing
  // ——————————————————————————————————————————
  if (!ctx.interiorScope || ctx.interiorScope === '') {
    if (/\b(?:a|one|just one|single)\s+(?:small\s+|medium\s+|large\s+)?(?:bed)?room\b/.test(t)) {
      out.push({
        patch: { interiorScope: 'specific_rooms' },
        reason: '"A room" → specific rooms scope',
      });
    } else if (/\b(whole house|whole home|the entire|the whole|all of it|everything|every room)\b/.test(t)) {
      out.push({
        patch: { interiorScope: 'whole_house' },
        reason: 'Whole-house phrasing',
      });
    } else if (/\b(rental unit|the unit|my unit|apartment|apt\.?|condo(?:minium)?|duplex|studio)\b/.test(t)) {
      out.push({
        patch: { interiorScope: 'whole_house' },
        reason: 'Rental unit/apartment phrasing → whole unit, not a single room',
      });
    } else if (/\b(couple|few|several)\s+(rooms?|bedrooms?)\b/.test(t) || ctx.selectedRooms.length >= 1) {
      out.push({
        patch: { interiorScope: 'specific_rooms' },
        reason: 'Multiple specific rooms mentioned',
      });
    }
  }

  // ——————————————————————————————————————————
  // Default project condition when it's clearly a repaint
  // ——————————————————————————————————————————
  if (!ctx.projectCondition) {
    if (/\b(previously painted|already painted|been painted|repaint|refresh|change the color|paint over)\b/.test(t)) {
      out.push({
        patch: { projectCondition: 'repaint' },
        reason: 'Repaint language detected',
      });
    } else if (/\b(new construction|just built|newly built|new build)\b/.test(t)) {
      out.push({
        patch: { projectCondition: 'new_construction' },
        reason: 'New construction language',
      });
    } else if (/\b(renovation|remodel|just finished|new drywall|drywall just went up)\b/.test(t)) {
      out.push({
        patch: { projectCondition: 'renovation' },
        reason: 'Renovation language',
      });
    }
  }

  // ——————————————————————————————————————————
  // "Good shape" / "in good condition" — minimize prep
  // ——————————————————————————————————————————
  if (
    /\b(?:it('?s| is)\s+(?:in\s+)?good|in good shape|looks good|no (?:damage|issues|problems)|clean|pristine|move[-\s]?in ready)\b/.test(
      t,
    )
  ) {
    if (!ctx.projectCondition) {
      out.push({
        patch: { projectCondition: 'repaint' },
        reason: 'Described as good shape → assume repaint',
      });
    }
    if (ctx.drywallRepairExtent === 'minor' || !ctx.drywallRepairExtent) {
      // Leave as-is. Don't upgrade.
    }
  }

  // ——————————————————————————————————————————
  // Single-bedroom default size assumption
  // ——————————————————————————————————————————
  if (
    ctx.interiorScope === 'specific_rooms' &&
    ctx.selectedRooms.length === 0 &&
    /\b(a|one|single)\s+(?:small\s+)?bedroom\b/.test(t)
  ) {
    out.push({
      patch: { selectedRooms: ['bedroom_3'] }, // default to small bedroom spec
      reason: 'Default "a bedroom" → small bedroom layout',
    });
  }

  // ——————————————————————————————————————————
  // "Small/medium/large" room with no dimensions → pick a STANDARD_ROOM spec
  // ——————————————————————————————————————————
  if (
    ctx.interiorScope === 'specific_rooms' &&
    ctx.selectedRooms.length === 1 &&
    ctx.selectedRooms[0] === 'bedroom_3'
  ) {
    if (/\bsmall\b/.test(t)) {
      // already small — no change
    } else if (/\bmedium|average\b/.test(t)) {
      out.push({
        patch: { selectedRooms: ['bedroom_2'] },
        reason: 'Medium-sized bedroom → use 12x12 spec',
      });
    } else if (/\blarge|big|master\b/.test(t)) {
      out.push({
        patch: { selectedRooms: ['master_bedroom'] },
        reason: 'Large/master bedroom → use master spec',
      });
    }
  }

  // ——————————————————————————————————————————
  // If user said "just walls" already, don't ask about trim/ceilings/doors
  // (The explicit extractor already sets these; this is a safety backstop.)
  // ——————————————————————————————————————————
  if (/\bjust\s+(?:the\s+)?walls?\b|\bonly\s+(?:the\s+)?walls?\b|\bwalls?\s+only\b/.test(t)) {
    if (ctx.interiorCeilings !== 'no') {
      out.push({ patch: { interiorCeilings: 'no' }, reason: '"Just walls" → no ceilings' });
    }
    if (ctx.interiorTrim !== 'no') {
      out.push({ patch: { interiorTrim: 'no' }, reason: '"Just walls" → no trim' });
    }
    if (ctx.interiorDoors !== 'none') {
      out.push({ patch: { interiorDoors: 'none' }, reason: '"Just walls" → no doors' });
    }
  }

  // ——————————————————————————————————————————
  // Occupancy defaults when phrasing strongly implies
  // ——————————————————————————————————————————
  if (
    !ctx.occupancy &&
    /\b(before we move in|not moved in yet|buying it|just bought|pre-?move)\b/.test(t)
  ) {
    out.push({
      patch: { occupancy: 'vacant' },
      reason: 'Pre-move-in phrasing → vacant',
    });
  }

  return out;
}

/** Apply a list of derivations in order, returning the updated context. */
export function applyDerivations(
  ctx: EstimatorContext,
  derivations: Derivation[],
): EstimatorContext {
  let next = { ...ctx };
  for (const d of derivations) next = { ...next, ...d.patch };
  return next;
}
