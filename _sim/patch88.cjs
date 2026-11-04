const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 60)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/lib/chatEstimator/extractors.ts', [
  ["    if (/\\b(everything|all of it|the works|full (?:package|scope)|the whole (?:thing|room)|the usual|standard)\\b/.test(low)) {", "    if (/\\b(everything|all of it|the works|full (?:package|scope)|(?:the )?whole (?:thing|room|place|apartment|house|home|unit|space)|the usual|standard)\\b/.test(low)) {"],
  ["  if (surf.everything) acks.push('whole room');", "  if (surf.everything) {\n    acks.push('whole room');\n    // \"the whole room\" is the full package, trim and doors included, which the estimator reads back to the customer; no separate trim question\n    patch.trimScopeAddressed = true;\n  }"],
]);
patch('src/lib/chatEstimator/chatEngine.ts', [
  ["  const ackLeadIn = acknowledgements.length > 0\n    ? `${ACK_LEAD_INS[s.askedIds.length % ACK_LEAD_INS.length]} ${acknowledgements.join(', ')}. `\n    : '';",
   "  // \"The whole room\" / \"the whole place\" / \"everything\" as the answer to what gets painted: read back what that covers, so the\n  // customer can correct it, instead of moving on as if only a word had been said.\n  const fullScopeAnswer =\n    state.lastBotTopic?.id === 'surfaces' &&\n    /\\b(everything|all of it|the works|full (?:package|scope)|(?:the )?whole (?:thing|room|place|apartment|house|home|unit|space))\\b/i.test(trimmed) &&\n    ctxNext.surfacesAddressed &&\n    ctxNext.interiorWalls !== 'no' && ctxNext.interiorCeilings !== 'no' && ctxNext.interiorTrim !== 'no' && ctxNext.interiorDoors !== 'none';\n  const ackLeadIn = fullScopeAnswer\n    ? 'Got it, so the walls, ceilings, trim and doors, correct? '\n    : acknowledgements.length > 0\n    ? `${ACK_LEAD_INS[s.askedIds.length % ACK_LEAD_INS.length]} ${acknowledgements.join(', ')}. `\n    : '';"],
]);
console.log('patched');
