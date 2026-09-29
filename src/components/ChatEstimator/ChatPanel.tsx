import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  makeInitialState,
  handleUserMessage,
  applyUploadedPhoto,
  applyPhotoAssessment,
  serializeChatState,
  deserializeChatState,
  type ChatState,
} from '../../lib/chatEstimator/chatEngine';
import { hapticLight } from '../../lib/haptics';
import { CHAT_STATE_KEY, QUOTE_EXPIRES_KEY, QUOTE_RESULT_KEY, PRICE_HOLD_MINUTES } from '../../lib/chatEstimator/persistence';
import { isTTSSupported, speak, stopSpeaking } from '../../lib/textToSpeech';
import { uploadQuotePhoto, analyzeQuotePhoto } from '../../lib/chatEstimator/photoUpload';
import { loadAccountChatState, saveAccountChatState } from '../../lib/chatEstimator/accountPersistence';
import { useAuth } from '../../lib/auth';

const READ_ALOUD_KEY = 'tpp-read-aloud';

function loadInitialState(): ChatState {
  try {
    const saved = sessionStorage.getItem(CHAT_STATE_KEY);
    if (saved) {
      const restored = deserializeChatState(saved);
      if (restored) return restored;
    }
  } catch {
    // Corrupt/unavailable storage — fall through to a fresh conversation.
  }
  return makeInitialState();
}

const ChatPanel = () => {
  const { user } = useAuth();
  const [state, setState] = useState<ChatState>(loadInitialState);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [readAloud, setReadAloud] = useState(() => {
    try {
      const saved = localStorage.getItem(READ_ALOUD_KEY);
      // On by default — a saved 'false' (explicit mute) is honored, but no
      // saved preference at all means a first-time visitor, who gets it on.
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [pendingPhotoRequest, setPendingPhotoRequest] = useState<{ id: string; label: string } | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoPreviewUrl, setPendingPhotoPreviewUrl] = useState<string | null>(null);
  const [photoDescription, setPhotoDescription] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const ttsSupported = isTTSSupported();
  // Skip anything already in history at mount (restored conversations, or
  // the initial greeting) — only speak messages that arrive from here on,
  // so turning read-aloud on doesn't unexpectedly narrate the whole past
  // conversation, and the first speak() call is always tied to a fresh
  // message rather than firing on page load before any user gesture.
  const lastSpokenIndexRef = useRef(state.history.length);
  // True when the conversation was ALREADY finished before this component
  // even mounted (restored from storage) — e.g. the user hit back from
  // quote-results. In that case we must NOT auto-bounce them straight back
  // to quote-results; that's what made the homepage feel like it "forwards"
  // to the old quote instead of actually showing the homepage.
  const restoredAlreadyFinishedRef = useRef(state.finalEstimate !== null);
  // Whether this is still a brand-new, untouched conversation at mount —
  // decides whether scrolling to the estimator should read the intro aloud
  // at all (a restored, already-progressed conversation shouldn't have its
  // first message replayed just because the user scrolled past it).
  const isFreshRef = useRef(state.history.length === 1 && !state.finalEstimate);
  // Only auto-play once per page load from the passive scroll-into-view
  // trigger, so scrolling up and down past the estimator repeatedly
  // doesn't repeatedly trigger audio. The explicit "Get Estimate" header
  // link (handled separately below) intentionally bypasses this.
  const hasAutoPlayedRef = useRef(false);
  // Tracks the last navigation (by React Router's location.key) already
  // handled by the "/#estimator" effect below — see that effect for why.
  const processedHashRef = useRef<string | null>(null);
  const readAloudRef = useRef(readAloud);
  useEffect(() => {
    readAloudRef.current = readAloud;
  }, [readAloud]);

  // Speaks the intro greeting once, if read-aloud is on and this is still a
  // fresh conversation. Read through a ref (see below) so callers created
  // once in an effect (the IntersectionObserver) always see the current
  // function rather than a stale closure from mount.
  function playIntroIfFresh() {
    if (hasAutoPlayedRef.current || !isFreshRef.current) return;
    if (!readAloudRef.current || !ttsSupported) return;
    hasAutoPlayedRef.current = true;
    speak(state.history[0].text);
  }
  const playIntroIfFreshRef = useRef(playIntroIfFresh);
  playIntroIfFreshRef.current = playIntroIfFresh;

  useEffect(() => {
    // Auto-read the intro when the estimator card scrolls to the vertical
    // center of the viewport — rootMargin shrinks the observer's root to a
    // zero-height line at that center, so isIntersecting flips true exactly
    // when the card crosses it.
    const el = sectionRef.current;
    if (!el || !ttsSupported) return;
    // IntersectionObserver always reports the element's CURRENT state as
    // soon as observe() is called, even with no scroll at all — on a short
    // viewport (most phones) the card already overlaps the center band on
    // first paint, so this fired before the user had scrolled or done
    // anything at all. Only a callback caused by an actual crossing (i.e.
    // every invocation after the first) should count as "the user scrolled
    // to it".
    let isInitialReport = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (isInitialReport) {
          isInitialReport = false;
          return;
        }
        if (entry.isIntersecting) playIntroIfFreshRef.current();
      },
      { rootMargin: '-50% 0px -50% 0px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ttsSupported]);

  useEffect(() => {
    // The header's "Get Estimate" link points at "/#estimator" — jump down
    // to center the card and read the intro, whether arriving fresh or
    // already on the homepage (a same-path hash change doesn't remount
    // this component, so this has to be its own effect on location.hash
    // rather than mount-only logic).
    //
    // Two things that look redundant but each fix a real bug found while
    // testing this:
    //  - processedHashRef guards against StrictMode's dev-mode double
    //    effect invocation, which otherwise spoke the intro twice on a
    //    single click (both invocations see the same still-unprocessed
    //    hash before either has a chance to clear it).
    //  - clearing the hash via navigate() (React Router's own history),
    //    not a raw window.history.replaceState call — the latter changes
    //    the URL bar but not React Router's internal location, so a
    //    second click on the exact same "/#estimator" link was never
    //    seen as a change at all and silently did nothing.
    if (location.hash === '#estimator' && processedHashRef.current !== location.key) {
      processedHashRef.current = location.key;
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      hasAutoPlayedRef.current = true;
      if (readAloudRef.current && ttsSupported) {
        const lastBotMessage = [...state.history].reverse().find((m) => m.role === 'bot');
        if (lastBotMessage) speak(lastBotMessage.text);
      }
      navigate(location.pathname + location.search, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash, location.key]);

  useEffect(() => {
    // Auto-scroll the message list as new messages arrive
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [state.history.length]);

  useEffect(() => {
    if (readAloud && ttsSupported) {
      const newMessages = state.history.slice(lastSpokenIndexRef.current);
      const lastBotMessage = [...newMessages].reverse().find((m) => m.role === 'bot');
      if (lastBotMessage) speak(lastBotMessage.text);
    }
    lastSpokenIndexRef.current = state.history.length;
  }, [state.history, readAloud, ttsSupported]);

  useEffect(() => stopSpeaking, []);

  useEffect(() => {
    // Persist on every change so a back-button nav (or reload) back to this
    // page picks the conversation up where it left off instead of resetting.
    // This is intentionally sessionStorage (not localStorage): it survives
    // a refresh but is gone once the tab/browser actually closes, which is
    // the right default for a guest with no account to tie progress to.
    try {
      sessionStorage.setItem(CHAT_STATE_KEY, serializeChatState(state));
    } catch {
      // Storage unavailable (private browsing, quota) — degrade to in-memory only.
    }
  }, [state]);

  // Signed-in users get real cross-session persistence on top of the
  // sessionStorage above — their progress (or completed quote) is tied to
  // their account, so it survives actually closing the browser and follows
  // them to another device, instead of resetting like a guest's does.
  const appliedAccountStateRef = useRef<string | null>(null);
  // Guards the persist effect below: without this, it fires on the very
  // first render for a newly-signed-in user with whatever local (fresh,
  // untouched) state happens to be showing, and that write can reach the
  // server BEFORE the load below finishes — clobbering whatever the
  // account actually had saved with a blank conversation, which the load
  // then just reads back, making the "restore" a no-op. Persisting is held
  // off until the initial load attempt (found something or not) resolves.
  const accountLoadCompleteRef = useRef(false);
  useEffect(() => {
    if (!user) {
      appliedAccountStateRef.current = null;
      accountLoadCompleteRef.current = false;
      return;
    }
    if (appliedAccountStateRef.current === user.id) return;
    appliedAccountStateRef.current = user.id;
    loadAccountChatState(user.id).then((saved) => {
      if (saved) {
        // This fetch is async and kicked off at mount — if the user typed
        // and sent a message before it resolved, applying it now would
        // silently throw away real local progress. Check freshness against
        // the CURRENT state via the updater form, not the `state` this
        // effect closed over at mount, which is already stale by the time
        // this callback runs.
        setState((current) => {
          if (current.history.length > 1 || current.finalEstimate) return current;
          // If the saved conversation is already a completed quote, treat
          // it like the "restored already finished" case (same as a
          // sessionStorage restore) — show it with the View/Start-new
          // buttons rather than auto-navigating to quote-results, which is
          // reserved for a FRESH completion happening live in this tab.
          if (saved.finalEstimate) restoredAlreadyFinishedRef.current = true;
          return saved;
        });
      }
      accountLoadCompleteRef.current = true;
    });
  }, [user]);

  useEffect(() => {
    if (!user || !accountLoadCompleteRef.current) return;
    saveAccountChatState(user.id, state);
  }, [user, state]);

  useEffect(() => {
    // When the conversation completes, route to the results page — but only
    // for a FRESH completion, never for one restored already-done from a
    // prior visit (see restoredAlreadyFinishedRef above).
    if (state.finalEstimate && !restoredAlreadyFinishedRef.current) {
      const t = setTimeout(() => {
        const payload = {
          estimate: state.finalEstimate!.estimate,
          ctx: state.finalEstimate!.ctx,
          assumptions: state.finalEstimate!.assumptions,
          matchedSituations: state.finalEstimate!.matchedSituations,
          transcript: state.transcript,
        };
        try {
          // Reuse an existing, still-valid hold timer instead of resetting it —
          // this effect can re-run on a remount that restores an
          // already-finalized conversation (e.g. returning via back/forward).
          const existing = sessionStorage.getItem(QUOTE_EXPIRES_KEY);
          const existingMs = existing ? parseInt(existing, 10) : NaN;
          const expiresAt = isFinite(existingMs) && existingMs > Date.now()
            ? existingMs
            : Date.now() + PRICE_HOLD_MINUTES * 60 * 1000;
          sessionStorage.setItem(QUOTE_EXPIRES_KEY, String(expiresAt));
          sessionStorage.setItem(QUOTE_RESULT_KEY, JSON.stringify({ ...payload, expiresAt }));
          navigate('/quote-results', { state: { ...payload, expiresAt } });
        } catch {
          navigate('/quote-results', { state: payload });
        }
      }, 1400); // brief pause so the user sees the wrap-up message
      return () => clearTimeout(t);
    }
  }, [state.finalEstimate, state.transcript, navigate]);

  function startNewEstimate() {
    restoredAlreadyFinishedRef.current = false;
    try {
      sessionStorage.removeItem(CHAT_STATE_KEY);
    } catch {
      // ignore
    }
    setState(makeInitialState());
  }

  async function send() {
    if (!input.trim()) return;
    hapticLight();
    const text = input;
    setInput('');
    setThinking(true);
    try {
      const result = await handleUserMessage(state, text);
      setState(result.state);
    } finally {
      setThinking(false);
      // Re-focus textarea for continuous flow
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }

  function toggleReadAloud() {
    const next = !readAloud;
    setReadAloud(next);
    try {
      localStorage.setItem(READ_ALOUD_KEY, String(next));
    } catch {
      // ignore — storage unavailable
    }
    if (next) {
      const lastBotMessage = [...state.history].reverse().find((m) => m.role === 'bot');
      if (lastBotMessage) speak(lastBotMessage.text);
    } else {
      stopSpeaking();
    }
  }

  function handlePhotoLinkClick(id: string, label: string) {
    setPhotoError('');
    setPendingPhotoRequest({ id, label });
    photoInputRef.current?.click();
  }

  function handlePhotoFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file) return;
    setPendingPhotoFile(file);
    setPendingPhotoPreviewUrl(URL.createObjectURL(file));
    setPhotoDescription('');
  }

  function cancelPhotoUpload() {
    if (pendingPhotoPreviewUrl) URL.revokeObjectURL(pendingPhotoPreviewUrl);
    setPendingPhotoRequest(null);
    setPendingPhotoFile(null);
    setPendingPhotoPreviewUrl(null);
    setPhotoDescription('');
    setPhotoError('');
  }

  async function submitPhotoUpload() {
    if (!pendingPhotoFile || !pendingPhotoRequest || !photoDescription.trim()) return;
    setUploadingPhoto(true);
    setPhotoError('');
    try {
      const url = await uploadQuotePhoto(pendingPhotoFile);
      const description = photoDescription.trim();
      const { id: requestId, label } = pendingPhotoRequest;
      setState((prev) => applyUploadedPhoto(prev, requestId, { url, description, label }));
      cancelPhotoUpload();
      // Best-effort visual read — happens after the photo is already
      // attached so the customer isn't stuck waiting on it; the assessment
      // (if any) shows up as a follow-up message a moment later.
      analyzeQuotePhoto(url, description, label).then((assessment) => {
        if (assessment) setState((prev) => applyPhotoAssessment(prev, requestId, assessment));
      });
    } catch {
      setPhotoError("Couldn't upload that photo — try again?");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter to send; Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const waiting = !!state.finalEstimate;

  return (
    <section className="chat-estimator-section" ref={sectionRef}>
      <div className="chat-estimator-card">
        <div className="chat-estimator-header">
          <div className="chat-estimator-header-row">
            <h2>Get Your Free Painting Estimate</h2>
            {ttsSupported && (
              <button
                type="button"
                className={`chat-read-aloud-toggle ${readAloud ? 'active' : ''}`}
                onClick={toggleReadAloud}
                aria-pressed={!readAloud}
                aria-label={readAloud ? 'Mute' : 'Unmute'}
                title={readAloud ? 'Mute' : 'Unmute'}
              >
                {readAloud ? '\u{1F50A} Mute' : '\u{1F507} Unmute'}
              </button>
            )}
          </div>
          <p>Tell me about your project. Type naturally — I'll guide you from there.</p>
        </div>

        <div className="chat-messages" ref={messagesRef}>
          {state.history.map((m, i) => (
            <div key={i} className={`chat-bubble chat-bubble-${m.role}`}>
              <div className="chat-bubble-text">
                {renderText(m.text, handlePhotoLinkClick)}
                {m.role === 'bot' && ttsSupported && (
                  <button
                    type="button"
                    className="chat-bubble-speak"
                    onClick={() => speak(m.text)}
                    aria-label="Read this message aloud"
                    title="Read aloud"
                  >
                    {'\u{1F50A}'}
                  </button>
                )}
              </div>
              {m.ackChips && m.ackChips.length > 0 && (
                <div className="chat-ack-chips">
                  {m.ackChips.map((c) => (
                    <span key={c} className="chat-ack-chip">{c}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {waiting && (
            <div className="chat-bubble chat-bubble-bot">
              <div className="chat-bubble-text chat-loading">Preparing your results…</div>
            </div>
          )}
          {thinking && !waiting && (
            <div className="chat-bubble chat-bubble-bot">
              <div className="chat-bubble-text chat-loading">…</div>
            </div>
          )}
        </div>

        {waiting && restoredAlreadyFinishedRef.current && (
          <button type="button" className="chat-new-estimate-link" onClick={() => navigate('/quote-results')}>
            View my quote
          </button>
        )}
        {waiting && (
          <button type="button" className="chat-new-estimate-link" onClick={startNewEstimate}>
            Start a new estimate
          </button>
        )}

        <div className="chat-input-row">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Start typing, or tap your phone's mic to talk…"
            rows={2}
            disabled={waiting || thinking}
            className="chat-input"
          />
          <button
            className="chat-send"
            onClick={send}
            disabled={waiting || thinking || !input.trim()}
            aria-label="Send"
          >
            Send
          </button>
        </div>

        <p className="chat-input-hint">
          Getting off track? Try "Back Up" or "Start Over"
        </p>
      </div>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoFileChosen}
        style={{ display: 'none' }}
      />

      {pendingPhotoFile && pendingPhotoRequest && (
        <div className="chat-photo-modal-overlay" onClick={cancelPhotoUpload}>
          <div className="chat-photo-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Photo of {pendingPhotoRequest.label}</h3>
            {pendingPhotoPreviewUrl && (
              <img src={pendingPhotoPreviewUrl} alt="Preview" className="chat-photo-preview" />
            )}
            <label htmlFor="photo-description" className="chat-photo-desc-label">
              Describe what's in this photo <span className="chat-photo-required">*</span>
            </label>
            <textarea
              id="photo-description"
              className="chat-photo-desc-input"
              value={photoDescription}
              onChange={(e) => setPhotoDescription(e.target.value)}
              placeholder="E.g. 'Water stain on the ceiling above the window'"
              rows={3}
              autoFocus
            />
            {photoError && <p className="chat-photo-error">{photoError}</p>}
            <div className="chat-photo-modal-actions">
              <button type="button" className="chat-photo-cancel" onClick={cancelPhotoUpload} disabled={uploadingPhoto}>
                Cancel
              </button>
              <button
                type="button"
                className="chat-photo-submit"
                onClick={submitPhotoUpload}
                disabled={uploadingPhoto || !photoDescription.trim()}
              >
                {uploadingPhoto ? 'Uploading…' : 'Attach Photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

/** Renders **bold** markers as <strong>, and [[photo:id|label]] markers as a clickable "provide a picture" link. */
function renderText(text: string, onPhotoRequest: (id: string, label: string) => void): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\[photo:[^|]+\|[^\]]+\]\])/g);
  return parts.map((p, i) => {
    const bold = p.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={i}>{bold[1]}</strong>;
    const photo = p.match(/^\[\[photo:([^|]+)\|([^\]]+)\]\]$/);
    if (photo) {
      const [, id, label] = photo;
      return (
        <button
          key={i}
          type="button"
          className="chat-photo-link"
          onClick={() => onPhotoRequest(id, label)}
        >
          {'\u{1F4F7}'} Provide a picture of {label}
        </button>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export default ChatPanel;
