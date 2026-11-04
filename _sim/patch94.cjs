const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 70)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/components/ChatEstimator/ChatPanel.tsx', [
  ["  // Typing while focus is elsewhere on the page", `  // Phones and tablets: when the keypad comes up, the estimator takes the top half of what is left on screen and the keypad the
  // bottom half (the page scrolls so the estimator's top is at the top, and the conversation area is sized to what is visible).
  useEffect(() => {
    if (keyboardDevice) return;
    const vv = window.visualViewport;
    if (!vv) return;
    let wasOpen = false;
    const onResize = () => {
      const open = vv.height < window.innerHeight - 140;
      document.documentElement.style.setProperty('--vvh', \`\${Math.round(vv.height)}px\`);
      sectionRef.current?.classList.toggle('keyboard-open', open);
      if (open && !wasOpen) {
        window.setTimeout(() => {
          sectionRef.current?.querySelector('.chat-estimator-card')?.scrollIntoView({ block: 'start' });
          messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight });
          composerRef.current?.scrollIntoView({ block: 'nearest' });
        }, 60);
      }
      wasOpen = open;
    };
    vv.addEventListener('resize', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      sectionRef.current?.classList.remove('keyboard-open');
    };
  }, [keyboardDevice]);

  // Typing while focus is elsewhere on the page`],
]);
fs.appendFileSync('src/styles/chat-estimator.css', `
/* Touch screens: text at 16px or more, or the phone zooms in on the page when the keypad opens */
@media (pointer: coarse) {
  .chat-composer,
  .chat-composer-text,
  .chat-photo-desc-input,
  .chat-photo-slot-caption {
    font-size: 16px;
  }
}

/* Keypad open (phones, tablets): the estimator fills the visible top half, with the conversation scrolling inside it */
.chat-estimator-section.keyboard-open {
  padding-top: 8px;
  padding-bottom: 8px;
}

.chat-estimator-section.keyboard-open .chat-messages {
  max-height: calc(var(--vvh, 50vh) - 150px);
  min-height: 0;
}

.chat-estimator-section.keyboard-open .chat-estimator-header p,
.chat-estimator-section.keyboard-open .chat-input-hint {
  display: none;
}
`);
console.log('ok');
