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
{
  const o = load('src/components/ChatEstimator/ChatPanel.tsx');
  // Send must not take focus away from the typing line (that drops the keypad on a phone)
  rep(o, "                className=\"chat-send-inline\"\n                onClick={(e) => {\n                  e.stopPropagation();\n                  send();\n                }}", `                className="chat-send-inline"
                // tapping Send must not move focus off the typing line: on a phone that closes the keypad and the window with it
                onMouseDown={(e) => e.preventDefault()}
                onTouchEnd={(e) => {
                  e.preventDefault(); // also stops the follow-up click, so it is not sent twice
                  e.stopPropagation();
                  send();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  send();
                }}`);
  // the keypad's return key reads "send"
  rep(o, "                onFocus={() => {", "                enterKeyHint=\"send\"\n                onFocus={() => {");
  // page locked while the keypad window is up (so the phone has nothing to pan or scroll behind it)
  rep(o, "        section.classList.add('keyboard-open');", "        section.classList.add('keyboard-open');\n        root.classList.add('chat-kbd-lock');");
  rep(o, "        section.classList.remove('keyboard-open');\n        section.style.minHeight = '';\n      }\n    };", "        section.classList.remove('keyboard-open');\n        root.classList.remove('chat-kbd-lock');\n        section.style.minHeight = '';\n      }\n    };");
  rep(o, "      section.classList.remove('keyboard-open');\n      section.style.minHeight = '';\n    };\n  }, [keyboardDevice]);", "      section.classList.remove('keyboard-open');\n      root.classList.remove('chat-kbd-lock');\n      section.style.minHeight = '';\n    };\n  }, [keyboardDevice]);");
  save('src/components/ChatEstimator/ChatPanel.tsx', o);
}
{
  const o = load('src/styles/chat-estimator.css');
  rep(o, "  position: fixed;\n  top: var(--vvtop, 0px);\n  left: 0;\n  right: 0;\n  height: var(--vvh, 50vh);", "  position: fixed;\n  top: 0;\n  left: 0;\n  right: 0;\n  /* follows the part of the screen that is actually visible above the keypad, even if the phone pans the page */\n  transform: translate3d(0, var(--vvtop, 0px), 0);\n  height: var(--vvh, 50vh);");
  o.t += `
/* While the keypad window is up the page behind it does not scroll */
html.chat-kbd-lock,
html.chat-kbd-lock body {
  overflow: hidden;
  overscroll-behavior: none;
}
`;
  save('src/styles/chat-estimator.css', o);
}
console.log('ok');
