// ============================================================================
// Response summary
// ============================================================================
// Builds a plain-English, non-PII list of the customer's AI-interview answers
// for inclusion in the job-offer email sent to painters. Contact fields
// (name/phone/email/notes) and internal tracking fields are deliberately
// excluded — painters see only what's needed to size up the job before
// accepting; the customer's identity stays masked until they confirm.
// ============================================================================

import type { EstimatorContext } from '../types';
import { makeInitialContext } from './defaultContext';

/** Fields never shown to a painter pre-acceptance — PII or internal bookkeeping. */
const EXCLUDED_KEYS = new Set<keyof EstimatorContext>([
  'contactName',
  'contactPhone',
  'contactEmail',
  'contactNotes',
  'zipCode', // shown separately, at the top of the email
  'preferredPainterId',
  'preferredPainterName',
  'zipFromHistory',
  'timeline', // shown separately, at the top of the email
  'startDate', // timing is described separately (see describeTiming on the server)
  'endDate',
  'datesFlexible',
  'answeredQuestions',
  'responseStyle',
  'responseLengths',
  'specialtyReferrals',
  'isHighCostArea',
  'stateComplianceNotes',
  'extAnswered',
  'excludedSurfaces',
  'addedSurfaces',
  'zipCity',
  // interview bookkeeping, not answers
  'surfacesAddressed',
  'conditionAddressed',
  'renoStageAddressed',
  'trimScopeAddressed',
  'colorClarificationNeeded',
]);

/** Human-readable labels for fields whose camelCase key wouldn't read well auto-titled. */
const LABEL_OVERRIDES: Partial<Record<keyof EstimatorContext, string>> = {
  yearBuilt: 'Year built',
  propertyType: 'Property type',
  projectType: 'Project type',
  interiorScope: 'Interior scope',
  selectedRooms: 'Rooms',
  squareFeet: 'Square feet',
  hoa: 'HOA',
  afterHoursRequired: 'After-hours/weekend scheduling needed',
  lowVocRequested: 'Low-VOC paint requested',
  paintBrand: 'Paint brand',
  paintGrade: 'Paint grade',
  paintFinish: 'Paint finish',
  excludedRooms: 'Rooms the customer took off the price',
  excludedItems: 'Items the customer took off the price',
  trimLinearFeet: 'Trim (linear feet)',
  crownLinearFeet: 'Crown molding (linear feet)',
  accentWallCount: 'Accent walls',
  stairRailFeet: 'Stair railing (feet)',
  popcornCeilingSqft: 'Popcorn ceiling area (sq ft)',
  cabinetDoorCount: 'Cabinet doors and drawer fronts',
  deckSqft: 'Deck area (sq ft)',
  pressureWashSqft: 'Pressure-wash area (sq ft)',
  exteriorBody: 'House body painted (siding/stucco/brick)',
  soffitsEaves: 'Soffits and eaves',
  exteriorTrim: 'Exterior trim and fascia',
  ceilingHeight: 'Ceiling height',
  additionalDetails: 'Notes from the customer',
  bedroomCount: 'Bedrooms',
  projectCondition: 'Project type (repaint, renovation, new)',
};

/** Plain words for values whose stored form reads badly. */
const VALUE_LABELS: Record<string, Record<string, string>> = {
  ceilingHeight: { nine_foot: '9 ft', ten_plus: '10 ft or more', vaulted_mixed: 'tall or vaulted (12 ft or more)' },
};

function titleCase(camel: string): string {
  const spaced = camel.replace(/([A-Z])/g, ' $1').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    return trimmed.replace(/_/g, ' ');
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value.map((v) => String(v).replace(/_/g, ' ')).join(', ');
  }
  return null;
}

export interface ResponseQA {
  question: string;
  answer: string;
}

/** Human-readable label for the customer's requested timeline, shown separately. */
export const TIMELINE_LABELS: Record<string, string> = {
  asap: 'ASAP',
  this_month: 'Within the month',
  no_rush: 'No rush',
};

export function timelineLabel(timeline: string): string {
  return TIMELINE_LABELS[timeline] ?? 'Not specified';
}

/** A detail only means something while the thing it describes is in the job ("fence type" with no fence is just the form's resting answer). */
const DEPENDS_ON: Record<string, string> = {
  fenceType: 'fence', fenceLinearFeet: 'fence', deckSize: 'deck', deckSqft: 'deck', railingType: 'railings', exteriorRailingMaterial: 'railings',
  balconyCount: 'balconies', exteriorShutterCount: 'exteriorShutters', exteriorWindowCount: 'exteriorWindows', overhangSqft: 'overhangs',
  doorCount: 'interiorDoors', doorTypes: 'interiorDoors', doorFrames: 'interiorDoors', doorMaterial: 'interiorDoors',
  windowCount: 'interiorWindows', windowTypes: 'interiorWindows', cabinetLocations: 'cabinets', cabinetScope: 'cabinets', cabinetDoorCount: 'cabinets',
  closetCount: 'closets', closetShelving: 'closets', stairwayCount: 'stairways', stairwayDetails: 'stairways', stairRailFeet: 'stairways',
  interiorRailingMaterial: 'stairways', accentWallCount: 'accentWalls', brickTreatment: 'brickSqft', epoxyType: 'epoxyGarageSqft',
  colorChangeScope: 'interiorColorChange', colorChangeExcludedRoomCount: 'interiorColorChange', colorCount: 'interiorColorChange',
};
/** Work the estimator adds on its own for every repaint; the customer did not ask for it, so it is not listed as theirs. */
const AUTOMATIC_PREP = new Set(['caulking', 'power_washing']);

const isNegative = (v: unknown): boolean => {
  if (v === false || v === null || v === undefined) return true;
  if (typeof v === 'string') return ['', 'no', 'none', 'n/a'].includes(v.trim().toLowerCase());
  if (Array.isArray(v)) return v.length === 0;
  return false;
};

/**
 * What the customer's answers put in the job, as {question, answer} pairs for the painter: only what they actually said (a field still at the
 * interview's resting answer was never answered), and only things that are in the job (an inside job that also mentions a fence lists the fence). "No" and "none"
 * answers are left out, so the list reads as what the job includes.
 */
export function buildResponseSummary(ctx: EstimatorContext): ResponseQA[] {
  const out: ResponseQA[] = [];
  const resting = makeInitialContext() as unknown as Record<string, unknown>;
  const outside = ctx.projectType === 'exterior';
  const current = ctx as unknown as Record<string, unknown>;

  for (const [key, rawValue] of Object.entries(ctx) as [keyof EstimatorContext, unknown][]) {
    if (EXCLUDED_KEYS.has(key) || key === 'photos' || key === 'photoRequests') continue;
    if (key in DEPENDS_ON && isNegative(current[DEPENDS_ON[key]])) continue;
    if (isNegative(rawValue)) continue;
    // still the interview's resting answer: the customer never said anything different
    if (JSON.stringify(rawValue) === JSON.stringify(resting[key])) continue;

    let value = rawValue;
    if (key === 'prepWork' && Array.isArray(value)) {
      value = value.filter((w) => !AUTOMATIC_PREP.has(String(w)));
      if (isNegative(value)) continue;
    }
    if (key === 'additionalDetails' && typeof value === 'string') {
      // drop the interview's own room-size notes (square feet are listed already) and the "customer note:" tag
      value = value.split(';').map((part) => part.trim()).filter((part) => part && !/^room [\dx.]+ ?(?:sq ?ft)?$/i.test(part)).map((part) => part.replace(/^customer note:\s*/i, '')).join('; ');
      if (isNegative(value)) continue;
    }
    const answer = (typeof value === 'string' && VALUE_LABELS[key]?.[value]) || formatValue(value);
    if (answer === null) continue;
    out.push({ question: LABEL_OVERRIDES[key] ?? titleCase(key), answer });
  }

  // The surfaces for an inside job: the resting answers are "yes" (walls, ceilings, trim), so they are only listed once the customer
  // actually went through what is being painted.
  if (!outside && ctx.surfacesAddressed) {
    const surfaces: string[] = [];
    if (ctx.interiorWalls === 'yes') surfaces.push('walls');
    if (ctx.interiorCeilings === 'yes') surfaces.push('ceilings');
    if (ctx.interiorTrim === 'yes') surfaces.push('trim and baseboards');
    if (ctx.interiorDoors !== 'none') surfaces.push(ctx.interiorDoors === 'all' ? 'all doors' : 'some doors');
    if (surfaces.length > 0) out.unshift({ question: 'Inside surfaces being painted', answer: surfaces.join(', ') });
  }
  return out;
}
