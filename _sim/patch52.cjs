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
patch('src/App.tsx', [
  ["import HouseWatermark from './components/HouseWatermark';", "import SiteBackground from './components/SiteBackground';"],
  ["          <HouseWatermark />", "          <SiteBackground />"],
]);
patch('src/pages/Home.tsx', [
  ["      {/* Superman hero: a translucent full-screen image fixed behind the whole page while you scroll */}\n      <div className=\"site-hero-bg\" role=\"img\" aria-label=\"The Painted Painter\" />\n      {/* Leaves", "      {/* Superman hero (the fixed translucent background lives in SiteBackground). Leaves"],
]);
patch('src/index.css', [
  [".home-page {\n  position: relative;\n  isolation: isolate;\n}\n\n.site-hero-bg {\n  position: fixed;\n  inset: 0;\n  z-index: -1;\n  pointer-events: none;",
   ".site-hero-bg {\n  position: fixed;\n  inset: 0;\n  z-index: 0;\n  pointer-events: none;"],
  ["  background-position: 50% 30%;\n  opacity: 0.4;\n}", "  background-position: 50% 30%;\n  opacity: 0.16; /* working pages: very light */\n}\n\n.site-hero-bg--home {\n  opacity: 0.4;\n}"],
  ["  .site-hero-bg {\n    /* on a phone the picture is cropped to his face and chest; a touch stronger so he still reads */\n    opacity: 0.5;\n    background-position: 50% 22%;\n  }",
   "  .site-hero-bg {\n    background-position: 50% 22%;\n  }\n  .site-hero-bg--home {\n    /* on a phone the picture is cropped to his face and chest; a touch stronger so he still reads */\n    opacity: 0.5;\n  }"],
]);
console.log('ok');
