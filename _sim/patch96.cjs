const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 70)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/lib/chatEstimator/persistence.ts', [
  ["/** Forget everything about the current estimate in this tab", `// ---------------------------------------------------------------------------
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

/** Forget everything about the current estimate in this tab`],
]);
patch('src/components/ChatEstimator/ChatPanel.tsx', [
  ["import { CHAT_STATE_KEY, QUOTE_EXPIRES_KEY, QUOTE_RESULT_KEY, PRICE_HOLD_MINUTES, clearEstimatorSession,", "import { CHAT_STATE_KEY, QUOTE_EXPIRES_KEY, QUOTE_RESULT_KEY, PRICE_HOLD_MINUTES, startedFromHomeReload, clearEstimatorSession,"],
  ["    loadAccountChatState(user.id).then((saved) => {", "    // a refresh of the home page starts over: the saved copy of this customer's conversation goes too\n    if (startedFromHomeReload) {\n      void deleteAccountChatState(user.id);\n      accountLoadCompleteRef.current = true;\n      return;\n    }\n    loadAccountChatState(user.id).then((saved) => {"],
]);
console.log('ok');
