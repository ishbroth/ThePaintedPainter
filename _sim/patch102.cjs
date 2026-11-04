const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 70)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}

patch('src/lib/promptHints.ts', [
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
