// ============================================================================
// Situation Library
// ============================================================================
// Narrative pricing rules Isaac feeds over time. Each situation is a story
// ("customer says X, reality is Y, so price Z% more/less") translated into a
// structured record. When a user describes their job in the estimator, each
// situation's triggers are matched against their input + context, and the
// matched adjustments STACK on top of the base pricing engine (never replace).
//
// Interplay:
//   - Reference library (referenceLibrary.ts) produces the base rate.
//   - pricingConfig.ts multipliers (condition, repair extent, etc.) apply.
//   - THEN matched situations multiply on top of that.
// ============================================================================

import type { EstimatorContext } from '../types';

// ===== Types =====

export interface SituationTrigger {
  /** Case-insensitive substring matches against the user's free-text input. */
  keywords?: string[];
  /** Regex patterns (as strings) matched against user input. */
  regex?: string[];
  /** Partial EstimatorContext — all listed fields must equal the user's ctx. */
  contextMatch?: Partial<EstimatorContext>;
}

export interface SituationAdjustment {
  /** Stacks multiplicatively with base price (e.g. 1.15 = +15%). */
  multiplier?: number;
  /** Flat dollar amount added/subtracted after multipliers. */
  addend?: number;
  /** Force confidence band up or down. */
  confidenceShift?: 'up' | 'down';
  /** If true, the matched situation should be surfaced to the user in the estimate explainer. */
  explainToUser?: boolean;
}

export interface Situation {
  id: string;
  title: string;
  /** Plain-English story — what Isaac actually told the estimator. */
  narrative: string;
  trigger: SituationTrigger;
  adjust: SituationAdjustment;
  /** Optional: canonical rate keys this situation relates to. Used for future UI linking. */
  relatedKeys?: string[];
  /** Date the situation was added (YYYY-MM-DD). */
  added: string;
}

export interface MatchedSituation {
  situation: Situation;
  matchedOn: Array<'keyword' | 'regex' | 'contextMatch'>;
}

// ===== Store =====
// Empty to start. Grows as Isaac feeds examples.

export const SITUATIONS: Situation[] = [
  // Example entry shape (commented out — not a live rule):
  // {
  //   id: 'heavy-cobwebs-2-story',
  //   title: 'Two-story exterior with heavy cobwebs/wasps',
  //   narrative:
  //     'On older two-story stucco houses in San Diego I often find heavy cobwebs and wasp nests under the eaves. ' +
  //     'That adds a full day of prep before any paint touches the wall.',
  //   trigger: {
  //     keywords: ['cobwebs', 'wasps', 'wasp nest', 'dirty eaves'],
  //     contextMatch: { projectType: 'exterior' },
  //   },
  //   adjust: { multiplier: 1.08, explainToUser: true },
  //   relatedKeys: ['exterior.siding.stucco'],
  //   added: '2026-04-22',
  // },
];

// ===== Matching =====

export function addSituation(s: Situation): void {
  SITUATIONS.push(s);
}

/**
 * Test every situation against the user's input + context.
 * Returns matched situations with the subset of trigger clauses that fired.
 */
export function matchSituations(
  userInput: string,
  ctx: Partial<EstimatorContext> = {},
): MatchedSituation[] {
  const haystack = userInput.toLowerCase();
  const matched: MatchedSituation[] = [];

  for (const s of SITUATIONS) {
    const hits: MatchedSituation['matchedOn'] = [];

    if (s.trigger.keywords?.some((k) => haystack.includes(k.toLowerCase()))) {
      hits.push('keyword');
    }

    if (s.trigger.regex?.some((r) => new RegExp(r, 'i').test(userInput))) {
      hits.push('regex');
    }

    if (s.trigger.contextMatch && matchesContext(s.trigger.contextMatch, ctx)) {
      hits.push('contextMatch');
    }

    // A situation fires if ANY of its trigger clauses matches.
    if (hits.length > 0) matched.push({ situation: s, matchedOn: hits });
  }

  return matched;
}

/** Stacked multiplier across all matched situations (1.0 = no adjustment). */
export function stackedMultiplier(matches: MatchedSituation[]): number {
  return matches.reduce(
    (acc, m) => acc * (m.situation.adjust.multiplier ?? 1),
    1,
  );
}

/** Total flat addend across all matched situations. */
export function stackedAddend(matches: MatchedSituation[]): number {
  return matches.reduce((acc, m) => acc + (m.situation.adjust.addend ?? 0), 0);
}

function matchesContext(
  needle: Partial<EstimatorContext>,
  haystack: Partial<EstimatorContext>,
): boolean {
  for (const k of Object.keys(needle) as Array<keyof EstimatorContext>) {
    if ((haystack as Record<string, unknown>)[k] !== (needle as Record<string, unknown>)[k]) {
      return false;
    }
  }
  return true;
}
