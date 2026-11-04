// ============================================================================
// The estimator reviews its own conversation (after the quote, never in the way of it)
// ============================================================================
// Once a quote is complete, this sends the transcript (with phone numbers and email addresses removed) and the friction events seen along
// the way to the `estimator-self-review` edge function. That function runs a small AI pass that writes down what went wrong and a fix, saves
// it to the estimator_lessons table, and the most recent and most frequent lessons are fed back into the estimator's prompt
// (chat-estimator-extract). A conversation with no friction is skipped there, except for a small random sample.
//
// Fire and forget: it never throws, never waits, and the quote is already on its way to the customer when it runs.
// ============================================================================

import { supabase } from '../supabase';
import { collectFriction, type FrictionEvent } from './selfCheck';

let enabled = true;

/** Tests only: turn the report off (no network in the conversation checks). */
export function setSelfReviewEnabled(on: boolean): void {
  enabled = on;
}

const MAX_MESSAGES = 60;
const MAX_CHARS = 400;

/** Phone numbers and email addresses are not needed to see what went wrong in a conversation. */
export function scrub(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[phone]')
    .slice(0, MAX_CHARS);
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** What would be sent for a finished conversation (exported so the checks can look at it). */
export function buildReport(history: { role: 'bot' | 'user'; text: string }[], logged: FrictionEvent[] = []) {
  const friction = collectFriction(history, logged);
  return {
    conversationId: newId(),
    transcript: history.slice(-MAX_MESSAGES).map((m) => ({ role: m.role, text: scrub(m.text) })),
    signals: friction.map((e) => ({ kind: e.kind, turn: e.turn })),
  };
}

/** Sends the finished conversation for review. Never throws and is never awaited by the quote. */
export function reportConversation(history: { role: 'bot' | 'user'; text: string }[], logged: FrictionEvent[] = []): void {
  if (!enabled) return;
  try {
    const body = buildReport(history, logged);
    if (body.transcript.filter((m) => m.role === 'user').length < 2) return;
    void supabase.functions.invoke('estimator-self-review', { body }).then(() => undefined, () => undefined);
  } catch {
    // the review is a nice-to-have: nothing here may ever get in the way of the quote
  }
}
