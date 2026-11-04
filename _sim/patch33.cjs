const fs = require('fs');
function patch(file, edits) {
  let t = fs.readFileSync(file, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 90));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split('\n').join('\r\n') : t);
}

patch('src/lib/chatEstimator/chatEngine.ts', [
  ["import { getStateFromZip } from '../zipCodeData';", "import { getStateFromZip } from '../zipCodeData';\nimport { isDenial, denialIsAboutScope, isAmbiguousRenting, topicLabel, recentRecognized, recapSentence } from './clarify';"],
  // state field
  ["  retriedIds: string[];\n  /** The last topic the bot asked about, for clarification replies. */",
   "  retriedIds: string[];\n  /** Topics where the customer's reply didn't fit and the bot asked what they meant (done once per topic, then it moves on). */\n  clarifiedIds?: string[];\n  /** The last topic the bot asked about, for clarification replies. */"],
  // early clarification handlers + sanitizer
  ["  const ctxWithExplicit: EstimatorContext = { ...state.ctx, ...patch };\n",
   `  // ---- Ask instead of assuming ---------------------------------------------------------------------------------
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
        \`Sorry about that, I shouldn't have assumed. \${recap} Let's pin down exactly what's being painted first. \${scopeQuestion}\`,
      );
    }
    const again = state.lastBotTopic ? state.lastBotTopic.ask(state.ctx) : 'What would you like me to change?';
    return asBot({}, \`Sorry about that, I shouldn't have assumed. \${recap} Tell me what's wrong and I'll fix it, or answer this: \${again.charAt(0).toLowerCase()}\${again.slice(1)}\`);
  }

  // "renting" could mean a tenant or a landlord, and the price differs.
  if (state.lastBotTopic?.id === 'property_ownership' && isAmbiguousRenting(trimmed)) {
    return asBot({}, 'Just so I price it right: do you rent this place from someone (you are the tenant), or are you renting it out to tenants (you own it)?');
  }

  const ctxWithExplicit: EstimatorContext = { ...state.ctx, ...patch };

  // A reading of the message that isn't supported by anything the customer actually said gets undone, not priced.
  const surfaceWords = /(wall|ceiling|trim|baseboard|door|everything|whole|entire|full|all of it|the works|window|cabinet|stair|rail|molding|moulding)/i;
  if (!state.ctx.surfacesAddressed && ctxWithExplicit.surfacesAddressed && !surfaceWords.test(trimmed) && state.lastBotTopic?.id !== 'surfaces') {
    ctxWithExplicit.surfacesAddressed = false;
    ctxWithExplicit.interiorWalls = state.ctx.interiorWalls;
    ctxWithExplicit.interiorCeilings = state.ctx.interiorCeilings;
    ctxWithExplicit.interiorTrim = state.ctx.interiorTrim;
    ctxWithExplicit.interiorDoors = state.ctx.interiorDoors;
  }
  if (state.ctx.exteriorColorChange !== 'different' && ctxWithExplicit.exteriorColorChange === 'different' && !/(exterior|outside|siding|stucco|brick|house color|front|fence|deck|shutter|fascia)/i.test(trimmed)) {
    ctxWithExplicit.exteriorColorChange = state.ctx.exteriorColorChange;
  }
`],
  // the unanswered-topic gate, before "6. ready to quote"
  ["  // 6. If we're ready to quote and we already asked the wrap-up, finalize",
   `  // A reply that matched nothing and doesn't answer the question: ask what they meant (once per topic) with what we
  // understood so far, instead of assuming something or skipping ahead.
  {
    const topic = s.lastBotTopic;
    const clarified = s.clarifiedIds ?? [];
    const ignoredKeys = new Set(['answeredQuestions', 'responseStyle', 'responseLengths', 'photoRequests']);
    const changed = (Object.keys(ctxNext) as Array<keyof EstimatorContext>).some(
      (k) => !ignoredKeys.has(k) && JSON.stringify(ctxNext[k]) !== JSON.stringify(state.ctx[k]),
    );
    const plainReply = /^(yes|yeah|yep|yup|no|nope|nah|ok|okay|sure|fine|maybe|idk|not sure|skip)\\b[.!]?$/i.test(trimmed);
    if (
      topic &&
      !topic.alreadyAnswered(ctxNext) &&
      !changed &&
      !clarified.includes(topic.id) &&
      !trimmed.endsWith('?') &&
      !plainReply &&
      trimmed.split(/\\s+/).length >= 2 &&
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
            \`I'm not sure how that answers my question about \${topicLabel(topic.id)}, and I'd rather ask than guess. \${recapSentence(recentRecognized(state.history))} \${q} If something above is wrong, just tell me what to change.\`.replace(/\\s{2,}/g, ' '),
          ),
        ],
      };
      return { state: s, done: null };
    }
  }

  // 6. If we're ready to quote and we already asked the wrap-up, finalize`],
]);

// the trim question only makes sense once the customer has said what's being painted
patch('src/lib/chatEstimator/topics.ts', [
  ["    relevant: (c) => (c.projectType === 'interior' || c.projectType === 'both') && c.interiorTrim === 'yes',\n    alreadyAnswered: (c) => c.trimScopeAddressed",
   "    relevant: (c) => (c.projectType === 'interior' || c.projectType === 'both') && c.interiorTrim === 'yes' && (c.surfacesAddressed || c.trimLinearFeet != null || c.crownMolding === 'yes'),\n    alreadyAnswered: (c) => c.trimScopeAddressed"],
]);

// removing the house body also removes the washing that was only assumed to go with it
patch('src/lib/estimateEngine.ts', [
  ["  if (ctx.prepWork.includes('power_washing') && !off('power_washing')) {",
   "  // (the power wash that is assumed before painting goes away with the siding; a wash-only job keeps it)\n  const washGoesWithBody = off('ext_body') && ctx.exteriorBody !== 'no' && !ctx.pressureWashSqft;\n  if (ctx.prepWork.includes('power_washing') && !off('power_washing') && !washGoesWithBody) {"],
]);
console.log('ok');
