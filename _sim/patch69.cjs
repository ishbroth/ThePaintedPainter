const fs = require('fs');
function patch(file, edits) {
  let t = fs.readFileSync(file, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 80));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split('\n').join('\r\n') : t);
}

patch('src/components/ChatEstimator/ChatPanel.tsx', [
  ["  const textareaRef = useRef<HTMLTextAreaElement>(null);", "  // the one place you type: a right-aligned bubble at the end of the conversation, with Send right after the text\n  const composerRef = useRef<HTMLSpanElement>(null);\n  const focusComposerNextRef = useRef(false);"],
  ["    const text = input;\n    setInput('');\n    setThinking(true);", "    const text = input;\n    setInput('');\n    if (composerRef.current) composerRef.current.textContent = '';\n    focusComposerNextRef.current = true;\n    setThinking(true);"],
  ["      // Re-focus textarea for continuous flow\n      setTimeout(() => textareaRef.current?.focus(), 0);", "      // the cursor goes back to the next line, ready for the next answer (focused once the new composer is on screen)"],
  ["  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {", "  function onKeyDown(e: KeyboardEvent<HTMLSpanElement>) {"],
  ["  const waiting = !!state.finalEstimate;\n", `  const waiting = !!state.finalEstimate;

  // After sending (not on first page load, which would pull the page down to the chat), put the cursor back in the new composer.
  useEffect(() => {
    if (!thinking && !waiting && focusComposerNextRef.current) {
      focusComposerNextRef.current = false;
      const el = composerRef.current;
      if (el) {
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [thinking, waiting, state.history.length]);

  function onComposerInput(e: React.FormEvent<HTMLSpanElement>) {
    const el = e.currentTarget;
    const text = el.textContent ?? '';
    // a browser can leave a stray <br> behind once everything is deleted, which would hide the placeholder
    if (text === '') el.innerHTML = '';
    setInput(text);
    el.scrollIntoView({ block: 'nearest' });
  }

  function onComposerPaste(e: React.ClipboardEvent<HTMLSpanElement>) {
    // plain text only, whatever was copied
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }
`],
  ["          {thinking && !waiting && (\n            <div className=\"chat-bubble chat-bubble-bot\">\n              <div className=\"chat-bubble-text chat-loading\">…</div>\n            </div>\n          )}\n        </div>",
   `          {thinking && !waiting && (
            <div className="chat-bubble chat-bubble-bot">
              <div className="chat-bubble-text chat-loading">…</div>
            </div>
          )}
          {/* One open window: your answer is typed right here, under the question, with Send at the end of what you type. */}
          {!waiting && !thinking && (
            <div className="chat-bubble chat-bubble-user chat-composer" onClick={() => composerRef.current?.focus()}>
              <span
                ref={composerRef}
                className="chat-composer-text"
                contentEditable="plaintext-only"
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label="Type your answer"
                spellCheck
                autoCapitalize="sentences"
                data-placeholder="Type your answer here, or use your phone's mic to talk…"
                onInput={onComposerInput}
                onKeyDown={onKeyDown}
                onPaste={onComposerPaste}
              />
              <button
                type="button"
                className="chat-send-inline"
                onClick={(e) => {
                  e.stopPropagation();
                  send();
                }}
                disabled={!input.trim()}
                aria-label="Send"
              >
                Send
              </button>
            </div>
          )}
        </div>`],
]);

// remove the separate input row
{
  const f = 'src/components/ChatEstimator/ChatPanel.tsx';
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  const a = t.indexOf('        <div className="chat-input-row">');
  const b = t.indexOf('        <p className="chat-input-hint">');
  if (a < 0 || b < 0) throw new Error('input row markers');
  t = t.slice(0, a) + t.slice(b);
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}

patch('src/styles/chat-estimator.css', [
  ["  max-height: 420px;\n  min-height: 240px;\n  overflow-y: auto;", "  /* one large open window: the conversation and the place you type are the same field */\n  max-height: min(640px, 74vh);\n  min-height: 380px;\n  overflow-y: auto;"],
  [".chat-input-row {", `/* The inline composer: a right-aligned bubble under the last question. The text is typed in the span; Send sits right after it
   and moves along as the text grows or wraps. */
.chat-composer {
  cursor: text;
  min-width: 120px;
  line-height: 1.6;
  caret-color: var(--accent-blue-ink);
}

.chat-composer-text {
  outline: none;
  white-space: pre-wrap;
  word-break: break-word;
  min-width: 2px;
}

.chat-composer-text:empty::before {
  content: attr(data-placeholder);
  color: color-mix(in srgb, var(--accent-blue-ink) 62%, transparent);
  font-weight: 400;
}

.chat-send-inline {
  display: inline-block;
  margin-left: 10px;
  padding: 3px 12px;
  font-family: 'Cabin', sans-serif;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--accent-blue);
  background: var(--accent-blue-ink);
  border: none;
  border-radius: 999px;
  cursor: pointer;
  vertical-align: baseline;
  user-select: none;
}

.chat-send-inline:disabled {
  opacity: 0.4;
  cursor: default;
}

.chat-input-row {`],
]);
console.log('ok');
