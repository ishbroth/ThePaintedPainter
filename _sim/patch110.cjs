const fs = require('fs');
function load(f) {
  let t = fs.readFileSync(f, 'utf8');
  return { crlf: t.includes('\r\n'), t: t.split('\r\n').join('\n') };
}
function save(f, o) {
  fs.writeFileSync(f, o.crlf ? o.t.split('\n').join('\r\n') : o.t);
}
function rep(o, a, b, label) {
  if (!o.t.includes(a)) throw new Error('NF ' + (label || a.slice(0, 60)));
  o.t = o.t.replace(a, () => b);
}
{
  const f = 'src/components/SiteBackground.tsx';
  const o = load(f);
  rep(o, "\n/** The same, in the full square collage that phones use (houses along the top and bottom, Superman in the middle). */\nconst SQUARE_TITLE_TOP = 0.4956;\nconst SQUARE_TITLE_BOTTOM = 0.5594;", "\n/** On a phone held upright the picture is a hair wider than the screen, which puts the tips of the roller and the brush right at the margins. */\nconst PHONE_WIDTH_OVER_SCREEN = 1.065;");
  rep(o, "    let titleTop = TITLE_TOP;\n    let titleBottom = TITLE_BOTTOM;\n", "");
  const a = o.t.indexOf("      // A phone held upright is too narrow");
  const b = o.t.indexOf("      startShift = 0; // its top is at the top of the screen");
  if (a < 0 || b < 0) throw new Error('block');
  o.t = o.t.slice(0, a) + `      // A phone held upright: Superman is scaled so the roller and the brush reach the margins of the screen. Anything wider:
      // taller than the screen by a little, unless that would make it wider than the screen allows.
      const phone = window.innerWidth <= 700 && screenHeight > window.innerWidth * 1.2;
      const width = phone
        ? Math.round(window.innerWidth * PHONE_WIDTH_OVER_SCREEN)
        : Math.round(Math.min(screenHeight * HEIGHT_OVER_SCREEN * ASPECT, window.innerWidth * MAX_WIDTH_OVER_SCREEN));
      size = Math.round(width / ASPECT); // the picture's height
` + o.t.slice(b);
  rep(o, "Math.round(size * titleBottom + CARD_GAP)", "Math.round(size * TITLE_BOTTOM + CARD_GAP)");
  rep(o, "          const top = shift + size * titleTop;\n          const bottom = shift + size * titleBottom;\n          const cardTop = card.getBoundingClientRect().top;\n          opacity = Math.min(1, Math.max(0, (cardTop - top) / Math.max(1, bottom - top)));", "          const titleTop = shift + size * TITLE_TOP;\n          const titleBottom = shift + size * TITLE_BOTTOM;\n          const cardTop = card.getBoundingClientRect().top;\n          opacity = Math.min(1, Math.max(0, (cardTop - titleTop) / Math.max(1, titleBottom - titleTop)));");
  save(f, o);
}
{
  const f = 'src/index.css';
  const o = load(f);
  const a = o.t.indexOf("/* Phones held upright: the whole square collage");
  const b = o.t.indexOf("/* the picture and the lettering share one box so they always move together */");
  if (a < 0 || b < 0) throw new Error('css');
  o.t = o.t.slice(0, a) + o.t.slice(b);
  save(f, o);
}
console.log('ok');
