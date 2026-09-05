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
