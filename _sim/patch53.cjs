const fs = require('fs');
const f = 'src/index.css';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = t.indexOf('/* Home hero: Superman as a translucent');
const b = t.indexOf('/* Hero Collage (legacy) */');
if (a < 0 || b < 0) throw new Error('markers');
const NEW = `/* Hero background: the whole collage (the houses around Superman) as a translucent, full-screen image that stays fixed while
   the page scrolls. The sharp collage is shown whole and centred ("contain"); a pre-blurred copy of it fills the rest of
   the screen, so it covers any screen shape, wide or tall. */
.site-hero-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.16; /* working pages: very light */
}

.site-hero-bg::before,
.site-hero-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background-repeat: no-repeat;
  background-position: center;
}

.site-hero-bg::before {
  background-image: url('/hero-collage-blur.jpg');
  background-size: cover;
}

.site-hero-bg::after {
  background-image: url('/hero-collage.jpg');
  background-size: contain;
}

.site-hero-bg--home {
  opacity: 0.42;
}

/* The collage is a square of side S = the smaller of the screen's width and height, centred. Superman's body ends about
   74% of the way down it, so the estimator card starts just under that point. That is always lower than the middle of the
   screen, so the card peeks in at the bottom and a small scroll is what brings it past the middle (starting the spoken
   intro). 190px is the header plus the card's own top padding. */
.hero-spacer {
  --hero-s: min(100vw, 100vh);
  height: max(calc(52vh - 190px), calc((100vh - var(--hero-s)) / 2 + var(--hero-s) * 0.76 - 190px));
}

@supports (height: 1svh) {
  .hero-spacer {
    --hero-s: min(100vw, 100svh);
    height: max(calc(52svh - 190px), calc((100svh - var(--hero-s)) / 2 + var(--hero-s) * 0.76 - 190px));
  }
}

@media (max-width: 640px) {
  .site-hero-bg--home {
    opacity: 0.5;
  }
}

`;
t = t.slice(0, a) + NEW + t.slice(b);
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
console.log('ok');
