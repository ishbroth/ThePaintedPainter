const fs = require('fs');
const f = 'src/index.css';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = t.indexOf('/* Hero background: the whole collage');
const b = t.indexOf('/* Hero Collage (legacy) */');
if (a < 0 || b < 0) throw new Error('markers');
const NEW = `/* Hero background: the whole collage (the houses around Superman) as a translucent image stretched to fill the screen (a little
   past the edges is fine). It starts at the very top of the page, where the header is, and moves in proportion to how far the
   page is scrolled: SiteBackground sets --hero-w / --hero-h (its size), --hero-shift (how far it has moved up) and
   --hero-spacer (where the estimator card starts, just under Superman's body). A pre-blurred copy fills any gap. */
.site-hero-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  opacity: 0.16; /* working pages: very light */
}

.site-hero-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url('/hero-collage-blur.jpg') center / cover no-repeat;
}

.site-hero-bg__img {
  position: absolute;
  top: 0;
  left: 50%;
  width: var(--hero-w, 120vw);
  height: var(--hero-h, 112vh);
  margin-left: calc(var(--hero-w, 120vw) / -2);
  /* stretched on purpose: it fills the box even when the proportions aren't exact */
  background: url('/hero-collage.jpg') 0 0 / 100% 100% no-repeat;
  transform: translate3d(0, var(--hero-shift, 0px), 0);
  will-change: transform;
}

.site-hero-bg--home {
  opacity: 0.42;
}

/* Leaves the first screen to the picture; the estimator card starts under Superman's body, lower than the middle of the
   screen, so it peeks in at the bottom and a small scroll is what brings it past the middle (starting the spoken intro). */
.hero-spacer {
  height: var(--hero-spacer, calc(60vh - 120px));
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
