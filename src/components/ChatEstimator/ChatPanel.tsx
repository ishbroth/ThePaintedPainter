import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  makeInitialState,
  handleUserMessage,
  type ChatState,
} from '../../lib/chatEstimator/chatEngine';
import { hapticLight } from '../../lib/haptics';

const ChatPanel = () => {
  const [state, setState] = useState<ChatState>(() => makeInitialState());
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-scroll the message list as new messages arrive
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [state.history.length]);

  useEffect(() => {
    // When the conversation completes, route to the results page
    if (state.finalEstimate) {
      const t = setTimeout(() => {
        navigate('/quote-results', {
          state: {
            estimate: state.finalEstimate!.estimate,
            ctx: state.finalEstimate!.ctx,
            assumptions: state.finalEstimate!.assumptions,
            matchedSituations: state.finalEstimate!.matchedSituations,
            transcript: state.transcript,
          },
        });
      }, 1400); // brief pause so the user sees the wrap-up message
      return () => clearTimeout(t);
    }
  }, [state.finalEstimate, state.transcript, navigate]);

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
