import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  makeInitialState,
  handleUserMessage,
  serializeChatState,
  deserializeChatState,
  type ChatState,
} from '../../lib/chatEstimator/chatEngine';
import { hapticLight } from '../../lib/haptics';
import { CHAT_STATE_KEY, QUOTE_EXPIRES_KEY, QUOTE_RESULT_KEY, PRICE_HOLD_MINUTES } from '../../lib/chatEstimator/persistence';

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
  const [state, setState] = useState<ChatState>(loadInitialState);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  // True when the conversation was ALREADY finished before this component
  // even mounted (restored from storage) — e.g. the user hit back from
  // quote-results. In that case we must NOT auto-bounce them straight back
  // to quote-results; that's what made the homepage feel like it "forwards"
  // to the old quote instead of actually showing the homepage.
  const restoredAlreadyFinishedRef = useRef(state.finalEstimate !== null);

  useEffect(() => {
    // Auto-scroll the message list as new messages arrive
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [state.history.length]);

  useEffect(() => {
    // Persist on every change so a back-button nav (or reload) back to this
    // page picks the conversation up where it left off instead of resetting.
    try {
      sessionStorage.setItem(CHAT_STATE_KEY, serializeChatState(state));
    } catch {
      // Storage unavailable (private browsing, quota) — degrade to in-memory only.
    }
  }, [state]);

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

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter to send; Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const waiting = !!state.finalEstimate;

  return (
    <section className="chat-estimator-section">
      <div className="chat-estimator-card">
        <div className="chat-estimator-header">
          <h2>Get Your Free Painting Estimate</h2>
          <p>Tell me about your project. Type naturally — I'll guide you from there.</p>
        </div>

        <div className="chat-messages" ref={messagesRef}>
          {state.history.map((m, i) => (
            <div key={i} className={`chat-bubble chat-bubble-${m.role}`}>
              <div className="chat-bubble-text">{renderText(m.text)}</div>
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
            autoFocus
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
          Press Enter to send · Shift+Enter for a new line · Use your keyboard's mic to speak
        </p>
      </div>
    </section>
  );
};

/** Renders **bold** markers as <strong>. Anything else passes through as text. */
function renderText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    return m ? <strong key={i}>{m[1]}</strong> : <span key={i}>{p}</span>;
  });
}

export default ChatPanel;
