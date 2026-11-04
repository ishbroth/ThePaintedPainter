const fs = require('fs');
function load(f) {
  let t = fs.readFileSync(f, 'utf8');
  return { crlf: t.includes('\r\n'), t: t.split('\r\n').join('\n') };
}
function save(f, o) {
  fs.writeFileSync(f, o.crlf ? o.t.split('\n').join('\r\n') : o.t);
}
function rep(o, a, b, label) {
  if (!o.t.includes(a)) throw new Error('NF ' + (label || a.slice(0, 60)));
  o.t = o.t.replace(a, () => b);
}

// ===================== ChatPanel: keypad handling =====================
{
  const f = 'src/components/ChatEstimator/ChatPanel.tsx';
  const o = load(f);
  const s = o.t.indexOf("  // Phones and tablets: when the keypad comes up, the estimator takes the top half");
  const e = o.t.indexOf("  }, [keyboardDevice]);", s) + "  }, [keyboardDevice]);".length;
  if (s < 0 || e < s) throw new Error('keypad effect');
  o.t = o.t.slice(0, s) + `  // Phones and tablets: while the keypad is up, the estimator becomes a window that fills exactly the space above the keypad (its title
  // on top, the conversation scrolling inside, your line at the bottom). The page behind it does not move or follow the cursor.
  useEffect(() => {
    if (keyboardDevice) return;
    const section = sectionRef.current;
    if (!section) return;
    const root = document.documentElement;
    const vv = window.visualViewport;
    let focused = false;
    let open = false;
    const update = () => {
      const height = vv ? vv.height : window.innerHeight;
      root.style.setProperty('--vvh', \`\${Math.round(height)}px\`);
      root.style.setProperty('--vvtop', \`\${Math.round(vv ? vv.offsetTop : 0)}px\`);
      const full = window.innerHeight > window.innerWidth ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
      const nowOpen = focused && height < full * 0.78;
      if (nowOpen === open) return;
      open = nowOpen;
      if (open) {
        // keep the page the same length while the card is lifted out of it
        section.style.minHeight = \`\${section.offsetHeight}px\`;
        section.classList.add('keyboard-open');
        window.setTimeout(() => messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight }), 30);
      } else {
        section.classList.remove('keyboard-open');
        section.style.minHeight = '';
      }
    };
    const onFocusIn = (ev: FocusEvent) => {
      if (!(ev.target as HTMLElement | null)?.closest?.('.chat-composer')) return;
      focused = true;
      update();
      window.setTimeout(update, 120);
      window.setTimeout(update, 400);
    };
    const onFocusOut = () => {
      // moving between the typing line and the page elements around it does not count as leaving
      window.setTimeout(() => {
        focused = !!document.activeElement?.closest?.('.chat-composer');
        update();
      }, 120);
    };
    section.addEventListener('focusin', onFocusIn);
    section.addEventListener('focusout', onFocusOut);
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    return () => {
      section.removeEventListener('focusin', onFocusIn);
      section.removeEventListener('focusout', onFocusOut);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      section.classList.remove('keyboard-open');
      section.style.minHeight = '';
    };
  }, [keyboardDevice]);` + o.t.slice(e);
  // typing: keep the conversation scrolled inside its window, never the page
  rep(o, "    setInput(text);\n    el.scrollIntoView({ block: 'nearest' });", "    setInput(text);\n    if (keyboardDevice) el.scrollIntoView({ block: 'nearest' });\n    else messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight });");
  // the typing line stays mounted while the reply is on its way (phones), so the keypad stays up between answers
  rep(o, "          {!waiting && !thinking && (", "          {!waiting && (!thinking || !keyboardDevice) && (");
  // Done button in the title row (only shown while the keypad is up)
  rep(o, "            <h2>Pick Your Price, Pick Your Painter.</h2>\n", "            <h2>Pick Your Price, Pick Your Painter.</h2>\n            <button type=\"button\" className=\"chat-kbd-done\" onClick={() => (document.activeElement as HTMLElement | null)?.blur()}>\n              Done\n            </button>\n");
  save(f, o);
}

// ===================== CSS: keypad window =====================
{
  const f = 'src/styles/chat-estimator.css';
  const o = load(f);
  const s = o.t.indexOf("/* Keypad open (phones, tablets): the estimator fills the visible top half");
  const e = o.t.indexOf(".chat-estimator-section.keyboard-open .chat-estimator-header p,");
  if (s < 0 || e < s) throw new Error('css block');
  o.t = o.t.slice(0, s) + `/* Keypad open (phones, tablets): the estimator is a window filling exactly the space above the keypad; the conversation scrolls inside */
.chat-estimator-section.keyboard-open {
  position: fixed;
  top: var(--vvtop, 0px);
  left: 0;
  right: 0;
  height: var(--vvh, 50vh);
  z-index: 2000;
  padding: 0;
  background: var(--bg-page);
  overscroll-behavior: contain;
}

.chat-estimator-section.keyboard-open .chat-estimator-card {
  max-width: none;
  height: 100%;
  margin: 0;
  border-radius: 0;
  border: none;
  box-shadow: none;
  min-height: 0;
}

.chat-estimator-section.keyboard-open .chat-messages {
  flex: 1 1 auto;
  max-height: none;
  min-height: 0;
  overscroll-behavior: contain;
}

.chat-kbd-done {
  display: none;
  flex-shrink: 0;
  padding: 2px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
}

.chat-estimator-section.keyboard-open .chat-kbd-done {
  display: inline-flex;
}

` + o.t.slice(e);
  save(f, o);
}

// ===================== background: on a phone, the whole square picture, so the roller and the brush are in view =====================
{
  const f = 'src/components/SiteBackground.tsx';
  const o = load(f);
  rep(o, "/** Where the \"The Painted Painter\" lettering sits in the picture, as shares of its height (top of the letters, bottom of the letters). */\nconst TITLE_TOP = 0.4655;\nconst TITLE_BOTTOM = 0.6492;", "/** Where the \"The Painted Painter\" lettering sits in the picture, as shares of its height (top of the letters, bottom of the letters). */\nconst TITLE_TOP = 0.4655;\nconst TITLE_BOTTOM = 0.6492;\n/** The same, in the full square collage that phones use (houses along the top and bottom, Superman in the middle). */\nconst SQUARE_TITLE_TOP = 0.4956;\nconst SQUARE_TITLE_BOTTOM = 0.5594;");
  rep(o, "    let startShift = 0; // how far up the picture starts (0 = its top is at the top of the page)\n", "    let startShift = 0; // how far up the picture starts (0 = its top is at the top of the page)\n    let titleTop = TITLE_TOP;\n    let titleBottom = TITLE_BOTTOM;\n");
  rep(o, "      // taller than the screen by a little, unless that would make it wider than the screen allows (then it is as wide as allowed)\n      const width = Math.round(Math.min(screenHeight * HEIGHT_OVER_SCREEN * ASPECT, window.innerWidth * MAX_WIDTH_OVER_SCREEN));\n      size = Math.round(width / ASPECT); // the picture's height\n",
   `      // A phone held upright is too narrow for the wide Superman panel without cutting off the roller and the brush, so it gets the
      // whole square collage at the screen's width instead (the roller and brush in view, the houses above and below).
      const square = window.innerWidth <= 700 && screenHeight > window.innerWidth * 1.2;
      document.querySelector('.site-hero-bg')?.classList.toggle('site-hero-bg--square', square);
      titleTop = square ? SQUARE_TITLE_TOP : TITLE_TOP;
      titleBottom = square ? SQUARE_TITLE_BOTTOM : TITLE_BOTTOM;
      // otherwise: taller than the screen by a little, unless that would make it wider than the screen allows
      const width = square
        ? window.innerWidth
        : Math.round(Math.min(screenHeight * HEIGHT_OVER_SCREEN * ASPECT, window.innerWidth * MAX_WIDTH_OVER_SCREEN));
      size = square ? width : Math.round(width / ASPECT); // the picture's height
`);
  rep(o, "Math.round(size * TITLE_BOTTOM + CARD_GAP)", "Math.round(size * titleBottom + CARD_GAP)");
  rep(o, "          const titleTop = shift + size * TITLE_TOP;\n          const titleBottom = shift + size * TITLE_BOTTOM;\n          const cardTop = card.getBoundingClientRect().top;\n          opacity = Math.min(1, Math.max(0, (cardTop - titleTop) / Math.max(1, titleBottom - titleTop)));", "          const top = shift + size * titleTop;\n          const bottom = shift + size * titleBottom;\n          const cardTop = card.getBoundingClientRect().top;\n          opacity = Math.min(1, Math.max(0, (cardTop - top) / Math.max(1, bottom - top)));");
  save(f, o);
}
{
  const f = 'src/index.css';
  const o = load(f);
  rep(o, "/* the picture and the lettering share one box so they always move together */", `/* Phones held upright: the whole square collage (roller and brush both in view) instead of the wide Superman panel */
.site-hero-bg--square::before {
  background-image: url('/hero-collage-blur.jpg');
}

.site-hero-bg--square .site-hero-bg__img {
  background-image: url('/hero-collage.jpg');
}

.site-hero-bg--square.site-hero-bg--home .site-hero-bg__title {
  left: 26.667%;
  top: 48.333%;
  width: 46.667%;
  height: 8.889%;
}

/* the picture and the lettering share one box so they always move together */`);
  save(f, o);
}
console.log('ok');
