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

patch('src/lib/chatEstimator/persistence.ts', [
  ["export const PRICE_HOLD_MINUTES = 45;", `export const PRICE_HOLD_MINUTES = 45;

/** Forget everything about the current estimate in this tab (the chat, the price on screen, and its countdown). */
export function clearEstimatorSession(): void {
  try {
    sessionStorage.removeItem(CHAT_STATE_KEY);
    sessionStorage.removeItem(QUOTE_RESULT_KEY);
    sessionStorage.removeItem(QUOTE_EXPIRES_KEY);
  } catch {
    // storage unavailable: nothing to clear
  }
}

/**
 * A finished estimate whose price hold has run out. The estimator should start fresh instead of showing it:
 * the chat is only kept (read-only) while the price can still be claimed.
 */
export function isExpiredFinishedChat(state: { finalEstimate: unknown; history: { timestamp: number }[] }): boolean {
  if (!state.finalEstimate) return false;
  let expiresAt = NaN;
  try {
    expiresAt = parseInt(sessionStorage.getItem(QUOTE_EXPIRES_KEY) ?? '', 10);
  } catch {
    // ignore
  }
  if (!isFinite(expiresAt)) {
    const last = state.history[state.history.length - 1]?.timestamp ?? 0;
    expiresAt = last + PRICE_HOLD_MINUTES * 60 * 1000;
  }
  return Date.now() >= expiresAt;
}`],
]);

patch('src/lib/chatEstimator/accountPersistence.ts', [
  ["/** Best-effort — a failed save", "/** Best-effort — removes the signed-in customer's saved estimate so the next visit starts fresh. */\nexport async function deleteAccountChatState(userId: string): Promise<void> {\n  try {\n    await supabase.from(TABLE).delete().eq('user_id', userId);\n  } catch {\n    // ignore — non-critical\n  }\n}\n\n/** Best-effort — a failed save"],
]);

patch('src/pages/QuoteResults.tsx', [
  ["import { QUOTE_RESULT_KEY, QUOTE_EXPIRES_KEY, PRICE_HOLD_MINUTES } from '../lib/chatEstimator/persistence';", "import { QUOTE_RESULT_KEY, QUOTE_EXPIRES_KEY, PRICE_HOLD_MINUTES, clearEstimatorSession } from '../lib/chatEstimator/persistence';\nimport { deleteAccountChatState } from '../lib/chatEstimator/accountPersistence';"],
  ["              onClick={() => {\n                hapticMedium();\n                navigate('/');\n              }}", "              onClick={() => {\n                hapticMedium();\n                // an expired price means a brand-new estimate: forget the old chat, here and on the account\n                clearEstimatorSession();\n                if (authUser) void deleteAccountChatState(authUser.id);\n                navigate('/');\n              }}"],
  ["  const navigate = useNavigate();\n  const state = loadState(", "  const navigate = useNavigate();\n  const { user: authUser } = useAuth();\n  const state = loadState("],
]);

patch('src/components/ChatEstimator/ChatPanel.tsx', [
  ["import { CHAT_STATE_KEY, QUOTE_EXPIRES_KEY, QUOTE_RESULT_KEY, PRICE_HOLD_MINUTES } from '../../lib/chatEstimator/persistence';", "import { CHAT_STATE_KEY, QUOTE_EXPIRES_KEY, QUOTE_RESULT_KEY, PRICE_HOLD_MINUTES, clearEstimatorSession, isExpiredFinishedChat } from '../../lib/chatEstimator/persistence';"],
  ["      const restored = deserializeChatState(saved);\n      if (restored) return restored;", "      const restored = deserializeChatState(saved);\n      // a finished price whose countdown ran out is not shown again: start a new estimate\n      if (restored && isExpiredFinishedChat(restored)) {\n        clearEstimatorSession();\n        return makeInitialState();\n      }\n      if (restored) return restored;"],
  ["          if (current.history.length > 1 || current.finalEstimate) return current;", "          if (current.history.length > 1 || current.finalEstimate) return current;\n          // a saved price that has expired is dropped, not restored\n          if (isExpiredFinishedChat(saved)) {\n            void deleteAccountChatState(user.id);\n            return current;\n          }"],
  ["import { loadAccountChatState, saveAccountChatState } from '../../lib/chatEstimator/accountPersistence';", "import { loadAccountChatState, saveAccountChatState, deleteAccountChatState } from '../../lib/chatEstimator/accountPersistence';"],
]);
console.log('ok');
