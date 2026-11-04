const fs = require('fs');
const f = 'src/components/SiteBackground.tsx';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
const a = t.indexOf("      screenHeight = window.innerHeight;\n      size = Math.round(window.innerWidth * WIDTH_OVER_SCREEN);");
const b = t.indexOf("      place();\n    };", a);
if (a < 0 || b < 0) throw new Error('nf');
const body = `      screenHeight = window.innerHeight;
      const main = document.querySelector('main');
      const headerHeight = main ? Math.max(0, Math.round(main.getBoundingClientRect().top + window.scrollY)) : 0;
      // The estimator card starts at the top of the bottom third of the screen, and "The Painted Painter" lettering rests just
      // above it. The picture is scaled (equal proportions) so the lettering lands there with the picture's top at the top of
      // the screen; it is never much narrower than the screen (a bit of the top row can be cut off instead) nor much wider
      // than it (on a tall phone screen the picture then starts a little lower, over the blurred fill).
      const cardTop = Math.round(screenHeight * (2 / 3));
      const letteringBottom = cardTop - LETTERING_GAP;
      const fit = letteringBottom / TITLE_BOTTOM;
      size = Math.round(Math.min(window.innerWidth * MAX_WIDTH_OVER_SCREEN, Math.max(window.innerWidth * MIN_WIDTH_OVER_SCREEN, fit)));
      startShift = Math.round(letteringBottom - size * TITLE_BOTTOM);
      root.style.setProperty('--hero-size', \`\${size}px\`);
      // (the card sits 40px below the top of the page content that follows the spacer)
      root.style.setProperty('--hero-spacer', \`\${Math.max(0, cardTop - headerHeight - 40)}px\`);
`;
t = t.slice(0, a) + body + t.slice(b);
t = t.replace(/\/\*\* The picture is scaled[^\n]*\nconst WIDTH_OVER_SCREEN = 1\.03;/, "/** The picture is never narrower than 0.75x, nor wider than 1.3x, the screen's width (equal proportions). */\nconst MIN_WIDTH_OVER_SCREEN = 0.75;\nconst MAX_WIDTH_OVER_SCREEN = 1.3;");
t = t.replace("/** The estimator card starts a little below the lettering. */\nconst CARD_BELOW_TITLE = 0.565;", "/** The lettering ends this many pixels above the top of the estimator card. */\nconst LETTERING_GAP = 14;");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
