// ============================================================================
// Item interviews: what a painter would ask about each kind of thing being painted
// ============================================================================
// "A staircase railing" could be one flight or five floors, painted wood, stained wood or wrought iron, and need a fresh coat or a full
// strip. Each item the estimator knows has a spec here: when it is part of the job, the questions that change its price, what each answer
// means, and how much it moves the price. Topics, answer-reading, brush-off handling, hints and pricing are all generated from the specs,
// so an item that is in the job (said first, or mentioned halfway through a house) always gets its own questions, and the number that comes
// out reflects the answers instead of a one-size default.
//
// Answers live in ctx.itemAnswers as "<item>.<question>": "<option value>".
// ============================================================================

import type { EstimatorContext } from '../types';
import type { Topic } from './topics';
import { ITEM_SPECS } from './itemSpecs';

export interface ItemOption {
  value: string;
  /** Short name used in the painter's notes and the price line ("wrought iron"). */
  label: string;
  /** How the customer might answer this question with this option (matched against the lowercase reply). Checked in order: first match wins. */
  match: RegExp;
  /** Said unprompted anywhere in a message while this item is in the job ("wrought iron" for a railing's material). Optional. */
  said?: RegExp;
  /** Multiplier on the item's price line (1 = the usual case). */
  mult?: number;
  /** Context fields this answer also settles (a wrought iron railing sets the railing material the price table reads). */
  ctxPatch?: Partial<EstimatorContext>;
  /** A separate flat add-on line (dollars before the regional adjustment), for work that is not just "more of the same". */
  add?: { description: string; amount: number; category?: string };
}

export interface ItemQuestion {
  key: string;
  /** For "I didn't catch that - it didn't look like an answer about ___". */
  label: string;
  /** The short hint under the answer box. */
  hint: string;
  ask: string[];
  clarify: string;
  example: string;
  options: ItemOption[];
  /** Extra condition on top of the item being in the job (an earlier answer decides whether this one is worth asking). */
  when?: (ctx: EstimatorContext, answers: Record<string, string>) => boolean;
  /** The option used when the customer brushes the question off ("whatever", "doesn't matter"): the higher-priced realistic one, never the extreme. */
  dismissive?: string;
  /** Skipped when the customer already said the paint is up to the painter (these questions are about the work, so rarely). */
  skipWhenPainterChoice?: boolean;
}

export interface ItemSpec {
  key: string;
  /** What to call it ("staircase railing"). */
  thing: string;
  present: (ctx: EstimatorContext) => boolean;
  /** The price lines (keys from estimateEngine) the answers' multipliers apply to. */
  lineKeys: string[];
  /** Where its questions sit among the other topics (they all come before the paint brand, which is asked last of the job questions). */
  priority: number;
  questions: ItemQuestion[];
}

const SPECS: ItemSpec[] = ITEM_SPECS;

export const itemTopicId = (spec: ItemSpec, q: ItemQuestion) => `item_${spec.key}_${q.key}`;

/** The customer's answers for one item as { question key: option value }. */
export function answersFor(ctx: EstimatorContext, specKey: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ctx.itemAnswers ?? {})) if (k.startsWith(specKey + '.')) out[k.slice(specKey.length + 1)] = v;
  return out;
}

const seedOf = (c: EstimatorContext) =>
  `${c.zipCode}|${c.projectType}|${c.squareFeet}|${Object.keys(c.itemAnswers ?? {}).length}|${c.responseLengths.join(',')}`;
function pick<T>(variants: T[], seedStr: string): T {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
  return variants[h % variants.length];
}

/** The topics for every item question, in the shape topics.ts uses. */
export function itemTopics(): Topic[] {
  const topics: Topic[] = [];
  for (const spec of SPECS) {
    spec.questions.forEach((q, i) => {
      const id = itemTopicId(spec, q);
      topics.push({
        id,
        priority: spec.priority + i * 0.001,
        relevant: (c) => spec.present(c) && (!q.when || q.when(c, answersFor(c, spec.key))),
        alreadyAnswered: (c) => (c.itemAnswers ?? {})[`${spec.key}.${q.key}`] != null || (c.extAnswered ?? []).includes(id),
        ask: (c) => pick(q.ask, seedOf(c)),
        clarify: () => q.clarify,
        example: () => q.example,
      });
    });
  }
  return topics;
}

function locate(topicId: string | null | undefined): { spec: ItemSpec; q: ItemQuestion } | null {
  if (!topicId || !topicId.startsWith('item_')) return null;
  for (const spec of SPECS) for (const q of spec.questions) if (itemTopicId(spec, q) === topicId) return { spec, q };
  return null;
}

export const itemTopicLabel = (topicId: string | null | undefined): string | null => locate(topicId)?.q.label ?? null;
export const itemTopicHint = (topicId: string | null | undefined): string | null => locate(topicId)?.q.hint ?? null;

export interface ItemReading {
  patch: Partial<EstimatorContext>;
  acks: string[];
}

/**
 * Answers to item questions: the reply to the question just asked, and anything about an item in the job that the customer volunteers in
 * passing ("wrought iron railings", "the fence is stained").
 */
export function readItemAnswers(text: string, ctx: EstimatorContext, askedId: string | null): ItemReading {
  const low = text.toLowerCase();
  const answers = { ...(ctx.itemAnswers ?? {}) };
  const acks: string[] = [];
  let changed = false;
  let extra: Partial<EstimatorContext> = {};
  const set = (spec: ItemSpec, q: ItemQuestion, o: ItemOption) => {
    const k = `${spec.key}.${q.key}`;
    if (answers[k] != null) return;
    answers[k] = o.value;
    acks.push(o.label);
    if (o.ctxPatch) extra = { ...extra, ...o.ctxPatch };
    changed = true;
  };
  const question = text.trim().endsWith('?');
  if (question) return { patch: {}, acks };

  const asked = locate(askedId);
  if (asked && answers[`${asked.spec.key}.${asked.q.key}`] == null) {
    const o = asked.q.options.find((opt) => opt.match.test(low));
    if (o) set(asked.spec, asked.q, o);
  }
  for (const spec of SPECS) {
    if (!spec.present(ctx)) continue;
    for (const q of spec.questions) {
      if (answers[`${spec.key}.${q.key}`] != null) continue;
      const o = q.options.find((opt) => opt.said && opt.said.test(low));
      if (o) set(spec, q, o);
    }
  }
  return changed ? { patch: { ...extra, itemAnswers: answers }, acks } : { patch: {}, acks };
}

/** What to assume for a brushed-off item question: the realistic higher-priced answer. null = not an item question. */
export function itemDismissal(topicId: string, ctx: EstimatorContext): { patch: Partial<EstimatorContext>; label: string } | null {
  const hit = locate(topicId);
  if (!hit) return null;
  const o = (hit.q.dismissive && hit.q.options.find((opt) => opt.value === hit.q.dismissive)) || hit.q.options.reduce((best, opt) => ((opt.mult ?? 1) > (best.mult ?? 1) ? opt : best), hit.q.options[0]);
  return { patch: { ...(o.ctxPatch ?? {}), itemAnswers: { ...(ctx.itemAnswers ?? {}), [`${hit.spec.key}.${hit.q.key}`]: o.value } }, label: o.label };
}

/** The answers as notes for the painter: "Staircase railing: material: wrought iron, finish: stained". */
export function itemSummaryLines(ctx: EstimatorContext): { question: string; answer: string }[] {
  const out: { question: string; answer: string }[] = [];
  for (const spec of SPECS) {
    if (!spec.present(ctx)) continue;
    const parts: string[] = [];
    for (const q of spec.questions) {
      const v = (ctx.itemAnswers ?? {})[`${spec.key}.${q.key}`];
      const o = v != null ? q.options.find((opt) => opt.value === v) : undefined;
      if (o) parts.push(o.label);
    }
    if (parts.length > 0) out.push({ question: spec.thing.charAt(0).toUpperCase() + spec.thing.slice(1), answer: parts.join(', ') });
  }
  return out;
}

export interface PricedLine { category: string; description: string; amount: number; key?: string }

/**
 * Applies what the customer said about each item to its price line: the multipliers scale the line (a wrought iron railing, a fence that has to be
 * stripped first) and a few answers add a line of their own. `regionalMult` is the same regional adjustment every other line gets.
 */
export function applyItemAnswers(lines: PricedLine[], ctx: EstimatorContext, regionalMult: number): PricedLine[] {
  const extra: PricedLine[] = [];
  for (const spec of SPECS) {
    if (!spec.present(ctx)) continue;
    const answers = answersFor(ctx, spec.key);
    let mult = 1;
    const notes: string[] = [];
    for (const q of spec.questions) {
      const v = answers[q.key];
      const o = v != null ? q.options.find((opt) => opt.value === v) : undefined;
      if (!o) continue;
      if (o.mult && o.mult !== 1) { mult *= o.mult; notes.push(o.label); }
      if (o.add) extra.push({ category: o.add.category ?? 'Prep Work', description: o.add.description, amount: o.add.amount * regionalMult, key: `${spec.key}_${q.key}` });
    }
    if (mult === 1) continue;
    for (const line of lines) {
      if (!line.key || !spec.lineKeys.includes(line.key)) continue;
      line.amount *= mult;
      line.description += ` — ${notes.join(', ')}`;
    }
  }
  return [...lines, ...extra];
}
