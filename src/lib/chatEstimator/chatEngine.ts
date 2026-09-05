// ============================================================================
// Chat Estimator Engine (v2)
// ============================================================================
// Flow per user message:
//   1. Classify intent (is this a question back to me? uncertainty? info?)
//   2. Extract explicit facts
//   3. Derive implicit facts from the full transcript
//   4. Route:
//        - meta_* intent → answer from metaBank
//        - ask_clarification → re-ask last topic's clarify
//        - ask_example → last topic's example
//        - express_uncertainty → sympathetic + skip-forward
//        - frustration → reset prompt
//        - greeting → warm acknowledgement + ask what they need
//        - ready_to_finish → jump to finalize
//        - provide_info / scope_limiter / negation / confirmation → advance topic
//   5. If no topics left, finalize with the full estimate.
// ============================================================================

import type { EstimatorContext, EstimateBreakdown, UserResponseStyle } from '../types';
import { calculateEstimate } from '../estimateEngine';
import { extractAll } from './extractors';
import { defaultAssumptions, applyAssumptions, type Assumption } from './defaultAssumptions';
import {
  matchSituations,
  stackedMultiplier,
  stackedAddend,
  type MatchedSituation,
} from '../pricing/situations';
import { classifyIntent, hasIntent, type Intent, type IntentResult } from './intents';
import { derive, applyDerivations } from './derivation';
import { pickNextTopic, findTopic, metaBank, type Topic } from './topics';
import { extractWithLLM } from './llmClient';
import { makeInitialContext } from './defaultContext';

// ===== Message / state =====

// Rotates so an acknowledgment lead-in doesn't say the exact same
// "Got it —" verbatim every single turn of a long conversation.
const ACK_LEAD_INS = ['Got it —', 'Noted —', 'Makes sense —', 'Perfect —', 'Okay —'];

export type ChatRole = 'bot' | 'user';

export interface ChatMessage {
  role: ChatRole;
  text: string;
  timestamp: number;
  ackChips?: string[];
}

export interface ChatState {
  ctx: EstimatorContext;
  history: ChatMessage[];
  transcript: string;
  askedIds: string[];
  /** The last topic the bot asked about, for clarification replies. */
  lastBotTopic: Topic | null;
  /** Has the bot invited a final-wrap-up check? */
  wrapupAsked: boolean;
  finalEstimate: ChatResult | null;
}

export interface ChatResult {
  estimate: EstimateBreakdown;
  ctx: EstimatorContext;
  assumptions: Assumption[];
  matchedSituations: MatchedSituation[];
  summary: string;
}

// ===== Initial state =====

export { makeInitialContext };

export function makeInitialState(): ChatState {
  return {
    ctx: makeInitialContext(),
    history: [
      {
        role: 'bot',
        text:
          "Hey! What do you need painted? Tell me as much or as little as you want — " +
          "I'll ask follow-ups only when I need to.",
        timestamp: Date.now(),
      },
    ],
    transcript: '',
    askedIds: [],
    lastBotTopic: null,
    wrapupAsked: false,
    finalEstimate: null,
  };
}

// ===== Persistence (sessionStorage) =====
//
// Bump this whenever ChatState or EstimatorContext's shape changes in a way
// that could break loading an older saved conversation. Without a version
// check, a schema change (a field added/removed/repurposed) could silently
// load a subtly-incompatible object and misbehave in ways that are hard to
// trace back to "the browser had stale storage."
const CHAT_STATE_SCHEMA_VERSION = 2;

/**
 * `lastBotTopic` is a `Topic` object with live function properties (ask,
 * clarify, example, chips). JSON.stringify silently drops functions, so a
 * naive persist/restore round-trip leaves `lastBotTopic` a hollow object
 * that throws the moment anything calls `.ask()` on it — every message
 * after a restore would fail. Store just the topic id and re-resolve the
 * real Topic (with its functions intact) via findTopic() on load instead.
 */
export function serializeChatState(state: ChatState): string {
  return JSON.stringify({
    version: CHAT_STATE_SCHEMA_VERSION,
    state: { ...state, lastBotTopic: state.lastBotTopic?.id ?? null },
  });
}

/** Returns null (caller should fall back to makeInitialState()) if the saved data is missing, corrupt, or from an incompatible schema version. */
export function deserializeChatState(json: string): ChatState | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed?.version !== CHAT_STATE_SCHEMA_VERSION || !parsed.state) return null;
    const raw = parsed.state as ChatState & { lastBotTopic: string | null };
    return {
      ...raw,
      lastBotTopic: raw.lastBotTopic ? findTopic(raw.lastBotTopic) : null,
    };
  } catch {
    return null;
  }
}

// ===== Core turn handler =====

export interface TurnResult {
  state: ChatState;
  done: ChatResult | null;
}

function botMessage(text: string): ChatMessage {
  return { role: 'bot', text, timestamp: Date.now() };
}

function classifyResponseStyle(text: string): UserResponseStyle {
  const len = text.trim().length;
  if (len < 15) return 'terse';
  if (len > 120) return 'detailed';
  return 'normal';
}

/**
 * Understand the user's message: try the LLM-backed extractor first (better
 * language understanding, same output shape), and fall back to the local
 * regex rules engine if the LLM call fails, times out, or is unreachable.
 */
// A real conversation finalizes well within this many exchanges — going far
// beyond it looks like a runaway/abusive session, so stop spending on LLM
// calls for it and quietly drop to the free local engine instead.
const MAX_LLM_TURNS = 40;

async function understand(
  trimmed: string,
  state: ChatState,
): Promise<{ intent: IntentResult; patch: Partial<EstimatorContext>; acknowledgements: string[] }> {
  const llm = state.history.length > MAX_LLM_TURNS ? null : await extractWithLLM(
    trimmed,
    state.ctx,
    state.history.map((m) => ({ role: m.role, text: m.text })),
    state.lastBotTopic ? state.lastBotTopic.ask(state.ctx) : null,
  );
  if (llm) {
    return {
      intent: { intents: llm.intents, normalized: trimmed.toLowerCase(), isQuestion: trimmed.trim().endsWith('?') },
      patch: llm.patch,
      acknowledgements: llm.acknowledgements,
    };
  }
  const intent = classifyIntent(trimmed);
  const extracted = extractAll(trimmed, state.ctx);
  return { intent, patch: extracted.patch, acknowledgements: extracted.acknowledgements };
}

export async function handleUserMessage(state: ChatState, userText: string): Promise<TurnResult> {
  const trimmed = userText.trim();
  if (!trimmed) return { state, done: null };

  // 1. Understand the message (LLM first, local rules engine as fallback),
  //    then apply derivations against the full transcript
  const { intent, patch, acknowledgements } = await understand(trimmed, state);
  const ctxWithExplicit: EstimatorContext = { ...state.ctx, ...patch };

  // Safety backstop (covers both the LLM path and the local fallback):
  // once the user has established a whole-house/whole-unit scope, a later
  // message mentioning a specific room in passing must never silently
  // collapse the quote down to just that room. Only an explicit "just the
  // kitchen"-style scope limiter (handled elsewhere) should narrow it.
  if (state.ctx.interiorScope === 'whole_house' && ctxWithExplicit.interiorScope === 'specific_rooms') {
    ctxWithExplicit.interiorScope = 'whole_house';
    ctxWithExplicit.selectedRooms = state.ctx.selectedRooms;
  }
  const newTranscript = `${state.transcript}\n${trimmed}`.trim();
  const derivations = derive(ctxWithExplicit, newTranscript);
  const ctxNext = {
    ...applyDerivations(ctxWithExplicit, derivations),
    answeredQuestions: state.ctx.answeredQuestions + 1,
    responseStyle: classifyResponseStyle(trimmed),
    responseLengths: [...state.ctx.responseLengths, trimmed.length],
  };

  const userMsg: ChatMessage = {
    role: 'user',
    text: trimmed,
    timestamp: Date.now(),
    ackChips: acknowledgements.length > 0 ? acknowledgements : undefined,
  };

  let s: ChatState = {
    ...state,
    ctx: ctxNext,
    history: [...state.history, userMsg],
    transcript: newTranscript,
  };

  // 2. Handle meta questions / clarifications before advancing topics
  const metaReply = metaAnswer(intent.intents, s.lastBotTopic, s);
  if (metaReply) {
    s = { ...s, history: [...s.history, botMessage(metaReply)] };
    // After answering a meta question, re-ask the topic we were on (if any)
    // so the user can continue where they left off.
    if (s.lastBotTopic) {
      const refocus =
        "Anyway — " + s.lastBotTopic.ask(s.ctx).charAt(0).toLowerCase() +
        s.lastBotTopic.ask(s.ctx).slice(1);
      s = { ...s, history: [...s.history, botMessage(refocus)] };
    }
    return { state: s, done: null };
  }

  // 3. Frustration / greeting / restart
  if (hasIntent(intent, 'frustration')) {
    // Acknowledge, but do NOT dead-end here — nothing was actually reset,
    // so falling through to the normal topic-advance logic below keeps the
    // conversation moving instead of risking a repeated "sorry" loop if the
    // next message also reads as frustrated.
    s = { ...s, history: [...s.history, botMessage(metaBank.frustration())] };
  } else if (hasIntent(intent, 'greeting') && s.askedIds.length === 0 && Object.keys(patch).length === 0) {
    // Only treat this as a bare "hi" with nothing else in it. A message like
    // "hi, I need a 3 bedroom house painted" also gets tagged with the
    // greeting intent (it does start with "hi"), but it has real job details
    // that must not be thrown away in favor of a canned "what do you need
    // painted?" — that reads as the bot completely ignoring what was just said.
    s = { ...s, history: [...s.history, botMessage(metaBank.greeting())] };
    return { state: s, done: null };
  }
  if (hasIntent(intent, 'restart')) {
    return { state: makeInitialState(), done: null };
  }

  // 4. Ready-to-finish — jump to finalize if we have enough
  if (hasIntent(intent, 'ready_to_finish')) {
    if (readyToQuote(ctxNext)) {
      return finalizeTurn(s);
    }
    // Not ready — acknowledge, then fall through to actually ASK the missing
    // topic below instead of just describing it. Without this, a user who
    // keeps saying "run it"/"that's all" would see this same static line
    // forever instead of being walked to the answer.
    const missing = whatsMissing(ctxNext);
    s = {
      ...s,
      history: [
        ...s.history,
        botMessage(`Before I run the numbers I need one more thing: ${missing}`),
      ],
    };
  }

  // 5. Handle negation / confirmation in the context of the last topic
  if (hasIntent(intent, 'negation') && s.lastBotTopic) {
    const reply = metaBank.negation_after_topic(s.lastBotTopic.id);
    s = { ...s, history: [...s.history, botMessage(reply)] };
    // Fall through to topic advance
  }
  if (hasIntent(intent, 'express_uncertainty')) {
    const reply = metaBank.uncertainty(s.lastBotTopic?.id ?? null);
    s = { ...s, history: [...s.history, botMessage(reply)] };
    // Mark the topic as "answered by uncertainty" so we don't re-ask
    if (s.lastBotTopic && !s.askedIds.includes(s.lastBotTopic.id)) {
      s = { ...s, askedIds: [...s.askedIds, s.lastBotTopic.id] };
    }
    return advanceAfterUncertainty(s);
  }

  // 6. If we're ready to quote and we already asked the wrap-up, finalize
  if (s.wrapupAsked && readyToQuote(ctxNext)) {
    return finalizeTurn(s);
  }

  // 7. Pick the next topic; if none, invite wrap-up then finalize
  const next = pickNextTopic(ctxNext, s.askedIds);
  if (!next) {
    if (!s.wrapupAsked) {
      s = {
        ...s,
        wrapupAsked: true,
        askedIds: [...s.askedIds, 'wrapup'],
        history: [
          ...s.history,
          botMessage(
            "I think I've got enough to put a number together. Anything else I should know — unusual heights, tough access, special colors, timing? " +
              "Otherwise just say 'run it' and I'll price it out.",
          ),
        ],
      };
      return { state: s, done: null };
    }
    // We're here because wrapup was asked and there's nothing new — finalize.
    return finalizeTurn(s);
  }

  // 8. Ask the next topic — lead with a brief acknowledgment of what was
  //    just said so the reply doesn't read as a non-sequitur when the user
  //    volunteers detail beyond what the last question asked for.
  const chips = next.chips?.(ctxNext);
  const ackLeadIn = acknowledgements.length > 0
    ? `${ACK_LEAD_INS[s.askedIds.length % ACK_LEAD_INS.length]} ${acknowledgements.join(', ')}. `
    : '';
  const prompt = ackLeadIn + next.ask(ctxNext) + (chips ? `  (${chips.join(' · ')})` : '');
  s = {
    ...s,
    askedIds: [...s.askedIds, next.id],
    lastBotTopic: next,
    history: [...s.history, botMessage(prompt)],
  };
  return { state: s, done: null };
}

// ===== Sub-routines =====

function metaAnswer(
  intents: Intent[],
  lastTopic: Topic | null,
  state: ChatState,
): string | null {
  if (intents.includes('meta_cost')) return metaBank.cost();
  if (intents.includes('meta_how_it_works')) return metaBank.how_it_works();
  if (intents.includes('meta_bot_check')) return metaBank.bot_check();
  if (intents.includes('meta_real_person')) return metaBank.real_person();
  if (intents.includes('meta_time')) return metaBank.time();
  if (intents.includes('meta_privacy')) return metaBank.privacy();
  if (intents.includes('painter_question')) return metaBank.painter_question();
  if (intents.includes('booking_question')) return metaBank.booking_question();
  if (intents.includes('color_question')) return metaBank.color_question();
  if (intents.includes('recommend_question')) return metaBank.recommend_question();
  if (intents.includes('off_topic')) return metaBank.off_topic();

  if (intents.includes('ask_clarification')) {
    if (lastTopic) return lastTopic.clarify(state.ctx);
    return "What would you like me to clarify? Say more and I'll help.";
  }
  if (intents.includes('ask_example')) {
    if (lastTopic) return lastTopic.example(state.ctx);
    return "Tell me what part you'd like an example of and I'll walk through it.";
  }

  if (intents.includes('deflection')) {
    if (/email/.test(state.history[state.history.length - 1]?.text ?? '')) {
      return metaBank.deflection_email();
    }
    return metaBank.deflection_ballpark();
  }

  return null;
}

function advanceAfterUncertainty(state: ChatState): TurnResult {
  const next = pickNextTopic(state.ctx, state.askedIds);
  if (!next) {
    // If nothing left, go to wrap-up/finalize path
    if (readyToQuote(state.ctx)) {
      return finalizeTurn(state);
    }
    return { state, done: null };
  }
  const chips = next.chips?.(state.ctx);
  const prompt = next.ask(state.ctx) + (chips ? `  (${chips.join(' · ')})` : '');
  return {
    state: {
      ...state,
      askedIds: [...state.askedIds, next.id],
      lastBotTopic: next,
      history: [...state.history, botMessage(prompt)],
    },
    done: null,
  };
}

function readyToQuote(ctx: EstimatorContext): boolean {
  // Must have a project type
  if (!ctx.projectType) return false;
  // Must have location (we allow finalization without ZIP but flag it low-confidence)
  // For interior-only need rooms or sqft
  if (ctx.projectType === 'interior' || ctx.projectType === 'both') {
    const haveScope =
      ctx.squareFeet ||
      ctx.selectedRooms.length > 0 ||
      ctx.bedroomCount ||
      ctx.interiorScope === 'whole_house';
    if (!haveScope) return false;
  }
  if (ctx.projectType === 'exterior' || ctx.projectType === 'both') {
    if (!ctx.sidingType) return false;
  }
  return true;
}

function whatsMissing(ctx: EstimatorContext): string {
  if (!ctx.projectType) return "are we painting the inside, outside, or both?";
  if ((ctx.projectType === 'interior' || ctx.projectType === 'both') &&
    !ctx.squareFeet && ctx.selectedRooms.length === 0 && !ctx.bedroomCount &&
    ctx.interiorScope !== 'whole_house') {
    return "which rooms or roughly how big?";
  }
  if ((ctx.projectType === 'exterior' || ctx.projectType === 'both') && !ctx.sidingType) {
    return "what's the exterior siding made of?";
  }
  return "just the ZIP code.";
}

function finalizeTurn(state: ChatState): TurnResult {
  const result = finalize(state.ctx, state.transcript);
  const s = {
    ...state,
    history: [...state.history, botMessage(result.summary)],
    finalEstimate: result,
  };
  return { state: s, done: result };
}

// Plain-English reasons behind the pricing multipliers that most benefit
// from being said out loud, keyed by the exact label estimateEngine.ts uses.
const MULTIPLIER_EXPLANATIONS: Record<string, string> = {
  'Rental Property (standard finish)':
    "Since this is a rental, I knocked a bit off — rentals usually don't need the same showroom-perfect finish an owner-occupied home does.",
  'Multi-Unit Volume Discount':
    "Since it's multiple units, I applied a volume discount — bulk work like this typically runs cheaper per unit.",
  'Commercial Property':
    "Commercial space runs a bit higher — different insurance and scheduling needs than a residential job.",
  'Rush Scheduling':
    "I added a rush-scheduling premium since you need this done fast — that usually means pulling a crew off another job.",
  'Pre-1978 Lead-Safe Practices':
    "Since the home predates 1978, I've included EPA-required lead-safe prep — that's the law, not optional, and it adds a bit to the cost.",
  'Difficult Access':
    "I added a surcharge for the tough access — that means real extra time getting materials and equipment in and out.",
};

/** Spoken notes for line items that aren't multipliers — flat add-on fees the user should hear about explicitly, not just find in the itemized breakdown. */
function lineItemNotes(ctx: EstimatorContext): string[] {
  const notes: string[] = [];
  if (ctx.multiTripRequired === 'yes') {
    notes.push("I've built in a return-trip fee since this needs a second visit — that's normal for sequenced or cure-time work.");
  }
  if (ctx.specialEquipment === 'scaffolding') {
    notes.push("I've included scaffolding rental in the price.");
  } else if (ctx.specialEquipment === 'lift') {
    notes.push("I've included a boom lift rental in the price — that's a real equipment cost, not just extra labor.");
  }
  if (ctx.fixtureRemoval === 'extensive') {
    notes.push("I've added time for removing and reinstalling fixtures/hardware around the work area.");
  }
  if (ctx.hardwareReplacement === 'yes') {
    notes.push("I've included labor for the hardware install — just note the hardware itself is a separate cost.");
  }
  return notes;
}

function finalize(ctx: EstimatorContext, transcript: string): ChatResult {
  const assumptions = defaultAssumptions(ctx);
  const withAssumptions = applyAssumptions(ctx, assumptions);

  const matched = matchSituations(transcript, withAssumptions);
  const situationMultiplier = stackedMultiplier(matched);
  const situationAddend = stackedAddend(matched);

  const estimate = calculateEstimate(withAssumptions);

  const adjustedTotal = Math.round(estimate.total * situationMultiplier + situationAddend);
  const adjustedLow = Math.round(estimate.lowRange * situationMultiplier + situationAddend);
  const adjustedHigh = Math.round(estimate.highRange * situationMultiplier + situationAddend);

  const finalEstimate: EstimateBreakdown = {
    ...estimate,
    total: adjustedTotal,
    lowRange: adjustedLow,
    highRange: adjustedHigh,
    multipliers: [
      ...estimate.multipliers,
      ...matched.map((m) => ({
        label: `Situation: ${m.situation.title}`,
        factor: m.situation.adjust.multiplier ?? 1,
      })),
    ],
  };

  const pieces: string[] = [];
  pieces.push(
    `Based on what you told me, I'm at **$${adjustedLow.toLocaleString()} – $${adjustedHigh.toLocaleString()}** with **$${adjustedTotal.toLocaleString()}** as the guaranteed price.`,
  );
  if (assumptions.length > 0) {
    pieces.push(
      `Included automatically: ${assumptions.map((a) => a.label.toLowerCase()).slice(0, 4).join(', ')}.`,
    );
  }
  const priceNotes = [
    ...finalEstimate.multipliers.map((m) => MULTIPLIER_EXPLANATIONS[m.label]).filter((n): n is string => !!n),
    ...lineItemNotes(withAssumptions),
    ...matched
      .filter((m) => m.situation.adjust.explainToUser)
      .map((m) => m.situation.userNote ?? m.situation.narrative),
  ];
  if (priceNotes.length > 0) {
    pieces.push(priceNotes.join(' '));
  }
  pieces.push(
    `Pulling up painters in your area now — plus a mystery-painter option if you want to lock in that guaranteed number.`,
  );

  return {
    estimate: finalEstimate,
    ctx: withAssumptions,
    assumptions,
    matchedSituations: matched,
    summary: pieces.join('\n\n'),
  };
}
