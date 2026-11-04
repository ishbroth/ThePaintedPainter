const fs = require('fs');
const f = 'src/index.css';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = t.indexOf('/* Hero background: the whole collage');
const b = t.indexOf('/* Hero Collage (legacy) */');
if (a < 0 || b < 0) throw new Error('markers');
const NEW = `/* Hero background: the whole collage (the houses around Superman) as a translucent, full-screen image that stays fixed while
   the page scrolls. The sharp collage is shown whole and centred ("contain") starting just below the header; a pre-blurred
   copy of it fills the rest of the screen, so it suits any screen shape, wide or tall. SiteBackground sets --header-h (the
   header's height) and --hero-top (where the sharp picture starts, sliding up as the header scrolls off). */
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
  left: 0;
  right: 0;
  top: var(--hero-top, 82px);
  height: calc(100vh - var(--header-h, 82px));
  background: url('/hero-collage.jpg') center / contain no-repeat;
}

@supports (height: 1svh) {
  .site-hero-bg__img {
    height: calc(100svh - var(--header-h, 82px));
  }
}

.site-hero-bg--home {
  opacity: 0.42;
}

/* The collage is a square of side S (the smaller of the screen width and the space below the header), centred in that space.
   Superman's body ends about 74% of the way down it, so the estimator card starts just under that point. That is always
   lower than the middle of the screen, so the card peeks in at the bottom and a small scroll is what brings it past the
   middle (which starts the spoken intro). 40px is the card section's own top padding. */
.hero-spacer {
  --box-h: calc(100vh - var(--header-h, 82px));
  --hero-s: min(100vw, var(--box-h));
  height: max(calc(52vh - var(--header-h, 82px) - 40px), calc((var(--box-h) - var(--hero-s)) / 2 + var(--hero-s) * 0.76 - 40px));
}

@supports (height: 1svh) {
  .hero-spacer {
    --box-h: calc(100svh - var(--header-h, 82px));
    --hero-s: min(100vw, var(--box-h));
    height: max(calc(52svh - var(--header-h, 82px) - 40px), calc((var(--box-h) - var(--hero-s)) / 2 + var(--hero-s) * 0.76 - 40px));
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
