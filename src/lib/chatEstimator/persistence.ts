// Shared sessionStorage keys so an in-progress conversation or a finished
// quote survives a browser back/forward navigation or reload within the
// same tab (cleared when the tab closes, which fits the time-limited
// "guaranteed price" hold window — we don't want a stale quote to persist
// forever across unrelated future visits).

export const CHAT_STATE_KEY = 'ttp_chat_estimator_state';
export const QUOTE_RESULT_KEY = 'ttp_quote_result';
export const QUOTE_EXPIRES_KEY = 'ttp_quote_expires_at';
/** Set by "Work with again" on a finished project; the estimator reads it once and starts a conversation for that painter. */
export const WORK_WITH_KEY = 'ttp_work_with_again';

export interface WorkWithAgain {
  id: string;
  companyName: string;
  zip: string;
}

export function readWorkWithAgain(): WorkWithAgain | null {
  try {
    const raw = sessionStorage.getItem(WORK_WITH_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<WorkWithAgain>;
    return v && typeof v.id === 'string' && v.id && typeof v.companyName === 'string' ? { id: v.id, companyName: v.companyName, zip: String(v.zip ?? '') } : null;
  } catch {
    return null;
  }
}

export function clearWorkWithAgain(): void {
  try {
    sessionStorage.removeItem(WORK_WITH_KEY);
  } catch {
    // ignore
  }
}

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
