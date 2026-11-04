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
  ["  if (hasIntent(intent, 'ready_to_finish')) {\n    if (readyToQuote(ctxNext)) {\n      return await finalizeTurn(s, customerId);\n    }",
   `  // The price is only run when the customer clearly asks for it ("run it", "give me the price", "that's all") or after the
  // wrap-up question. A reply that merely sounds finished to the language model ("ready to go" about the walls) isn't a request.
  const explicitRunIt = /\\b(run it|run the numbers?|price it(?: out)?|give me (?:the|a) (?:price|number)|show me (?:the )?(?:price|number)|get (?:me )?(?:the )?price|go ahead|that'?s (?:all|it|everything)|i'?m done|nothing else|finish it)\\b/i.test(trimmed);
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
    } else {`],
  ["    const missing = whatsMissing(ctxNext);\n    s = {\n      ...s,\n      history: [\n        ...s.history,\n        botMessage(`Before I run the numbers I need one more thing: ${missing}`),\n      ],\n    };\n  } else {",
   "    const missing = whatsMissing(ctxNext);\n    s = {\n      ...s,\n      history: [\n        ...s.history,\n        botMessage(`Before I run the numbers I need one more thing: ${missing}`),\n      ],\n    };\n    }\n  } else {"],
]);

patch('supabase/functions/chat-estimator-extract/index.ts', [
  ["- Never set surfacesAddressed, a surface to excluded,", "- \"ready_to_finish\" is ONLY for a clear request for the price (\"run it\", \"give me the price\", \"that's all\", \"I'm done\"). Words like \"ready to go\", \"ready\", \"good to go\" or \"all set\" describing the condition of the walls or the property (\"ready to go\" in answer to \"how are the walls?\") are an ANSWER to the question, never ready_to_finish.\n- Never set surfacesAddressed, a surface to excluded,"],
]);
console.log('ok');
