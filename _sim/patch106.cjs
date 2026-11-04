const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 70)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}

{
  const f = 'src/components/SiteBackground.tsx';
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  // header constants + doc comment
  const top = t.indexOf("/** The picture is never narrower");
  const comp = t.indexOf("const SiteBackground = () => {");
  if (top < 0 || comp < 0) throw new Error('top');
  t = t.slice(0, top) + `/** The picture is just the Superman panel: its width over its height. */
const ASPECT = 1566 / 774;
/** The picture is a little taller than the screen (so it has room to move as the page scrolls) but never wider than 1.35x the screen. */
const HEIGHT_OVER_SCREEN = 1.1;
const MAX_WIDTH_OVER_SCREEN = 1.35;
/** Where the "The Painted Painter" lettering sits in the picture, as shares of its height (top of the letters, bottom of the letters). */
const TITLE_TOP = 0.4655;
const TITLE_BOTTOM = 0.6492;
/** The estimator card starts this many pixels below the lettering. */
const CARD_GAP = 34;

/**
 * Superman (the painter with the roller and the brush) as a translucent background.
 *
 * - Just the Superman panel, no houses. It is scaled (equal proportions) to fill the screen from top to bottom, never much
 *   wider than the screen, so on a laptop the roller and the brush stay near the edges and Superman fills the view.
 * - It is not pinned. As you scroll, it moves up slowly, in proportion to how much page there is to scroll, so the bottom
 *   of the picture and the bottom of the page come into view together.
 * - On a tall, narrow screen (a phone) the picture can be shorter than the screen; a blurred copy fills the rest.
 *
 * On the home page it is stronger, and the "The Painted Painter" lettering is opaque until the estimator card covers it; on
 * working pages (forms, dashboards) everything, lettering included, is kept very light.
 */
` + t.slice(comp);
  // layout body
  const a = t.indexOf("    const layout = () => {");
  const b = t.indexOf("    const place = () => {");
  if (a < 0 || b < 0) throw new Error('layout');
  t = t.slice(0, a) + `    const layout = () => {
      screenHeight = window.innerHeight;
      const main = document.querySelector('main');
      const headerHeight = main ? Math.max(0, Math.round(main.getBoundingClientRect().top + window.scrollY)) : 0;
      // taller than the screen by a little, unless that would make it wider than the screen allows (then it is as wide as allowed)
      const width = Math.round(Math.min(screenHeight * HEIGHT_OVER_SCREEN * ASPECT, window.innerWidth * MAX_WIDTH_OVER_SCREEN));
      size = Math.round(width / ASPECT); // the picture's height
      startShift = 0; // its top is at the top of the screen
      root.style.setProperty('--hero-w', \`\${width}px\`);
      root.style.setProperty('--hero-size', \`\${size}px\`);
      // the estimator card starts a little below the lettering (and never so low that none of it shows)
      const cardTop = Math.min(Math.round(size * TITLE_BOTTOM + CARD_GAP), Math.round(screenHeight * 0.85));
      // (the card sits 40px below the top of the page content that follows the spacer)
      root.style.setProperty('--hero-spacer', \`\${Math.max(0, cardTop - headerHeight - 40)}px\`);
      place();
    };

` + t.slice(b);
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}

patch('src/index.css', [
  ["  background: url('/hero-collage-blur.jpg') center / cover no-repeat;", "  background: url('/hero-superman-blur.jpg') center / cover no-repeat;"],
  ["  /* a square, so the collage keeps its true proportions; a little wider than the screen, centred on Superman */\n  width: var(--hero-size, 106vw);\n  height: var(--hero-size, 106vw);\n  margin-left: calc(var(--hero-size, 106vw) / -2);", "  /* the Superman picture at its true proportions, centred across the screen */\n  width: var(--hero-w, 106vw);\n  height: var(--hero-size, 52vw);\n  margin-left: calc(var(--hero-w, 106vw) / -2);"],
  ["  background: url('/hero-collage.jpg') 0 0 / 100% 100% no-repeat;", "  background: url('/hero-superman.jpg') 0 0 / 100% 100% no-repeat;"],
  ["  left: 26.667%;\n  top: 48.333%;\n  width: 46.667%;\n  height: 8.889%;", "  left: 26.23%;\n  top: 46.55%;\n  width: 47.68%;\n  height: 18.37%;"],
]);
console.log('ok');
