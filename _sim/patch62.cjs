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

patch('src/components/SiteBackground.tsx', [
  ["/** Where Superman's body ends, as a share of the picture's height (the estimator card starts around there). */\nconst BODY_BOTTOM = 0.76;",
   "/** Where the \"The Painted Painter\" lettering sits in the picture, as shares of its height (top of the letters, bottom of the letters). */\nconst TITLE_TOP = 0.4956;\nconst TITLE_BOTTOM = 0.5594;\n/** The estimator card starts a little below the lettering. */\nconst CARD_BELOW_TITLE = 0.565;"],
  ["const cardTop = Math.min(Math.max(size * BODY_BOTTOM + startShift + 8, screenHeight * 0.52), screenHeight * 0.86);",
   "const cardTop = Math.min(Math.max(size * CARD_BELOW_TITLE + startShift + 8, screenHeight * 0.52), screenHeight * 0.86);"],
  ["      root.style.setProperty('--hero-shift', `${Math.round(startShift + (endShift - startShift) * progress)}px`);\n    };",
   "      const shift = Math.round(startShift + (endShift - startShift) * progress);\n      root.style.setProperty('--hero-shift', `${shift}px`);\n\n      // Home page only: the lettering is fully opaque until the estimator card starts to cover it; once the card is over it,\n      // the lettering is back to the same translucency as the rest of the picture (the card hides it while that happens).\n      if (isHome) {\n        const card = document.querySelector('.chat-estimator-card');\n        let opacity = 1;\n        if (card) {\n          const titleTop = shift + size * TITLE_TOP;\n          const titleBottom = shift + size * TITLE_BOTTOM;\n          const cardTop = card.getBoundingClientRect().top;\n          opacity = Math.min(1, Math.max(0, (cardTop - titleTop) / Math.max(1, titleBottom - titleTop)));\n        }\n        root.style.setProperty('--hero-title-opacity', opacity.toFixed(3));\n      }\n    };"],
  ["    const root = document.documentElement;\n    let frame = 0;", "    const root = document.documentElement;\n    const isHome = pathname === '/';\n    let frame = 0;"],
  ["    <div className={`site-hero-bg${pathname === '/' ? ' site-hero-bg--home' : ''}`} aria-hidden=\"true\">\n      <div className=\"site-hero-bg__img\" />\n    </div>",
   "    <div className={`site-hero-bg${pathname === '/' ? ' site-hero-bg--home' : ''}`} aria-hidden=\"true\">\n      <div className=\"site-hero-bg__stage\">\n        <div className=\"site-hero-bg__img\" />\n        {/* just the lettering, opaque, on the home page only; it is part of the picture and moves with it */}\n        <div className=\"site-hero-bg__title\" />\n      </div>\n    </div>"],
]);

// the file's doc comment mentions the old card spot; keep it accurate
patch('src/components/SiteBackground.tsx', [
  [" * On the home page it is stronger; on working pages (forms, dashboards) it is kept very light.\n */", " * On the home page it is stronger, and the \"The Painted Painter\" lettering is opaque until the estimator card covers it; on\n * working pages (forms, dashboards) everything, lettering included, is kept very light.\n */"],
]);

const f = 'src/index.css';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = t.indexOf('.site-hero-bg {');
const b = t.indexOf('/* Leaves the first screen to the picture;');
const a2 = t.lastIndexOf('/* The carousel at the top of the home page', b);
const end = a2 > a ? a2 : b;
if (a < 0 || b < 0) throw new Error('markers');
const NEW = `.site-hero-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  --hero-opacity: 0.16; /* working pages: very light */
}

.site-hero-bg--home {
  --hero-opacity: 0.42;
}

.site-hero-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url('/hero-collage-blur.jpg') center / cover no-repeat;
  opacity: var(--hero-opacity);
}

/* the picture and the lettering share one box so they always move together */
.site-hero-bg__stage {
  position: absolute;
  top: 0;
  left: 50%;
  /* a square, so the collage keeps its true proportions; a little wider than the screen, centred on Superman */
  width: var(--hero-size, 106vw);
  height: var(--hero-size, 106vw);
  margin-left: calc(var(--hero-size, 106vw) / -2);
  transform: translate3d(0, var(--hero-shift, 0px), 0);
  will-change: transform;
}

.site-hero-bg__img {
  position: absolute;
  inset: 0;
  background: url('/hero-collage.jpg') 0 0 / 100% 100% no-repeat;
  opacity: var(--hero-opacity);
}

/* "The Painted Painter" lettering on its own, opaque, sitting exactly over the lettering in the translucent picture. Home page
   only. SiteBackground sets --hero-title-opacity: 1 until the estimator card covers it, then 0 (so it is the translucent one). */
.site-hero-bg__title {
  display: none;
}

.site-hero-bg--home .site-hero-bg__title {
  display: block;
  position: absolute;
  left: 26.667%;
  top: 48.333%;
  width: 46.667%;
  height: 8.889%;
  background: url('/hero-title.png') 0 0 / 100% 100% no-repeat;
  opacity: var(--hero-title-opacity, 1);
}

@media (max-width: 640px) {
  .site-hero-bg--home {
    --hero-opacity: 0.5;
  }
}

`;
t = t.slice(0, a) + NEW + t.slice(end);
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
console.log('ok');
