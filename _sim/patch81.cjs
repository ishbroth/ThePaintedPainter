const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 60)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/pages/Home.tsx', [
  ["      {/* The second carousel, moved to the top: its bottom edge sits at Superman's eye level (SiteBackground sets its height) */}\n      <SmoothCarousel triplets={carousel2Triplets} speed={35} className=\"hero-carousel\" />\n\n", ""],
]);
patch('src/components/SiteBackground.tsx', [
  ["      // the carousel under the header ends at Superman's eye level\n      // Room between the header and the mask. The pictures are a fixed size; any extra room sits between the header and them,\n      // so their bottom edge always rests at the mask (covering the eyes).\n      const room = Math.max(0, Math.round(size * EYE_LEVEL + startShift - headerHeight));\n      const carouselHeight = Math.min(HERO_CAROUSEL_HEIGHT, Math.max(60, room));\n      const carouselGap = Math.max(0, room - carouselHeight);\n      root.style.setProperty('--hero-carousel-h', `${carouselHeight}px`);\n      root.style.setProperty('--hero-carousel-gap', `${carouselGap}px`);\n", ""],
]);
