const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 60)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/pages/Home.tsx', [
  // carousel 1 back where it was (below the description)
  ["      {/* Carousel 1, between the estimator and the description */}\n      <SmoothCarousel triplets={carousel1Triplets} speed={40} />\n\n      <div className=\"divider\"></div>\n\n      {/* Platform Description */}\n",
   "      {/* The carousel that was at the top of the page (under the header, resting on Superman's eyes), now right under the estimator */}\n      <SmoothCarousel triplets={carousel2Triplets} speed={35} className=\"carousel-large\" />\n\n      <div className=\"divider\"></div>\n\n      {/* Platform Description */}\n"],
  ["        <p className=\"slogan\">Transparent pricing. Verified painters. Nationwide coverage.</p>\n      </section>\n\n      <div className=\"divider\"></div>\n\n",
   "        <p className=\"slogan\">Transparent pricing. Verified painters. Nationwide coverage.</p>\n      </section>\n\n      <div className=\"divider\"></div>\n\n      {/* Carousel 1 */}\n      <SmoothCarousel triplets={carousel1Triplets} speed={40} />\n\n      <div className=\"divider\"></div>\n\n"],
]);
patch('src/index.css', [
  ["/* The carousel at the top of the home page: starts right under the header and its bottom edge is at Superman's eye level,\n   so its height comes from SiteBackground (--hero-carousel-h). */\n.carousel-section.hero-carousel {\n  padding: 0;\n  /* pictures at 1.25x the other carousels' size; the space above them (under the header) is whatever is left */\n  margin-top: var(--hero-carousel-gap, 0px);\n  height: var(--hero-carousel-h, 250px);\n  box-sizing: border-box;\n}",
   "/* The larger carousel under the estimator: pictures at 1.25x the other carousels' size. */\n.carousel-section.carousel-large {\n  padding: 0;\n  height: 250px;\n  box-sizing: border-box;\n}"],
  [".hero-carousel .smooth-carousel-container,\n.hero-carousel .smooth-carousel-track,\n.hero-carousel .carousel-triplet,\n.hero-carousel .carousel-slide {", ".carousel-large .smooth-carousel-container,\n.carousel-large .smooth-carousel-track,\n.carousel-large .carousel-triplet,\n.carousel-large .carousel-slide {"],
  [".hero-carousel .carousel-slide {\n  width: calc(var(--hero-carousel-h, 200px) * 1.4);\n}", ".carousel-large .carousel-slide {\n  width: 350px;\n}"],
  [".hero-carousel .carousel-slide img {", ".carousel-large .carousel-slide img {"],
]);
patch('src/components/SiteBackground.tsx', [
  ["- carouselGap - carouselHeight - 40", "- 40"],
]);
