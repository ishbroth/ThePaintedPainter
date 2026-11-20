// Draws the old logo's sunglasses (black lenses, light glint, thin arms) onto superman-flying-clean.jpg -> superman-flying-shades.jpg (run removeFoot.mjs first)
//   node scripts/appStoreHeaders/addSunglasses.mjs
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const lens = (cx, cy) => `
  <rect x="${cx - 23}" y="${cy - 14}" width="46" height="28" rx="10" fill="#07080c" stroke="#000" stroke-width="2"/>
  <polygon points="${cx - 19},${cy - 10} ${cx + 1},${cy - 10} ${cx - 19},${cy + 5}" fill="url(#glint)" opacity=".9"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1536" viewBox="0 0 1024 768">
  <defs><linearGradient id="glint" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1f4fa"/><stop offset="1" stop-color="#3b414d"/></linearGradient></defs>
  <g transform="rotate(-3.7 495 135)">
    <path d="M441 123 L418 128 M549 123 L575 120" stroke="#050505" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M487 124 Q495 121 503 124" stroke="#050505" stroke-width="3" fill="none"/>
    ${lens(464, 133)}${lens(526, 133)}
  </g></svg>`;
const base = await sharp(join(here, 'superman-flying-clean.jpg')).resize(2048, 1536, { kernel: 'lanczos3' }).toBuffer();
await sharp(base).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).jpeg({ quality: 95 }).toFile(join(here, 'superman-flying-shades.jpg'));
await sharp(join(here, 'superman-flying-shades.jpg')).extract({ left: 760, top: 120, width: 480, height: 220 }).resize(960).toFile(process.env.TEMP + '/shades-check.png');
