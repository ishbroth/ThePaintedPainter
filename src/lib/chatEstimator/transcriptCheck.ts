// ============================================================================
// Check what the customer already said before asking anything
// ============================================================================
// A customer drops facts into answers to other questions ("it's a rental", "the ceilings are 10 foot", "two story"). Each reply is read when it
// arrives, but some facts only become readable later (a reader that needs to know the job is outside, or that trim is in). So before the next
// question is asked, everything the customer has said is read again, WITHOUT assuming any question had just been asked (so a bare "no" or "yes"
// is never taken as an answer to something old), and only fields that are still empty are filled. If that answers the question about to be asked,
// the question is skipped. Nothing the customer corrected, and nothing already known, is ever overwritten.
// ============================================================================

import type { EstimatorContext } from '../types';
import { extractAll } from './extractors';
import { extractDetails } from './details';
import { readItemAnswers } from './itemInterviews';

const isUnset = (v: unknown): boolean => v == null || v === '' || (Array.isArray(v) && v.length === 0);

/** The fields the customer's earlier words fill in that are still empty. */
export function fillFromTranscript(ctx: EstimatorContext, customerText: string): Partial<EstimatorContext> {
  if (!customerText.trim()) return {};
  const merged: Partial<EstimatorContext> = {
    ...extractAll(customerText, ctx, null).patch,
    ...extractDetails(customerText, ctx, null).patch,
    ...readItemAnswers(customerText, ctx, null).patch,
  };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(merged)) {
    const current = (ctx as unknown as Record<string, unknown>)[key];
    if (key === 'itemAnswers') {
      const have = (current ?? {}) as Record<string, string>;
      const add = Object.fromEntries(Object.entries((value ?? {}) as Record<string, string>).filter(([k]) => have[k] == null));
      if (Object.keys(add).length > 0) out[key] = { ...have, ...add };
    } else if (isUnset(current) && !isUnset(value)) {
      out[key] = value;
    }
  }
  return out as Partial<EstimatorContext>;
}

/** True (with what was found) when something the customer already said answers this topic. */
export function answeredEarlier(
  topic: { alreadyAnswered: (c: EstimatorContext) => boolean },
  ctx: EstimatorContext,
  customerText: string,
): Partial<EstimatorContext> | null {
  const found = fillFromTranscript(ctx, customerText);
  if (Object.keys(found).length === 0) return null;
  return topic.alreadyAnswered({ ...ctx, ...found }) ? found : null;
}
