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
import { classifyIntent, hasIntent, type Intent } from './intents';
import { derive, applyDerivations } from './derivation';
import { pickNextTopic, metaBank, type Topic } from './topics';

// ===== Message / state =====

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

export function makeInitialContext(): EstimatorContext {
  return {
    zipCode: '', state: '', yearBuilt: null, propertyType: 'residential', projectType: '',
    interiorScope: '', selectedRooms: [], interiorWalls: 'yes', accentWalls: 'no',
    interiorCeilings: 'yes', ceilingType: '', interiorTrim: 'yes', crownMolding: 'no',
    wainscoting: 'no', baseboards: 'yes', interiorDoors: 'some', doorCount: null, doorTypes: [],
    doorFrames: 'no', interiorWindows: 'none', windowCount: null, windowTypes: [],
    cabinets: 'none', cabinetLocations: [], closets: 'none', closetCount: null,
    stairways: 'none', stairwayCount: null, stairwayDetails: '', interiorShutters: 'no',
    interiorColorChange: '',
    exteriorScope: 'full', sidingType: '', exteriorTrim: 'no', soffitsEaves: 'no',
    exteriorShutters: 'no', exteriorShutterCount: null, garageDoor: 'none', entryDoor: 'no',
    railings: 'none', railingType: '', balconies: 'none', balconyCount: null,
    deck: 'none', deckSize: '', fence: 'none', fenceLinearFeet: null, fenceType: 'privacy_6ft', gutters: 'no',
    foundation: 'no', exteriorWindows: 'none', exteriorWindowCount: null, overhangs: 'no',
    accessRestrictions: 'none', exteriorColorChange: '', exteriorCondition: 'good',
    prepWork: [], caulkingExtent: 'minor', drywallRepairExtent: 'minor',
    woodRotExtent: 'minor', wallpaperRooms: null, popcornCeilingRooms: null,
    squareFeet: null, stories: null, ceilingHeight: 'standard', occupancy: '',
    utilities: 'yes', hoa: 'no',
    contactName: '', contactPhone: '', contactEmail: '', contactNotes: '',
    projectCondition: '', hasStainedWood: 'no', bedroomCount: null,
    trimCondition: 'existing_good', wallTexture: 'smooth', doorMaterial: 'wood',
    cabinetScope: 'fronts_only', closetShelving: 'none', stuccoCondition: 'good',
    exteriorRailingMaterial: 'wood', interiorRailingMaterial: 'wood', additionalDetails: '',
    specialtyServices: [], fireplaceType: '', fireplaceCount: null, beamLinearFeet: null,
    beamLocation: 'standard', builtInCount: null, epoxyGarageSqft: null, epoxyType: 'basic',
    furnitureItems: [], brickSqft: null, brickTreatment: 'paint',
    answeredQuestions: 0, responseStyle: 'normal', responseLengths: [],
    specialtyReferrals: [], isHighCostArea: false, stateComplianceNotes: [],
  };
}

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

export function handleUserMessage(state: ChatState, userText: string): TurnResult {
  const trimmed = userText.trim();
  if (!trimmed) return { state, done: null };

  const intent = classifyIntent(trimmed);

  // 1. Extract explicit facts and apply derivations against the full transcript
  const { patch, acknowledgements } = extractAll(trimmed, state.ctx);
  const ctxWithExplicit: EstimatorContext = { ...state.ctx, ...patch };
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
    s = { ...s, history: [...s.history, botMessage(metaBank.frustration())] };
    return { state: s, done: null };
  }
  if (hasIntent(intent, 'greeting') && s.askedIds.length === 0) {
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
    // Not ready — tell the user what's still missing
    const missing = whatsMissing(ctxNext);
    s = {
      ...s,
      history: [
        ...s.history,
        botMessage(`Before I run the numbers I need one more thing: ${missing}`),
      ],
    };
    return { state: s, done: null };
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

  // 8. Ask the next topic
  const chips = next.chips?.(ctxNext);
  const prompt = next.ask(ctxNext) + (chips ? `  (${chips.join(' · ')})` : '');
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
