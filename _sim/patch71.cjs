const fs = require('fs');
function patch(file, edits) {
  let t = fs.readFileSync(file, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 80));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/lib/chatEstimator/chatEngine.ts', [
  ["import { hasScopeLimiter } from './scopeWords';", "import { hasScopeLimiter } from './scopeWords';\nimport { reviewLocally, reviewWithAI, hasPaintingScope, retryMessage, type ReviewResult } from './conversationReview';"],
  ["async function finalizeTurn(state: ChatState, customerId?: string): Promise<TurnResult> {\n  const loyaltyDiscountPercent = customerId ? await fetchLoyaltyDiscountPercent(customerId) : 0;\n  const result = finalize(state.ctx, state.transcript, loyaltyDiscountPercent);",
   `/** A clean start with an explanation: nothing from the blocked conversation is priced or sent to anyone. */
function restartAfterReview(reason: ReviewResult['reason']): TurnResult {
  const fresh = makeInitialState();
  return { state: { ...fresh, history: [{ role: 'bot', text: retryMessage(reason), timestamp: Date.now() }] }, done: null };
}

async function finalizeTurn(state: ChatState, customerId?: string): Promise<TurnResult> {
  // Review the whole conversation before any price goes out: profanity, "I don't need anything painted", answers that make no
  // sense, or nothing that adds up to a job all stop here with a "can we try that again?".
  const userTurns = state.history.filter((m) => m.role === 'user');
  let verdict = reviewLocally(userTurns.map((m) => ({ text: m.text, recognized: !!(m.ackChips && m.ackChips.length > 0) })));
  if (verdict.ok) {
    const ai = await reviewWithAI(userTurns.map((m) => m.text));
    if (ai && !ai.ok) verdict = ai;
  }
  if (!verdict.ok) return restartAfterReview(verdict.reason);

  const loyaltyDiscountPercent = customerId ? await fetchLoyaltyDiscountPercent(customerId) : 0;
  const result = finalize(state.ctx, state.transcript, loyaltyDiscountPercent);
  if (!hasPaintingScope(result.estimate.lineItems)) return restartAfterReview('no_project');`],
]);
console.log('ok');
