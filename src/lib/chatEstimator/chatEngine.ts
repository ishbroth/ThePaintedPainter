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

import type { EstimatorContext, EstimateBreakdown, EstimateLineItem, UserResponseStyle } from '../types';
import { calculateEstimate } from '../estimateEngine';
import { supabase } from '../supabase';
import { extractAll, extractPhotoTriggers, extractTimeline, extractPropertyType, extractAccessSignals, extractZip, extractSquareFeet } from './extractors';
import { getStateFromZip } from '../zipCodeData';
import { hasScopeLimiter } from './scopeWords';
import { isDenial, denialIsAboutScope, topicLabel, recentRecognized, recapSentence } from './clarify';
import { extractTiming, timelineFromStart } from './dateParsing';
import { defaultAssumptions, applyAssumptions, type Assumption } from './defaultAssumptions';
import {
  matchSituations,
  stackedMultiplier,
  stackedAddend,
  type MatchedSituation,
} from '../pricing/situations';
import { classifyIntent, hasIntent, type Intent, type IntentResult } from './intents';
import { derive, applyDerivations } from './derivation';
import { pickNextTopic, pickRetryTopic, findTopic, metaBank, type Topic } from './topics';
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

/** A restorable snapshot of everything EXCEPT the visible chat history, so
 * "back up" can undo the last exchange's effect on state without erasing
 * what was actually said. Deliberately plain/JSON-safe (lastBotTopicId, not
 * the Topic object) — see the lastBotTopic serialization note below. */
export interface ChatSnapshot {
  ctx: EstimatorContext;
  transcript: string;
  askedIds: string[];
  retriedIds: string[];
  lastBotTopicId: string | null;
  wrapupAsked: boolean;
}

export interface ChatState {
  ctx: EstimatorContext;
  history: ChatMessage[];
  transcript: string;
  askedIds: string[];
  /** Topics that were asked but the user answered something else instead —
   * circled back to once, before giving up and falling to the generic
   * wrap-up "what's missing" prompt instead of asking forever. */
  retriedIds: string[];
  /** Topics where the customer's reply didn't fit and the bot asked what they meant (done once per topic, then it moves on). */
  clarifiedIds?: string[];
  /** The last topic the bot asked about, for clarification replies. */
  lastBotTopic: Topic | null;
  /** Has the bot invited a final-wrap-up check? */
  wrapupAsked: boolean;
  finalEstimate: ChatResult | null;
  /** State from immediately before the last processed message, restorable
   * via "back up". Single-level undo only (no redo/multi-step). */
  undoSnapshot: ChatSnapshot | null;
}

export interface ChatResult {
  estimate: EstimateBreakdown;
  ctx: EstimatorContext;
  assumptions: Assumption[];
  matchedSituations: MatchedSituation[];
  summary: string;
  /** Kept so the price can be recalculated when the customer takes items or rooms off it. */
  transcript?: string;
  loyaltyDiscountPercent?: number;
}

// ===== Initial state =====

export { makeInitialContext };

export function makeInitialState(): ChatState {
  return {
    ctx: makeInitialContext(),
    history: [
      {
        role: 'bot',
        text: "Hello, what do you need painted?",
        timestamp: Date.now(),
      },
    ],
    transcript: '',
    askedIds: [],
    retriedIds: [],
    lastBotTopic: null,
    wrapupAsked: false,
    finalEstimate: null,
    undoSnapshot: null,
  };
}

/**
 * Records a photo the customer just uploaded in response to a
 * `[[photo:id|label]]` link (or the generic end-of-chat property-photo
 * ask), marks that request fulfilled, and has the bot briefly acknowledge
 * it. Called directly by the UI's upload handler — no LLM/extraction
 * involved, since the "which request does this fulfill" mapping is already
 * known (the user clicked a specific link).
 */
export function applyUploadedPhoto(
  state: ChatState,
  requestId: string,
  photo: { url: string; description: string; label: string },
): ChatState {
  const photoRequests = state.ctx.photoRequests.map((r) =>
    r.id === requestId ? { ...r, fulfilled: true } : r,
  );
  const photos = [...state.ctx.photos, { id: `${requestId}-${Date.now()}`, ...photo }];
  return {
    ...state,
    ctx: { ...state.ctx, photoRequests, photos },
    history: [
      ...state.history,
      botMessage(`Got the photo of ${photo.label} — thanks, that helps a lot.`),
    ],
  };
}

export interface PhotoAssessment {
  severity: 'minor' | 'moderate' | 'extensive' | null;
  matchesDescription: boolean;
  note: string;
}

// Which pricing field a photo's visual severity read feeds, and how the
// generic minor/moderate/extensive scale maps onto that field's own
// vocabulary. Only requests with a clear existing pricing lever are listed
// here — everything else's photo is still attached/forwarded, just without
// an automatic pricing adjustment.
const SEVERITY_TARGETS: Record<string, { field: 'drywallRepairExtent' | 'closetShelving'; map: Record<string, string> }> = {
  extensive_repair: { field: 'drywallRepairExtent', map: { minor: 'minor', moderate: 'moderate', extensive: 'major' } },
  closet_shelving: { field: 'closetShelving', map: { minor: 'wire', moderate: 'built_in', extensive: 'extensive' } },
};

/**
 * Folds a vision assessment of an uploaded photo into the estimate — for
 * the two trigger types with a clear existing pricing lever (repair
 * extent, closet shelving scope), and always as a brief bot note either
 * way. Called once analyze-quote-photo resolves, which happens after the
 * photo is already attached — this only refines pricing, it never blocks
 * or delays showing the photo as attached.
 */
export function applyPhotoAssessment(state: ChatState, requestId: string, assessment: PhotoAssessment): ChatState {
  let ctx = state.ctx;
  const target = assessment.severity ? SEVERITY_TARGETS[requestId] : undefined;
  if (target) {
    const mapped = target.map[assessment.severity!];
    if (mapped) {
      ctx = { ...ctx, [target.field]: mapped, conditionAddressed: true };
    }
  }
  if (!assessment.note.trim()) {
    return ctx === state.ctx ? state : { ...state, ctx };
  }
  return {
    ...state,
    ctx,
    history: [...state.history, botMessage(assessment.note.trim())],
  };
}

// ===== Persistence (sessionStorage) =====
//
// Bump this whenever ChatState or EstimatorContext's shape changes in a way
// that could break loading an older saved conversation. Without a version
// check, a schema change (a field added/removed/repurposed) could silently
// load a subtly-incompatible object and misbehave in ways that are hard to
// trace back to "the browser had stale storage."
//
// Also bump for a content-only change worth forcing everyone to see fresh
// (e.g. the greeting text) — sessionStorage survives a hard refresh, so a
// restored conversation keeps whatever greeting was baked into history[0]
// at the time it was saved, and (separately) ChatPanel's scroll-triggered
// read-aloud only fires for a still-fresh conversation, so a restored
// mid-conversation session silently never autoplays either.
const CHAT_STATE_SCHEMA_VERSION = 6;

/**
 * `lastBotTopic` is a `Topic` object with live function properties (ask,
 * clarify, example). JSON.stringify silently drops functions, so a
 * naive persist/restore round-trip leaves `lastBotTopic` a hollow object
 * that throws the moment anything calls `.ask()` on it — every message
 * after a restore would fail. Store just the topic id and re-resolve the
 * real Topic (with its functions intact) via findTopic() on load instead.
 */
export function serializeChatState(state: ChatState): string {
  return JSON.stringify(chatStateToPortable(state));
}

/** Returns null (caller should fall back to makeInitialState()) if the saved data is missing, corrupt, or from an incompatible schema version. */
export function deserializeChatState(json: string): ChatState | null {
  try {
    return chatStateFromPortable(JSON.parse(json));
  } catch {
    return null;
  }
}

/**
 * Same shape as serializeChatState()/deserializeChatState() but as a plain
 * object rather than a JSON string, for storing directly in a JSONB
 * column (account-level persistence for signed-in users — see
 * chatEstimator/accountPersistence.ts) instead of round-tripping through
 * an extra layer of string encoding.
 */
export function chatStateToPortable(state: ChatState): unknown {
  return {
    version: CHAT_STATE_SCHEMA_VERSION,
    state: { ...state, lastBotTopic: state.lastBotTopic?.id ?? null },
  };
}

/** Returns null if the data is missing, corrupt, or from an incompatible schema version. */
export function chatStateFromPortable(parsed: unknown): ChatState | null {
  const p = parsed as { version?: number; state?: unknown } | null;
  if (!p || p.version !== CHAT_STATE_SCHEMA_VERSION || !p.state) return null;
  const raw = p.state as ChatState & { lastBotTopic: string | null };
  return {
    ...raw,
    lastBotTopic: raw.lastBotTopic ? findTopic(raw.lastBotTopic) : null,
  };
}

// ===== Core turn handler =====

export interface TurnResult {
  state: ChatState;
  done: ChatResult | null;
}

function botMessage(text: string): ChatMessage {
  return { role: 'bot', text, timestamp: Date.now() };
}

function classifyResponseStyle(avgLen: number): UserResponseStyle {
  if (avgLen < 15) return 'terse';
  if (avgLen > 120) return 'detailed';
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
  const extracted = extractAll(trimmed, state.ctx, state.lastBotTopic?.id ?? null);
  return { intent, patch: extracted.patch, acknowledgements: extracted.acknowledgements };
}

// Deliberately a local, zero-cost regex check — not routed through the LLM
// at all — so "back up" always works instantly and for free regardless of
// how the model would classify it.
const BACK_UP_RE = /^(back\s*up|go\s*back|undo(?:\s+that)?|previous\s+question)[\s.!?]*$/i;

function snapshotOf(state: ChatState): ChatSnapshot {
  return {
    ctx: state.ctx,
    transcript: state.transcript,
    askedIds: state.askedIds,
    retriedIds: state.retriedIds,
    lastBotTopicId: state.lastBotTopic?.id ?? null,
    wrapupAsked: state.wrapupAsked,
  };
}

export async function handleUserMessage(state: ChatState, userText: string, customerId?: string): Promise<TurnResult> {
  const trimmed = userText.trim();
  if (!trimmed) return { state, done: null };

  if (BACK_UP_RE.test(trimmed)) {
    const userMsg: ChatMessage = { role: 'user', text: trimmed, timestamp: Date.now() };
    if (!state.undoSnapshot) {
      return {
        state: {
          ...state,
          history: [...state.history, userMsg, botMessage("We're right at the start — nothing to back up to yet.")],
        },
        done: null,
      };
    }
    const snap = state.undoSnapshot;
    const restoredTopic = snap.lastBotTopicId ? findTopic(snap.lastBotTopicId) : null;
    const reask = restoredTopic ? restoredTopic.ask(snap.ctx) : "What do you need painted?";
    const restored: ChatState = {
      ...state,
      ctx: snap.ctx,
      transcript: snap.transcript,
      askedIds: snap.askedIds,
      retriedIds: snap.retriedIds,
      lastBotTopic: restoredTopic,
      wrapupAsked: snap.wrapupAsked,
      finalEstimate: null,
      undoSnapshot: null, // single-level undo — no redo, no chained back-ups
      history: [...state.history, userMsg, botMessage("No problem — backing up. " + reask)],
    };
    return { state: restored, done: null };
  }

  const preTurnSnapshot = snapshotOf(state);
  const result = await processMessage(state, trimmed, customerId);
  return { ...result, state: { ...result.state, undoSnapshot: preTurnSnapshot } };
}

async function processMessage(state: ChatState, trimmed: string, customerId?: string): Promise<TurnResult> {
  // 1. Understand the message (LLM first, local rules engine as fallback),
  //    then apply derivations against the full transcript
  const understood = await understand(trimmed, state);
  const { intent, patch } = understood;
  // the same fact can come back from more than one reader ("450 sqft, 450 sqft"): say each once
  const acknowledgements = understood.acknowledgements.filter((a, i, all) => all.findIndex((b) => b.replace(/,/g, '') === a.replace(/,/g, '')) === i);
  // ---- Ask instead of assuming ---------------------------------------------------------------------------------
  const asBot = (extra: Partial<ChatState>, text: string): TurnResult => ({
    state: {
      ...state,
      ...extra,
      history: [...state.history, { role: 'user', text: trimmed, timestamp: Date.now() }, botMessage(text)],
    },
    done: null,
  });
  const recap = recapSentence(recentRecognized(state.history));

  // The customer is disputing something the bot did ("I never said trim", "I didn't say walls only"): apologise, say what
  // was actually understood, and ask — never fill in a default. Nothing in the message is applied.
  if (state.askedIds.length > 0 && isDenial(trimmed)) {
    if (denialIsAboutScope(trimmed) && state.ctx.projectType !== 'exterior') {
      const reset: EstimatorContext = {
        ...state.ctx,
        interiorWalls: 'yes', interiorCeilings: 'yes', interiorTrim: 'yes', interiorDoors: 'some',
        surfacesAddressed: false, trimScopeAddressed: false,
      };
      const surfacesTopic = findTopic('surfaces');
      const scopeQuestion =
        state.ctx.projectType === 'both'
          ? 'Inside, which of these are being painted: walls, ceilings, trim, doors? And outside, is it just the siding, or the trim, doors, deck and fence too?'
          : 'Which of these are being painted: walls, ceilings, trim, doors? (Say "everything" or list the ones you want.)';
      return asBot(
        {
          ctx: reset,
          askedIds: state.askedIds.filter((id) => id !== 'surfaces' && id !== 'trim_scope'),
          lastBotTopic: surfacesTopic ?? state.lastBotTopic,
        },
        `Sorry about that, I shouldn't have assumed. ${recap} Let's pin down exactly what's being painted first. ${scopeQuestion}`,
      );
    }
    const again = state.lastBotTopic ? state.lastBotTopic.ask(state.ctx) : 'What would you like me to change?';
    return asBot({}, `Sorry about that, I shouldn't have assumed. ${recap} Tell me what's wrong and I'll fix it, or answer this: ${again.charAt(0).toLowerCase()}${again.slice(1)}`);
  }

  const ctxWithExplicit: EstimatorContext = { ...state.ctx, ...patch };

  // A reading of the message that isn't supported by anything the customer actually said gets undone, not priced.
  // Surfaces: a surface can only be switched OFF by a message that names it (or limits the scope: "only", "just", "walls only"),
  // and the whole scope only counts as answered when the customer actually covered it. "No trim" says nothing about the ceilings.
  {
    const low = trimmed.toLowerCase();
    const named = {
      walls: /\bwalls?\b/.test(low),
      ceilings: /\bceilings?\b/.test(low),
      trim: /\b(trim|baseboards?|casings?|molding|moulding)\b/.test(low),
      doors: /\bdoors?\b/.test(low),
    };
    const limiter = hasScopeLimiter(trimmed) || /\b(everything|all of it|the works|full package|whole (?:thing|room|house|place))\b/.test(low);
    const answeringSurfaces = state.lastBotTopic?.id === 'surfaces';
    const flips: Array<[keyof EstimatorContext, string, keyof typeof named]> = [
      ['interiorWalls', 'no', 'walls'], ['interiorCeilings', 'no', 'ceilings'], ['interiorTrim', 'no', 'trim'], ['interiorDoors', 'none', 'doors'],
    ];
    for (const [field, off, word] of flips) {
      if (ctxWithExplicit[field] === off && state.ctx[field] !== off && !named[word] && !limiter && !answeringSurfaces) {
        (ctxWithExplicit as unknown as Record<string, unknown>)[field] = state.ctx[field];
      }
    }
    if (!state.ctx.surfacesAddressed && ctxWithExplicit.surfacesAddressed && !answeringSurfaces && !limiter && !(named.walls && named.ceilings)) {
      ctxWithExplicit.surfacesAddressed = false;
    }
    // Mentioning the ceilings as something to paint puts them in scope, whatever else was assumed.
    const negatesCeiling = /\b(?:no|not|without|skip|except|excluding|leave|don'?t (?:paint|do|need))\s+(?:the\s+|any\s+|our\s+)?(?:\w+\s+)?ceilings?\b/.test(low);
    if (named.ceilings && !negatesCeiling && ctxWithExplicit.interiorCeilings === 'no' && !/\bremov|scrape|popcorn\b/.test(low)) {
      ctxWithExplicit.interiorCeilings = 'yes';
    }
  }
  if (state.ctx.exteriorColorChange !== 'different' && ctxWithExplicit.exteriorColorChange === 'different' && !/(exterior|outside|siding|stucco|brick|house color|front|fence|deck|shutter|fascia)/i.test(trimmed)) {
    ctxWithExplicit.exteriorColorChange = state.ctx.exteriorColorChange;
  }

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
  // Corrections ("actually the zip is 98101", "it's closer to 2,400 sq ft", "change my dates to ..."): the extractors only
  // fill empty fields, so without this a later correction would be silently ignored.
  if (/\b(actually|correction|correct that|oh wait|wait,|sorry,|i meant|make that|change (?:it|that|the|my)|should (?:be|say)|instead|not [\w ]{0,20} but)\b/i.test(trimmed)) {
    const zipFix = extractZip(trimmed);
    if (zipFix && zipFix !== ctxWithExplicit.zipCode) {
      ctxWithExplicit.zipCode = zipFix;
      const st = getStateFromZip(zipFix);
      if (st) ctxWithExplicit.state = st;
      acknowledgements.push(`updated the ZIP to ${zipFix}`);
    }
    const sqftFix = extractSquareFeet(trimmed);
    if (sqftFix && sqftFix !== ctxWithExplicit.squareFeet) {
      ctxWithExplicit.squareFeet = sqftFix;
      acknowledgements.push(`updated the size to ${sqftFix.toLocaleString()} sqft`);
    }
    const dateFix = extractTiming(trimmed);
    if (dateFix.startDate && dateFix.startDate !== ctxWithExplicit.startDate) {
      ctxWithExplicit.startDate = dateFix.startDate;
      ctxWithExplicit.endDate = dateFix.endDate ?? '';
      ctxWithExplicit.timeline = timelineFromStart(dateFix.startDate);
      acknowledgements.push(`updated your dates to ${dateFix.startDate}${dateFix.endDate ? ` – ${dateFix.endDate}` : ''}`);
    }
  }

  // Timing safety net (LLM path and local fallback alike): dates, "my dates are flexible", "sometime in March" and
  // "no rush" are also read with plain rules, so a miss by the language model can't leave the question unanswered.
  const timing = extractTiming(trimmed);
  if (timing.flexible && !ctxWithExplicit.datesFlexible) ctxWithExplicit.datesFlexible = true;
  if (timing.startDate && !ctxWithExplicit.startDate) {
    ctxWithExplicit.startDate = timing.startDate;
    if (timing.endDate && !ctxWithExplicit.endDate) ctxWithExplicit.endDate = timing.endDate;
  } else if (timing.endDate && !ctxWithExplicit.endDate) {
    ctxWithExplicit.endDate = timing.endDate;
  }
  if (!ctxWithExplicit.timeline) {
    const urgency =
      extractTimeline(trimmed) ??
      (ctxWithExplicit.startDate ? timelineFromStart(ctxWithExplicit.startDate) : null) ??
      (ctxWithExplicit.datesFlexible ? 'no_rush' : null);
    if (urgency) ctxWithExplicit.timeline = urgency;
  }
  if (!ctxWithExplicit.propertyType) {
    const owner = extractPropertyType(trimmed);
    if (owner) ctxWithExplicit.propertyType = owner;
  }
  if (!ctxWithExplicit.occupancy) {
    const access = extractAccessSignals(trimmed);
    if (access.vacant) ctxWithExplicit.occupancy = 'vacant';
    else if (access.furnished || access.occupied) ctxWithExplicit.occupancy = 'furnished';
  }
  const derivations = derive(ctxWithExplicit, newTranscript);
  const responseLengths = [...state.ctx.responseLengths, trimmed.length];
  const ctxNext = {
    ...applyDerivations(ctxWithExplicit, derivations),
    answeredQuestions: state.ctx.answeredQuestions + 1,
    // Classified from the AVERAGE length across the whole conversation, not
    // just this one message — this used to reclassify on every turn from
    // the latest message alone, which meant finishing with "run it" (6
    // characters, however detailed everything said before it was) always
    // reset responseStyle to 'terse' right before pricing runs. Since
    // that's the near-universal way a conversation ends, it silently
    // applied a 10% "fewer details" padding surcharge — and denied the
    // tighter high-confidence price range — to nearly every completed
    // quote, regardless of how much detail the customer actually gave.
    responseStyle: classifyResponseStyle(responseLengths.reduce((sum, n) => sum + n, 0) / responseLengths.length),
    responseLengths,
  };

  // Photo-request triggers — a bare keyword match, run independently of
  // whichever extraction path (LLM or regex) handled the rest of this
  // message, and deduplicated against requests already raised so the same
  // trigger doesn't fire twice in one conversation.
  const newPhotoTriggers = extractPhotoTriggers(trimmed).filter(
    (t) => !state.ctx.photoRequests.some((r) => r.id === t.key),
  );
  if (newPhotoTriggers.length > 0) {
    ctxNext.photoRequests = [
      ...ctxNext.photoRequests,
      ...newPhotoTriggers.map((t) => ({ id: t.key, label: t.label, fulfilled: false })),
    ];
  }
  // Embedded in the bot's reply text as `[[photo:key|label]]` — ChatPanel
  // renders these as clickable "Provide a picture of ___" links, positioned
  // (by insertion order below) right after the acknowledgment of what the
  // customer just said and before the next question, per spec.
  const photoLinkMarker = newPhotoTriggers.map((t) => `[[photo:${t.key}|${t.label}]]`).join(' ');

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

  // 2. Ready-to-finish — jump to finalize if we have enough. Checked BEFORE
  // the softer meta-chatter checks below (step 3): terse phrases like "run
  // it" have occasionally also been tagged with something like "deflection"
  // or "ask_clarification" by the model, and since those are checked first
  // they'd otherwise win and produce a reply that has nothing to do with
  // the user clearly signaling they're ready to see a price.
  // The price is only run when the customer clearly asks for it ("run it", "give me the price", "that's all") or after the
  // wrap-up question. A reply that merely sounds finished to the language model ("ready to go" about the walls) isn't a request.
  const explicitRunIt = /\b(run it|run the numbers?|price it(?: out)?|give me (?:the|a) (?:price|number)|show me (?:the )?(?:price|number)|get (?:me )?(?:the )?price|go ahead|that'?s (?:all|it|everything)|i'?m done|nothing else|finish it)\b/i.test(trimmed);
  const wantsFinish = hasIntent(intent, 'ready_to_finish') && (s.wrapupAsked || explicitRunIt);
  if (wantsFinish) {
    // Even on an explicit "run it", the standard questions come first (ZIP, timing, occupancy, rental or home) unless the wrap-up was reached.
    const essentialsKnown =
      !!ctxNext.zipCode &&
      !!(ctxNext.timeline || ctxNext.startDate || ctxNext.endDate || ctxNext.datesFlexible) &&
      (ctxNext.projectType === 'exterior' || !!ctxNext.occupancy) &&
      !!ctxNext.propertyType;
    if (readyToQuote(ctxNext) && (s.wrapupAsked || essentialsKnown)) {
      return await finalizeTurn(s, customerId);
    }
    if (readyToQuote(ctxNext)) {
      s = { ...s, history: [...s.history, botMessage("Happy to run it. I just need a few quick details first so the price is accurate.")] };
    } else {
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
  } else {
    // 3. Handle meta questions / clarifications before advancing topics
    const metaReply = metaAnswer(intent.intents, s.lastBotTopic, s, Object.keys(patch).length > 0);
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

    // 4. Frustration / greeting / restart
    //
    // Skip the generic "sorry about that" when already_answered is ALSO
    // present — that more specific handler (below) gives its own, more
    // useful reply (either finds the answer or honestly says it can't),
    // and showing both back-to-back as two separate bot bubbles for the
    // same message just reads as a stutter.
    if (hasIntent(intent, 'frustration') && !hasIntent(intent, 'already_answered')) {
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
  }

  // 5. Handle negation / confirmation in the context of the last topic
  //
  // Only treat "negation" as answering the LAST topic's yes/no question when
  // the message isn't also correcting something more fundamental. A message
  // like "not inside, outside" reads as negation (it does negate something)
  // but is actually correcting projectType/propertyType/scope, not answering
  // whatever the last topic asked — firing the canned "okay, just walls
  // then" reply for that would be a non-sequitur that has nothing to do with
  // what was actually said.
  const isMajorCorrection =
    patch.projectType !== undefined ||
    patch.propertyType !== undefined ||
    patch.interiorScope !== undefined;
  if (hasIntent(intent, 'negation') && s.lastBotTopic && !isMajorCorrection) {
    const reply = metaBank.negation_after_topic(s.lastBotTopic.id);
    s = { ...s, history: [...s.history, botMessage(reply)] };
    // Fall through to topic advance
  }
  // "I already told you" — the user is pointing at a specific repeated
  // question, not just venting, so look back through the FULL transcript
  // (every message they've sent this whole conversation, not just this
  // one) with the same extractors, told which topic is currently pending
  // so context-only signals (a bare "600" for size, etc.) can resolve too.
  // If that turns up the answer, apply it and move on for real instead of
  // just apologizing and re-asking the same question. If it genuinely
  // isn't anywhere in the transcript, say so honestly and move on with a
  // stated default rather than repeating the loop.
  if (hasIntent(intent, 'already_answered') && s.lastBotTopic) {
    const topic = s.lastBotTopic;
    const rescan = extractAll(s.transcript, s.ctx, topic.id);
    const rescannedCtx = { ...s.ctx, ...rescan.patch };
    const resolved = Object.keys(rescan.patch).length > 0 && topic.alreadyAnswered(rescannedCtx);
    if (resolved) {
      s = {
        ...s,
        ctx: rescannedCtx,
        history: [
          ...s.history,
          botMessage(`You're right, sorry about that — found it: ${rescan.acknowledgements.join(', ') || 'got it'}.`),
        ],
      };
    } else {
      const fallback = metaBank.uncertainty(topic.id);
      s = {
        ...s,
        ctx: { ...s.ctx, ...statedUncertaintyDefault(topic.id) },
        history: [
          ...s.history,
          botMessage(`I'm sorry — I don't actually see that anywhere in what you've sent so far. ${fallback}`),
        ],
      };
    }
    if (!s.askedIds.includes(topic.id)) s = { ...s, askedIds: [...s.askedIds, topic.id] };
    if (!s.retriedIds.includes(topic.id)) s = { ...s, retriedIds: [...s.retriedIds, topic.id] };
    return await advanceAfterUncertainty(s, customerId);
  }
  if (hasIntent(intent, 'express_uncertainty')) {
    const reply = metaBank.uncertainty(s.lastBotTopic?.id ?? null);
    s = {
      ...s,
      ctx: { ...s.ctx, ...statedUncertaintyDefault(s.lastBotTopic?.id ?? null) },
      history: [...s.history, botMessage(reply)],
    };
    // Mark the topic as "answered by uncertainty" so we don't re-ask — and
    // also mark it as already retried, since the metaBank.uncertainty()
    // reply already told the user we're moving on with an assumption (e.g.
    // "no worries — I'll assume X"). Without also touching retriedIds, that
    // promise was broken: pickRetryTopic would still circle back to this
    // same topic later with a jarring "I don't think I got this one" once
    // other topics ran out, even though the user was told it was settled.
    if (s.lastBotTopic && !s.askedIds.includes(s.lastBotTopic.id)) {
      s = { ...s, askedIds: [...s.askedIds, s.lastBotTopic.id] };
    }
    if (s.lastBotTopic && !s.retriedIds.includes(s.lastBotTopic.id)) {
      s = { ...s, retriedIds: [...s.retriedIds, s.lastBotTopic.id] };
    }
    return await advanceAfterUncertainty(s, customerId);
  }

  // A partial scope answer ("no trim") leaves the ceilings and doors open: ask about those now, once, instead of assuming.
  if (
    s.lastBotTopic?.id === 'surfaces' &&
    !s.lastBotTopic.alreadyAnswered(ctxNext) &&
    !(s.clarifiedIds ?? []).includes('surfaces') &&
    (ctxNext.interiorTrim === 'no' || ctxNext.interiorCeilings === 'no' || ctxNext.interiorDoors === 'none')
  ) {
    s = {
      ...s,
      clarifiedIds: [...(s.clarifiedIds ?? []), 'surfaces'],
      history: [...s.history, botMessage(s.lastBotTopic.ask(ctxNext))],
    };
    return { state: s, done: null };
  }

  // A reply that matched nothing and doesn't answer the question: ask what they meant (once per topic) with what we
  // understood so far, instead of assuming something or skipping ahead.
  {
    const topic = s.lastBotTopic;
    const clarified = s.clarifiedIds ?? [];
    const ignoredKeys = new Set(['answeredQuestions', 'responseStyle', 'responseLengths', 'photoRequests']);
    const changed = (Object.keys(ctxNext) as Array<keyof EstimatorContext>).some(
      (k) => !ignoredKeys.has(k) && JSON.stringify(ctxNext[k]) !== JSON.stringify(state.ctx[k]),
    );
    const plainReply = /^(yes|yeah|yep|yup|no|nope|nah|ok|okay|sure|fine|maybe|idk|not sure|skip)\b[.!]?$/i.test(trimmed);
    if (
      topic &&
      !topic.alreadyAnswered(ctxNext) &&
      !changed &&
      !clarified.includes(topic.id) &&
      !s.wrapupAsked &&
      !/\b(run it|price it|go ahead|that'?s (?:all|it)|done)\b/i.test(trimmed) &&
      !trimmed.endsWith('?') &&
      !plainReply &&
      trimmed.split(/\s+/).length >= 2 &&
      !hasIntent(intent, 'ready_to_finish') &&
      !hasIntent(intent, 'express_uncertainty') &&
      !hasIntent(intent, 'negation') &&
      !hasIntent(intent, 'ask_clarification') &&
      !hasIntent(intent, 'ask_example') &&
      !hasIntent(intent, 'greeting')
    ) {
      const q = topic.ask(ctxNext);
      s = {
        ...s,
        clarifiedIds: [...clarified, topic.id],
        history: [
          ...s.history,
          botMessage(
            `I'm not sure how that answers my question about ${topicLabel(topic.id)}, and I'd rather ask than guess. ${recapSentence(recentRecognized(state.history))} ${q} If something above is wrong, just tell me what to change.`.replace(/\s{2,}/g, ' '),
          ),
        ],
      };
      return { state: s, done: null };
    }
  }

  // 6. If we're ready to quote and we already asked the wrap-up, finalize
  if (s.wrapupAsked && readyToQuote(ctxNext)) {
    return await finalizeTurn(s, customerId);
  }

  // 7. Pick the next topic; if none, try circling back to anything asked but
  // never satisfactorily answered; if that's also exhausted, invite wrap-up
  // then finalize.
  const next = pickNextTopic(ctxNext, s.askedIds);
  if (!next) {
    const retry = pickRetryTopic(ctxNext, s.askedIds, s.retriedIds);
    if (retry) {
      const question = retry.ask(ctxNext);
      const retryPrompt =
        (acknowledgements.length > 0 ? `${ACK_LEAD_INS[s.askedIds.length % ACK_LEAD_INS.length]} ${acknowledgements.join(', ')}. ` : '') +
        (photoLinkMarker ? `${photoLinkMarker} ` : '') +
        // when half of a two-part question was answered, just ask for the missing half instead of claiming it wasn't understood
        (retry.id === 'timeline_and_access' && (ctxNext.occupancy || ctxNext.timeline || ctxNext.startDate || ctxNext.datesFlexible)
          ? `One more thing — ${question.charAt(0).toLowerCase()}${question.slice(1)}`
          : `Circling back — I don't think I got this one: ${question.charAt(0).toLowerCase()}${question.slice(1)}`);
      s = {
        ...s,
        retriedIds: [...s.retriedIds, retry.id],
        lastBotTopic: retry,
        history: [...s.history, botMessage(retryPrompt)],
      };
      return { state: s, done: null };
    }
    if (!s.wrapupAsked) {
      // One more photo ask at the very end regardless of whether anything
      // else triggered one — actual property photos (not just the specific
      // detail shots above) help painters respond faster and with more
      // confidence, so it's worth inviting even for a straightforward job.
      const alreadyAskedForProperty = ctxNext.photoRequests.some((r) => r.id === 'property');
      const propertyMarker = alreadyAskedForProperty ? '' : '[[photo:property|the property]] ';

      // Anything raised earlier in the conversation that never got a photo
      // attached — remind here rather than letting it quietly drop, since
      // this is the last natural chance before the estimate finalizes.
      const unfulfilled = ctxNext.photoRequests.filter((r) => !r.fulfilled && r.id !== 'property');
      const reminderMarkers = unfulfilled.map((r) => `[[photo:${r.id}|${r.label}]]`).join(' ');
      const reminderLeadIn = unfulfilled.length > 0
        ? `While we're at it, I still don't have a picture for ${unfulfilled.length === 1 ? 'this' : 'these'}: `
        : '';

      s = {
        ...s,
        ctx: alreadyAskedForProperty
          ? s.ctx
          : { ...s.ctx, photoRequests: [...s.ctx.photoRequests, { id: 'property', label: 'the property', fulfilled: false }] },
        wrapupAsked: true,
        askedIds: [...s.askedIds, 'wrapup'],
        history: [
          ...s.history,
          botMessage(
            `I think I've got enough to put a number together. ${reminderLeadIn}${reminderMarkers}${reminderMarkers ? ' ' : ''}${propertyMarker}A couple of photos of the property help painters respond faster and with more confidence, so feel free to attach some. ` +
              "Anything else I should know — unusual heights, tough access, special colors, timing? " +
              "Otherwise just say 'run it' and I'll price it out.",
          ),
        ],
      };
      return { state: s, done: null };
    }
    // We're here because wrapup was asked and there's nothing new — finalize.
    return await finalizeTurn(s, customerId);
  }

  // 8. Ask the next topic — lead with a brief acknowledgment of what was
  //    just said so the reply doesn't read as a non-sequitur when the user
  //    volunteers detail beyond what the last question asked for.
  const ackLeadIn = acknowledgements.length > 0
    ? `${ACK_LEAD_INS[s.askedIds.length % ACK_LEAD_INS.length]} ${acknowledgements.join(', ')}. `
    : '';
  const prompt = ackLeadIn + (photoLinkMarker ? `${photoLinkMarker} ` : '') + next.ask(ctxNext);
  s = {
    ...s,
    askedIds: [...s.askedIds, next.id],
    lastBotTopic: next,
    history: [...s.history, botMessage(prompt)],
  };
  return { state: s, done: null };
}

// ===== Sub-routines =====

/**
 * metaBank.uncertainty() SAYS a specific default out loud (e.g. "most folks
 * go with walls only, so I'll default to that" for 'surfaces') but that was
 * previously just spoken reassurance — nothing actually changed the
 * context, so interiorCeilings/Trim/Doors stayed at their normal
 * defaults (which mean "everything", not "walls only"). That mismatch
 * meant the bot could tell a customer it was defaulting to walls-only and
 * then, moments later, still ask a trim-scope follow-up that only makes
 * sense if trim were actually in scope. This makes the stated assumption
 * real so what gets priced matches what the customer was told.
 */
function statedUncertaintyDefault(topicId: string | null): Partial<EstimatorContext> {
  if (topicId === 'surfaces') {
    return { interiorCeilings: 'no', interiorTrim: 'no', interiorDoors: 'none', surfacesAddressed: true };
  }
  return {};
}

function metaAnswer(
  intents: Intent[],
  lastTopic: Topic | null,
  state: ChatState,
  hasSubstantiveInfo: boolean,
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

  // A message that actually extracted real job facts (e.g. "4000 square
  // feet") is not a confused user asking for clarification or an example,
  // even if the classifier also tagged it that way — skip these two so the
  // reply doesn't ignore the info just given in favor of a tangential
  // "here's what that means" explainer.
  if (!hasSubstantiveInfo) {
    if (intents.includes('ask_clarification')) {
      if (lastTopic) return lastTopic.clarify(state.ctx);
      return "What would you like me to clarify? Say more and I'll help.";
    }
    if (intents.includes('ask_example')) {
      if (lastTopic) return lastTopic.example(state.ctx);
      return "Tell me what part you'd like an example of and I'll walk through it.";
    }
  }

  if (intents.includes('deflection')) {
    if (/email/.test(state.history[state.history.length - 1]?.text ?? '')) {
      return metaBank.deflection_email();
    }
    return metaBank.deflection_ballpark();
  }

  return null;
}

async function advanceAfterUncertainty(state: ChatState, customerId?: string): Promise<TurnResult> {
  const next = pickNextTopic(state.ctx, state.askedIds);
  if (!next) {
    // If nothing left, go to wrap-up/finalize path
    if (readyToQuote(state.ctx)) {
      return await finalizeTurn(state, customerId);
    }
    return { state, done: null };
  }
  const prompt = next.ask(state.ctx);
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

/** Registered customers can carry a loyalty discount into their next
 * estimate; guests (no customerId) never get one. Failure here (RPC down,
 * network hiccup) must never block the estimate itself — worst case the
 * customer just doesn't see a discount they're entitled to this one time. */
async function fetchLoyaltyDiscountPercent(customerId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('sync_loyalty_decay', { p_customer_id: customerId });
    if (error || !data || !data[0]) return 0;
    return data[0].discount_percent ?? 0;
  } catch {
    return 0;
  }
}

async function finalizeTurn(state: ChatState, customerId?: string): Promise<TurnResult> {
  const loyaltyDiscountPercent = customerId ? await fetchLoyaltyDiscountPercent(customerId) : 0;
  const result = finalize(state.ctx, state.transcript, loyaltyDiscountPercent);
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
  'Standard Turnover Finish (rental/pre-sale)':
    "Since this is a rental or a pre-sale turnover, I knocked a bit off — that kind of job usually doesn't need the same showroom-perfect finish an owner-occupied home does.",
  'Multi-Unit Volume Discount':
    "Since it's multiple units, I applied a volume discount — bulk work like this typically runs cheaper per unit.",
  'Commercial Property':
    "Commercial space runs a bit higher — different insurance and scheduling needs than a residential job.",
  'Rush Scheduling':
    "I added a rush-scheduling premium since you need this done fast — that usually means pulling a crew off another job.",
  'After-Hours/Weekend Scheduling':
    "Since this needs to happen after hours or on weekends to avoid disrupting the business, I've included a scheduling premium for that.",
  'Pre-1978 Lead-Safe Practices':
    "Since the home predates 1978, I've included EPA-required lead-safe prep — that's the law, not optional, and it adds a bit to the cost.",
  'Difficult Access':
    "I added a surcharge for the tough access — that means real extra time getting materials and equipment in and out.",
};

/** Spoken notes for line items that aren't multipliers — flat add-on fees the user should hear about explicitly, not just find in the itemized breakdown. */
function lineItemNotes(ctx: EstimatorContext, lineItems: EstimateLineItem[]): string[] {
  const notes: string[] = [];
  if (lineItems.some((li) => li.description === 'Touch-Up Callback Allowance (high-end market)')) {
    notes.push("I've built in a small allowance for a possible touch-up visit — homes in this market tend to expect a very crisp finish.");
  }
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

function finalize(ctx: EstimatorContext, transcript: string, loyaltyDiscountPercent: number = 0): ChatResult {
  const assumptions = defaultAssumptions(ctx);
  const withAssumptions = applyAssumptions(ctx, assumptions);

  const matched = matchSituations(transcript, withAssumptions);
  const situationMultiplier = stackedMultiplier(matched);
  const situationAddend = stackedAddend(matched);
  const loyaltyFactor = loyaltyDiscountPercent > 0 ? 1 - loyaltyDiscountPercent / 100 : 1;

  const estimate = calculateEstimate(withAssumptions);

  const adjustedTotal = Math.round(estimate.total * situationMultiplier * loyaltyFactor + situationAddend);
  const adjustedLow = Math.round(estimate.lowRange * situationMultiplier * loyaltyFactor + situationAddend);
  const adjustedHigh = Math.round(estimate.highRange * situationMultiplier * loyaltyFactor + situationAddend);

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
      ...(loyaltyDiscountPercent > 0 ? [{ label: 'Loyalty Discount', factor: loyaltyFactor }] : []),
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
    ...lineItemNotes(withAssumptions, finalEstimate.lineItems),
    ...matched
      .filter((m) => m.situation.adjust.explainToUser)
      .map((m) => m.situation.userNote ?? m.situation.narrative),
    ...(loyaltyDiscountPercent > 0
      ? [`I also applied a ${loyaltyDiscountPercent}% loyalty discount for your account.`]
      : []),
  ];
  if (priceNotes.length > 0) {
    pieces.push(priceNotes.join(' '));
  }
  if (withAssumptions.multiPhaseRequested === 'yes') {
    pieces.push(
      `Since you mentioned spacing the work out, this total covers everything — mention the phases you have in mind when you claim your price so we can help coordinate separate dates.`,
    );
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
    transcript,
    loyaltyDiscountPercent,
  };
}

/**
 * Recalculate the price with rooms and main items taken off (or added back), using the same assumptions,
 * situations, surcharges and discounts as the original price, so the customer never has to redo the chat.
 */
export function repriceWithEdits(
  base: { ctx: EstimatorContext; transcript: string; loyaltyDiscountPercent?: number },
  excludedRooms: string[],
  excludedItems: string[],
): ChatResult {
  return finalize({ ...base.ctx, excludedRooms, excludedItems }, base.transcript, base.loyaltyDiscountPercent ?? 0);
}
