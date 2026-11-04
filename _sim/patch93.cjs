const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 70)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/components/SiteBackground.tsx', [
  [`      const cardTop = Math.round(screenHeight * 0.75);
      const letteringBottom = cardTop - LETTERING_GAP;
      const fit = letteringBottom / TITLE_BOTTOM;
      size = Math.round(Math.min(window.innerWidth * MAX_WIDTH_OVER_SCREEN, Math.max(window.innerWidth * MIN_WIDTH_OVER_SCREEN, fit)));
      startShift = Math.round(letteringBottom - size * TITLE_BOTTOM);
      root.style.setProperty('--hero-size', \`\${size}px\`);`,
   `      let cardTop = Math.round(screenHeight * 0.75);
      const letteringBottom = cardTop - LETTERING_GAP;
      const fit = letteringBottom / TITLE_BOTTOM;
      const maxSize = window.innerWidth * MAX_WIDTH_OVER_SCREEN;
      if (fit > maxSize) {
        // A tall, narrow screen (a phone held upright): the picture can't be big enough to put the lettering that low, so the
        // picture stays at its widest with its top at the top of the screen, and the estimator moves up to stay just below the
        // lettering. Superman, the lettering and the estimator are all pulled up together.
        size = Math.round(maxSize);
        startShift = 0;
        cardTop = Math.round(size * TITLE_BOTTOM + LETTERING_GAP);
      } else {
        size = Math.round(Math.max(window.innerWidth * MIN_WIDTH_OVER_SCREEN, fit));
        startShift = Math.round(letteringBottom - size * TITLE_BOTTOM);
      }
      root.style.setProperty('--hero-size', \`\${size}px\`);`],
]);
patch('src/components/ChatEstimator/ChatPanel.tsx', [
  ["            <div className=\"chat-bubble chat-bubble-user chat-composer\" onClick={() => composerRef.current?.focus()}>",
   `            <div
              className="chat-bubble chat-bubble-user chat-composer"
              onClick={() => {
                composerRef.current?.focus();
                // phones and tablets: this tap is what starts the voice (it's a real touch, which also lets the browser play audio)
                if (!keyboardDevice) playIntroIfFreshRef.current();
              }}
            >`],
]);
console.log('ok');
