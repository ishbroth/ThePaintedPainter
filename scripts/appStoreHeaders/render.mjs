// Renders the App Store headers with headless Chrome/Edge, then sizes them exactly.
//   node scripts/appStoreHeaders/render.mjs "<output folder>"
// Writes ThePaintedPainter-header-3840x1646.png and ThePaintedPainter-header-5244x2950.png into the folder.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? join(here, 'out'));
mkdirSync(out, { recursive: true });
const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!browser) throw new Error('No Chrome or Edge found');

const jobs = [
  { v: 'wide', w: 3840, h: 1646, css: [2000, 857], file: 'ThePaintedPainter-header-3840x1646.png' },
  { v: 'tall', w: 5244, h: 2950, css: [2000, 1125], file: 'ThePaintedPainter-header-5244x2950.png' },
];
for (const j of jobs) {
  const raw = join(out, `_raw-${j.v}.png`);
  const url = pathToFileURL(join(here, 'header.html')).href + `?v=${j.v}`;
  const scale = j.w / j.css[0];
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', `--force-device-scale-factor=${scale}`,
    `--window-size=${j.css[0]},${j.css[1]}`, '--virtual-time-budget=15000', '--allow-file-access-from-files',
    `--screenshot=${raw}`, url,
  ], { stdio: 'ignore' });
  await sharp(raw).resize(j.w, j.h, { fit: 'fill' }).png().toFile(join(out, j.file));
  console.log('wrote', j.file);
}
