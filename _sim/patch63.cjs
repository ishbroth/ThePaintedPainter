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
  ["const EYE_LEVEL = 0.388;", "const EYE_LEVEL = 0.388;\n/** The top carousel's pictures: the other carousels' size (200px tall) times 1.25. Smaller only when the screen is too short to fit that above the mask. */\nconst HERO_CAROUSEL_HEIGHT = 250;"],
  ["      const carouselHeight = Math.max(90, Math.round(size * EYE_LEVEL + startShift - headerHeight));\n      root.style.setProperty('--hero-carousel-h', `${carouselHeight}px`);\n      root.style.setProperty('--hero-spacer', `${Math.max(0, Math.round(cardTop - headerHeight - carouselHeight - 40))}px`);",
   "      // Room between the header and the mask. The pictures are a fixed size; any extra room sits between the header and them,\n      // so their bottom edge always rests at the mask (covering the eyes).\n      const room = Math.max(0, Math.round(size * EYE_LEVEL + startShift - headerHeight));\n      const carouselHeight = Math.min(HERO_CAROUSEL_HEIGHT, Math.max(60, room));\n      const carouselGap = Math.max(0, room - carouselHeight);\n      root.style.setProperty('--hero-carousel-h', `${carouselHeight}px`);\n      root.style.setProperty('--hero-carousel-gap', `${carouselGap}px`);\n      root.style.setProperty('--hero-spacer', `${Math.max(0, Math.round(cardTop - headerHeight - carouselGap - carouselHeight - 40))}px`);"],
]);
patch('src/index.css', [
  [".carousel-section.hero-carousel {\n  padding: 8px 0 0;\n  height: var(--hero-carousel-h, 200px);\n  box-sizing: border-box;\n}",
   ".carousel-section.hero-carousel {\n  padding: 0;\n  /* pictures at 1.25x the other carousels' size; the space above them (under the header) is whatever is left */\n  margin-top: var(--hero-carousel-gap, 0px);\n  height: var(--hero-carousel-h, 250px);\n  box-sizing: border-box;\n}"],
]);
console.log('ok');
