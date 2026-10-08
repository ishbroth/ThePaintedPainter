// Shared sessionStorage keys so an in-progress conversation or a finished
// quote survives a browser back/forward navigation or reload within the
// same tab (cleared when the tab closes, which fits the time-limited
// "guaranteed price" hold window — we don't want a stale quote to persist
// forever across unrelated future visits).

export const CHAT_STATE_KEY = 'ttp_chat_estimator_state';
export const QUOTE_RESULT_KEY = 'ttp_quote_result';
export const QUOTE_EXPIRES_KEY = 'ttp_quote_expires_at';

/** How long a guaranteed price stays locked in before the customer needs a fresh quote. */
export const PRICE_HOLD_MINUTES = 45;

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
}
