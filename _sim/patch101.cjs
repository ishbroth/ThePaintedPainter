const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 70)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}

patch('src/lib/types.ts', [
  ["  surfacesAddressed: boolean;", "  surfacesAddressed: boolean;\n  /** Surfaces the customer ruled out in so many words (\"no ceilings\"), which the estimator never suggests adding back. */\n  excludedSurfaces?: string[];"],
]);

patch('src/lib/chatEstimator/topics.ts', [
  // the new question
  ["            `In that ${label}, what all are we painting?`,\n            `For the ${label}, are we painting just the walls, or more than that?`,", "            'What in the room are we painting?',\n            'What in the room are we painting?',"],
  ["          \"What all are we painting in those rooms?\",\n          \"For those rooms, are we painting just the walls, or more than that?\",\n          \"How much of each room are we painting?\",", "          'What in the room are we painting?',\n          'What in the room are we painting?',\n          'What in the room are we painting?',"],
  // upsell topics, right before the trim scope topic
  ["  // ——————————————————————————————————————————\n  // Trim scope", `  // ——————————————————————————————————————————
  // Building up the job: if only some surfaces were named ("just walls"), suggest the rest one at a time (ceilings, then
  // baseboards, then doors) the way a good salesperson would, each only once, and never one the customer ruled out.
  // ——————————————————————————————————————————
  {
    id: 'upsell_ceilings',
    priority: 27,
    relevant: (c) => (c.projectType === 'interior' || c.projectType === 'both') && c.surfacesAddressed && c.interiorCeilings === 'no' && !(c.excludedSurfaces ?? []).includes('ceilings'),
    alreadyAnswered: (c) => c.interiorCeilings !== 'no',
    ask: (c) =>
      pick(
        [
          "Want me to add the ceilings too? Fresh ceilings make fresh walls look even better.",
          "Should we include the ceilings? They're easy to do while we're already painting the walls.",
        ],
        seed(c),
      ),
    clarify: () => "I mean painting the ceilings in those rooms along with the walls. It's quick to add while the crew is already there.",
    example: () => "Just say 'yes, add the ceilings' or 'no, leave the ceilings'.",
  },
  {
    id: 'upsell_trim',
    priority: 28,
    relevant: (c) => (c.projectType === 'interior' || c.projectType === 'both') && c.surfacesAddressed && c.interiorTrim === 'no' && !(c.excludedSurfaces ?? []).includes('trim'),
    alreadyAnswered: (c) => c.interiorTrim !== 'no',
    ask: (c) =>
      pick(
        [
          "How about the baseboards? Crisp, clean baseboards give the whole room a finished look.",
          "What about the baseboards? Fresh ones frame the new wall color nicely.",
        ],
        seed(c),
      ),
    clarify: () => "Baseboards are the trim along the bottom of the walls. Painting them along with the walls gives a cleaner, finished result.",
    example: () => "Just say 'yes, the baseboards too' or 'no, leave them'.",
  },
  {
    id: 'upsell_doors',
    priority: 29,
    relevant: (c) => (c.projectType === 'interior' || c.projectType === 'both') && c.surfacesAddressed && c.interiorDoors === 'none' && !(c.excludedSurfaces ?? []).includes('doors'),
    alreadyAnswered: (c) => c.interiorDoors !== 'none',
    ask: (c) =>
      pick(
        [
          "And the doors? Freshly painted doors tie the whole room together.",
          "Would you like the doors done too? It's the finishing touch that makes a room look new.",
        ],
        seed(c),
      ),
    clarify: () => "I mean the interior doors in those rooms. Painting them at the same time as everything else keeps the whole space looking consistent.",
    example: () => "Just say 'yes, do the doors' or 'no, skip the doors'.",
  },

  // ——————————————————————————————————————————
  // Trim scope`],
]);

patch('src/lib/chatEstimator/promptHints.ts', [
  ["  surfaces: 'Which surfaces get painted?',", "  surfaces: 'Which surfaces?',\n  upsell_ceilings: 'Add the ceilings?',\n  upsell_trim: 'Add the baseboards?',\n  upsell_doors: 'Add the doors?',"],
]);

patch('src/lib/chatEstimator/clarify.ts', [
  ["  surfaces: 'what gets painted (walls, ceilings, trim, doors)',", "  surfaces: 'what gets painted (walls, ceilings, trim, doors)',\n  upsell_ceilings: 'whether to add the ceilings',\n  upsell_trim: 'whether to add the baseboards',\n  upsell_doors: 'whether to add the doors',"],
]);

patch('src/lib/chatEstimator/chatEngine.ts', [
  ["  if (state.ctx.exteriorColorChange !== 'different' && ctxWithExplicit.exteriorColorChange === 'different'", `  // Surfaces the customer rules out in so many words ("no ceilings", "without the doors") are never suggested back to them.
  {
    const low = trimmed.toLowerCase();
    const ruledOut = new Set(state.ctx.excludedSurfaces ?? []);
    const re = /\\b(?:no|not|without|skip|except|excluding|leave out|don'?t (?:paint|do|need|want))\\s+(?:the\\s+|any\\s+|our\\s+)?(ceilings?|trim|baseboards?|doors?)\\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(low))) ruledOut.add(m[1].startsWith('ceiling') ? 'ceilings' : m[1].startsWith('door') ? 'doors' : 'trim');
    // the answer to a suggestion ("Want me to add the ceilings too?"): yes adds it, no leaves it out, whatever else was read into the reply
    const offer: Record<string, { field: 'interiorCeilings' | 'interiorTrim' | 'interiorDoors'; on: string; word: RegExp; key: string }> = {
      upsell_ceilings: { field: 'interiorCeilings', on: 'yes', word: /\\bceilings?\\b/, key: 'ceilings' },
      upsell_trim: { field: 'interiorTrim', on: 'yes', word: /\\b(?:baseboards?|trim|molding)\\b/, key: 'trim' },
      upsell_doors: { field: 'interiorDoors', on: 'some', word: /\\bdoors?\\b/, key: 'doors' },
    };
    const asked = state.lastBotTopic ? offer[state.lastBotTopic.id] : undefined;
    if (asked) {
      const yes = /^\\s*(?:yes|yeah|yep|yup|sure|ok|okay|please|definitely|absolutely|why not|sounds good|do it|add (?:it|them)|go ahead|let'?s do it|that'?d be (?:great|good|nice)|i guess|fine|of course|love to)\\b/.test(low);
      const no = /^\\s*(?:no|nope|nah|not (?:now|needed|really|this time)|skip|pass|leave (?:it|them)|that'?s (?:ok|okay|fine|alright)|no thanks|no thank you|i'?m good)\\b/.test(low);
      const target = ctxWithExplicit as unknown as Record<string, unknown>;
      if (yes && !no) {
        target[asked.field] = asked.on;
        if (asked.field === 'interiorTrim') ctxWithExplicit.trimScopeAddressed = true;
      } else if (no) {
        target[asked.field] = state.ctx[asked.field];
        ruledOut.add(asked.key);
      }
    }
    // "yes, and the doors too": any other surface named as something to add comes along
    if (asked && !/^\\s*(?:no|nope|nah)\\b/.test(low)) {
      for (const o of Object.values(offer)) {
        if (o.word.test(low) && !ruledOut.has(o.key)) {
          (ctxWithExplicit as unknown as Record<string, unknown>)[o.field] = o.on;
          if (o.field === 'interiorTrim') ctxWithExplicit.trimScopeAddressed = true;
        }
      }
    }
    if (ruledOut.size > 0) ctxWithExplicit.excludedSurfaces = [...ruledOut];
  }
  if (state.ctx.exteriorColorChange !== 'different' && ctxWithExplicit.exteriorColorChange === 'different'`],
]);
console.log('ok');
