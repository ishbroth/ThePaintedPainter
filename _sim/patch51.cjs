const fs = require('fs');
function patch(file, edits) {
  let t = fs.readFileSync(file, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 90));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/pages/Home.tsx', [
  ["    <div>\n      {/* Hero Collage — now above the estimator */}\n      <section className=\"hero-collage\">\n        <div className=\"collage-wrapper\">\n          <img src=\"/IMG_7201.PNG\" alt=\"The Painted Painter\" />\n        </div>\n      </section>\n",
   "    <div className=\"home-page\">\n      {/* Superman hero: a translucent full-screen image fixed behind the whole page while you scroll */}\n      <div className=\"site-hero-bg\" role=\"img\" aria-label=\"The Painted Painter\" />\n      {/* Leaves the first screen to Superman; the estimator starts below his body and just peeks into view */}\n      <section className=\"hero-spacer\" aria-hidden=\"true\" />\n"],
]);
patch('src/index.css', [
  ["/* Hero Collage */\n.hero-collage {",
   `/* Home hero: Superman as a translucent, full-screen background that stays fixed while the page scrolls */
.home-page {
  position: relative;
  isolation: isolate;
}

.site-hero-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image: url('/hero-superman.jpg');
  background-repeat: no-repeat;
  background-size: cover;
  /* keeps his face and emblem in frame when a tall phone screen crops the sides */
  background-position: 50% 30%;
  opacity: 0.4;
}

/* soften the lower part so the estimator and the text below read clearly over the image */
.site-hero-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 0%, transparent 45%, var(--bg-page) 100%);
}

/* The estimator card starts at about 62% of the screen height: it peeks in under Superman's body, but the card has not
   yet crossed the middle of the screen, so a small scroll is what brings it into view (and starts the spoken intro). */
.hero-spacer {
  height: max(18svh, calc(62svh - 150px));
}

@supports not (height: 1svh) {
  .hero-spacer {
    height: max(18vh, calc(62vh - 150px));
  }
}

@media (max-width: 640px) {
  .site-hero-bg {
    /* on a phone the picture is cropped to his face and chest; a touch stronger so he still reads */
    opacity: 0.5;
    background-position: 50% 22%;
  }
  .hero-spacer {
    height: max(14svh, calc(60svh - 160px));
  }
}

/* Hero Collage (legacy) */
.hero-collage {`],
]);
console.log('ok');
