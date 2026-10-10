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

// ---------------------------------------------------------------------------
// When the conversation is kept and when it starts over
//  - moving around the site, or back to the home page: kept (nothing reloads)
//  - closing the browser or tab by accident: kept; a copy of the conversation is mirrored to localStorage as the page goes away
//    and restored when the site is opened again within a few hours
//  - reloading the home page (a refresh or a hard refresh): starts over, and a signed-in customer's saved copy is dropped too
// ---------------------------------------------------------------------------
const MIRROR_KEY = 'ttp_chat_mirror';
const MIRROR_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const MIRRORED_KEYS = [CHAT_STATE_KEY, QUOTE_RESULT_KEY, QUOTE_EXPIRES_KEY, WORK_WITH_KEY];

/** True when this page load is a refresh of the home page (so the estimator starts over). */
export const startedFromHomeReload: boolean = (() => {
  try {
    if (typeof window === 'undefined' || window.location.pathname !== '/') return false;
    const nav = performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === 'reload';
  } catch {
    return false;
  }
})();

function mirrorToLocal(): void {
  try {
    const items: Record<string, string> = {};
    for (const key of MIRRORED_KEYS) {
      const value = sessionStorage.getItem(key);
      if (value !== null) items[key] = value;
    }
    if (Object.keys(items).length === 0) localStorage.removeItem(MIRROR_KEY);
    else localStorage.setItem(MIRROR_KEY, JSON.stringify({ savedAt: Date.now(), items }));
  } catch {
    // storage full or unavailable: the mirror is a nicety
  }
}

(function initPersistence() {
  if (typeof window === 'undefined') return;
  try {
    if (startedFromHomeReload) {
      for (const key of MIRRORED_KEYS) sessionStorage.removeItem(key);
      localStorage.removeItem(MIRROR_KEY);
    } else if (sessionStorage.getItem(CHAT_STATE_KEY) === null) {
      // a fresh browser session (the browser was closed and reopened): bring back what was mirrored, if it is recent
      const raw = localStorage.getItem(MIRROR_KEY);
      const mirror = raw ? (JSON.parse(raw) as { savedAt?: number; items?: Record<string, string> }) : null;
      if (mirror?.items && typeof mirror.savedAt === 'number' && Date.now() - mirror.savedAt < MIRROR_MAX_AGE_MS) {
        for (const [key, value] of Object.entries(mirror.items)) {
          if (MIRRORED_KEYS.includes(key) && sessionStorage.getItem(key) === null) sessionStorage.setItem(key, value);
        }
      }
    }
  } catch {
    // ignore
  }
  window.addEventListener('pagehide', mirrorToLocal);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') mirrorToLocal();
  });
})();

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
