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

/** Fields never shown to a painter pre-acceptance — PII or internal bookkeeping. */
const EXCLUDED_KEYS = new Set<keyof EstimatorContext>([
  'contactName',
  'contactPhone',
  'contactEmail',
  'contactNotes',
  'zipCode', // shown separately, at the top of the email
  'timeline', // shown separately, at the top of the email
  'answeredQuestions',
  'responseStyle',
  'responseLengths',
  'specialtyReferrals',
  'isHighCostArea',
  'stateComplianceNotes',
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

/** Every answered, non-PII field from the AI interview, as {question, answer} pairs. */
export function buildResponseSummary(ctx: EstimatorContext): ResponseQA[] {
  const out: ResponseQA[] = [];

  for (const [key, rawValue] of Object.entries(ctx) as [keyof EstimatorContext, unknown][]) {
    if (EXCLUDED_KEYS.has(key)) continue;
    const answer = formatValue(rawValue);
    if (answer === null) continue;

    const label = LABEL_OVERRIDES[key] ?? titleCase(key);
    out.push({ question: label, answer });
  }

  return out;
}
