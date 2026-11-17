// ============================================================================
// Two versions of the same fact
// ============================================================================
// When a customer says something different about the same thing (24 units, later 4 units; four stories, later three), the estimator does not
// quietly overwrite the first answer, and does not lock in whichever it read first. Both are kept (ctx.conflicts), the first stays in use,
// and the customer is asked which one is right ("I thought you said 24 units, but now I see 4. Which one is it?"). It is asked again once if
// the reply does not settle it; after that the latest is used and both versions are put in the notes for the painter.
// A message that is plainly a correction ("I never said 4", "actually it's 6", "I meant...") just replaces the old answer.
// ============================================================================

import type { EstimatorContext } from '../types';

type Field = 'unitsTotal' | 'stories' | 'buildingCount';

/** The facts that are checked, what to call them, and the questions that answer them directly (so a reply to those is never a "conflict"). */
const FACTS: { field: Field; label: string; topics: string[] }[] = [
  { field: 'unitsTotal', label: 'units', topics: ['unit_count'] },
  { field: 'stories', label: 'stories', topics: ['stories', 'interior_stories'] },
  { field: 'buildingCount', label: 'buildings', topics: ['building_count'] },
];

/** "I never said 4", "not 4 units", "actually...", "I meant...", "correction", "that's wrong", "I changed my mind". */
const CORRECTING = /\b(?:never said|never mentioned|didn'?t say|did not say|didn'?t mention|not \d|actually|i meant|correction|that'?s wrong|that was wrong|changed my mind|mis(?:spoke|typed)|typo|my mistake)\b/i;

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.toLowerCase().matchAll(/\b(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g)) {
    out.push(/^\d/.test(m[1]) ? parseInt(m[1], 10) : WORD_NUMBERS[m[1]]);
  }
  return out;
}

/** After this message was read: any of the checked facts that now differs from what was said before is held as two versions, with the first kept. Changes `next` in place. */
export function holdConflicts(prev: EstimatorContext, next: EstimatorContext, text: string, lastTopicId: string | null | undefined): void {
  const correcting = CORRECTING.test(text);
  for (const f of FACTS) {
    const before = prev[f.field];
    const now = next[f.field];
    if (typeof before !== 'number' || typeof now !== 'number' || before === now) continue;
    const answeredDirectly = !!lastTopicId && f.topics.includes(lastTopicId);
    if (correcting || answeredDirectly) {
      next.conflicts = (next.conflicts ?? []).filter((c) => c.field !== f.field);
      continue;
    }
    next[f.field] = before; // the first answer stays in use until the customer says which is right
    const existing = (next.conflicts ?? []).find((c) => c.field === f.field);
    if (existing) {
      if (!existing.values.includes(now)) existing.values = [...existing.values, now];
    } else {
      next.conflicts = [...(next.conflicts ?? []), { field: f.field, label: f.label, values: [before, now], asked: 0 }];
    }
  }
}

/** The reply to "which one is it?": picks one of the two, or a number of their own. Returns the notes with the conflict settled (or one more try used up). */
export function settleConflicts(ctx: EstimatorContext, text: string): EstimatorContext {
  const open = ctx.conflicts ?? [];
  if (open.length === 0) return ctx;
  const c = open[0];
  const low = text.toLowerCase();
  const nums = numbersIn(low);
  let pick: number | null = nums.find((n) => c.values.includes(n)) ?? null;
  if (pick == null && /\b(?:first|original|earlier|before|the old)\b/.test(low)) pick = c.values[0];
  if (pick == null && /\b(?:second|latest|newer|new one|last one|the newer)\b/.test(low)) pick = c.values[c.values.length - 1];
  if (pick == null && nums.length > 0) pick = nums[0]; // a number of their own
  const rest = open.slice(1);
  if (pick != null) return { ...ctx, [c.field]: pick, conflicts: rest };
  // not settled: one more try, then the latest is used and both versions go to the painter
  if (c.asked + 1 >= 2) {
    const latest = c.values[c.values.length - 1];
    const note = `Customer gave both ${c.values.join(' and ')} ${c.label}; used ${latest}`;
    return { ...ctx, [c.field]: latest, conflicts: rest, additionalDetails: ctx.additionalDetails ? `${ctx.additionalDetails}; ${note}` : note };
  }
  return { ...ctx, conflicts: [{ ...c, asked: c.asked + 1 }, ...rest] };
}

/** The question: first time, and the second time it comes up. */
export function conflictQuestion(c: NonNullable<EstimatorContext['conflicts']>[number]): string {
  const [a, b] = [c.values[0], c.values[c.values.length - 1]];
  return c.asked === 0
    ? `I thought you said ${a} ${c.label}, but now I see ${b}. Which one is it?`
    : `I still need to know which is right: ${a} or ${b} ${c.label}?`;
}
