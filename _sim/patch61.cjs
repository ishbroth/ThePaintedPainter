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

patch('src/pages/Home.tsx', [
  ["const SmoothCarousel = ({\n  triplets,\n  speed = 30,\n}: {\n  triplets: typeof carousel1Triplets;\n  speed?: number;\n}) => {",
   "const SmoothCarousel = ({\n  triplets,\n  speed = 30,\n  className = '',\n}: {\n  triplets: typeof carousel1Triplets;\n  speed?: number;\n  className?: string;\n}) => {"],
  ["    <section className=\"carousel-section fade-in\" ref={ref}>", "    <section className={`carousel-section fade-in ${className}`.trim()} ref={ref}>"],
  ["      {/* Superman hero (the fixed translucent background lives in SiteBackground). Leaves", "      {/* The second carousel, moved to the top: its bottom edge sits at Superman's eye level (SiteBackground sets its height) */}\n      <SmoothCarousel triplets={carousel2Triplets} speed={35} className=\"hero-carousel\" />\n\n      {/* Leaves the first screen to the picture;"],
  ["      {/* Carousel 2 */}\n      <SmoothCarousel triplets={carousel2Triplets} speed={35} />\n\n      <div className=\"divider\"></div>\n\n      {/* Carousel 3 */}", "      {/* Carousel 3 */}"],
]);

patch('src/index.css', [
  ["/* Leaves the first screen to the picture;", "/* The carousel at the top of the home page: starts right under the header and its bottom edge is at Superman's eye level,\n   so its height comes from SiteBackground (--hero-carousel-h). */\n.carousel-section.hero-carousel {\n  padding: 8px 0 0;\n  height: var(--hero-carousel-h, 200px);\n  box-sizing: border-box;\n}\n\n.hero-carousel .smooth-carousel-container,\n.hero-carousel .smooth-carousel-track,\n.hero-carousel .carousel-triplet,\n.hero-carousel .carousel-slide {\n  height: 100%;\n}\n\n.hero-carousel .carousel-slide {\n  width: calc(var(--hero-carousel-h, 200px) * 1.4);\n}\n\n.hero-carousel .carousel-slide img {\n  height: 100%;\n}\n\n/* Leaves the first screen to the picture;"],
]);

patch('src/components/SiteBackground.tsx', [
  ["/** How far down the picture the bottom of the brush reaches", "/** Where Superman's eyes are, as a share of the picture's height (the carousel's bottom edge sits there). */\nconst EYE_LEVEL = 0.385;\n/** How far down the picture the bottom of the brush reaches"],
  ["      const cardTop = Math.min(Math.max(size * BODY_BOTTOM + startShift + 8, screenHeight * 0.52), screenHeight * 0.86);\n      root.style.setProperty('--hero-spacer', `${Math.max(0, Math.round(cardTop - headerHeight - 40))}px`);",
   "      const cardTop = Math.min(Math.max(size * BODY_BOTTOM + startShift + 8, screenHeight * 0.52), screenHeight * 0.86);\n      // the carousel under the header ends at Superman's eye level\n      const carouselHeight = Math.max(90, Math.round(size * EYE_LEVEL + startShift - headerHeight));\n      root.style.setProperty('--hero-carousel-h', `${carouselHeight}px`);\n      root.style.setProperty('--hero-spacer', `${Math.max(0, Math.round(cardTop - headerHeight - carouselHeight - 40))}px`);"],
]);
console.log('ok');
