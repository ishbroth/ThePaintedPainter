const fs = require('fs');
function load(f) {
  const t = fs.readFileSync(f, 'utf8');
  return { crlf: t.includes('\r\n'), t: t.split('\r\n').join('\n') };
}
function save(f, o) {
  fs.writeFileSync(f, o.crlf ? o.t.split('\n').join('\r\n') : o.t);
}
function rep(o, a, b, label) {
  if (!o.t.includes(a)) throw new Error('NF ' + (label || a.slice(0, 70)));
  o.t = o.t.replace(a, () => b);
}

// ---- voice: only questions get their options trimmed; statements (the price and what's included) are read in full
{
  const o = load('src/lib/textToSpeech.ts');
  o.t = o.t.split("splitPrompt(text).spoken").join("forVoice(text)");
  rep(o, "/** Phones and tablets (a touch screen as the main pointer). */", "/** What is said aloud: a question is trimmed to just the question (its options go in the typing box); anything else is read in full. */\nfunction forVoice(text: string): string {\n  return text.includes('?') ? splitPrompt(text).spoken : text;\n}\n\n/** Phones and tablets (a touch screen as the main pointer). */");
  save('src/lib/textToSpeech.ts', o);
}

// ---- panel
{
  const o = load('src/components/ChatEstimator/ChatPanel.tsx');
  rep(o, "import { isTTSSupported, speak, stopSpeaking, setupSpeechUnlock } from '../../lib/textToSpeech';", "import { isTTSSupported, speak, stopSpeaking, setupSpeechUnlock, prefetchSpeech, waitForSpeechEnd } from '../../lib/textToSpeech';");
  const a = o.t.indexOf("  useEffect(() => {\n    // When the conversation completes, route to the results page");
  const b = o.t.indexOf("  function startNewEstimate() {");
  if (a < 0 || b < 0) throw new Error('nav effect');
  o.t = o.t.slice(0, a) + `  // The price is shown here first. The page where the painters are picked comes after the voice has finished reading it (a moment
  // longer than that if nothing is being spoken), unless the customer taps "View painters" sooner.
  const pendingNavRef = useRef<ChatState['finalEstimate']>(null);
  const finalPayloadRef = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    // When the conversation completes, route to the results page, but only for a FRESH completion, never for one restored
    // already-done from a prior visit (see restoredAlreadyFinishedRef above).
    const estimate = state.finalEstimate;
    if (!estimate || restoredAlreadyFinishedRef.current || pendingNavRef.current === estimate) return;
    pendingNavRef.current = estimate;
    const payload = {
      estimate: estimate.estimate,
      ctx: estimate.ctx,
      assumptions: estimate.assumptions,
      matchedSituations: estimate.matchedSituations,
      transcript: state.transcript,
      loyaltyDiscountPercent: estimate.loyaltyDiscountPercent ?? 0,
      // every reply the customer typed, in order; it goes to painters with the job
      userMessages: state.history.filter((m) => m.role === 'user').map((m) => m.text),
    };
    // Always a fresh hold window here: this whole block only runs for a genuinely NEW completion, never for returning to an
    // already-computed price, so there's no old timer that's actually still valid to reuse.
    let navState: Record<string, unknown> = payload;
    try {
      const expiresAt = Date.now() + PRICE_HOLD_MINUTES * 60 * 1000;
      sessionStorage.setItem(QUOTE_EXPIRES_KEY, String(expiresAt));
      sessionStorage.setItem(QUOTE_RESULT_KEY, JSON.stringify({ ...payload, expiresAt }));
      navState = { ...payload, expiresAt };
    } catch {
      // storage unavailable: the page still gets the price through navigation state
    }
    finalPayloadRef.current = navState;
    void (async () => {
      await new Promise((r) => window.setTimeout(r, 1500));
      if (readAloudRef.current && ttsSupported) await waitForSpeechEnd();
      if (pendingNavRef.current === estimate) navigate('/quote-results', { state: navState });
    })();
  }, [state.finalEstimate, state.transcript, state.history, ttsSupported, navigate]);

  function viewPainters() {
    stopSpeaking();
    pendingNavRef.current = null;
    if (finalPayloadRef.current) navigate('/quote-results', { state: finalPayloadRef.current });
    else navigate('/quote-results');
  }

` + o.t.slice(b);
  rep(o, "  function startNewEstimate() {\n    stopSpeaking();", "  function startNewEstimate() {\n    stopSpeaking();\n    pendingNavRef.current = null;\n    finalPayloadRef.current = null;");
  rep(o, "            {restoredAlreadyFinishedRef.current && (\n              <button type=\"button\" className=\"chat-action-button chat-action-primary\" onClick={() => navigate('/quote-results')}>\n                View My Price\n              </button>\n            )}", "            <button type=\"button\" className=\"chat-action-button chat-action-primary\" onClick={viewPainters}>\n              View painters\n            </button>");
  rep(o, "                <span>Preparing your results…</span>", "                <span>Getting your painters ready…</span>");
  // greeting audio is fetched ahead of time on phones, so the tap can play it instantly
  rep(o, "  useEffect(() => {\n    // Auto-read the intro when the estimator card scrolls", "  useEffect(() => {\n    if (isFreshRef.current && ttsSupported) prefetchSpeech(state.history[0].text);\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, []);\n\n  useEffect(() => {\n    // Auto-read the intro when the estimator card scrolls");
  save('src/components/ChatEstimator/ChatPanel.tsx', o);
}
console.log('ok');
