// Renders the App Store headers with headless Chrome/Edge, then sizes them exactly.
//   node scripts/appStoreHeaders/render.mjs "<output folder>"
// Writes two folders inside it, each with ThePaintedPainter-header-3840x1646.png and ThePaintedPainter-header-5244x2950.png:
//   with-wheel/  (header.html)        no-wheel/  (header-simple.html: "Pick your price, pick your painter")
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.argv[2] ?? join(here, 'out'));
const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!browser) throw new Error('No Chrome or Edge found');

const versions = [
  { folder: 'with-wheel', page: 'header.html' },
  { folder: 'no-wheel', page: 'header-simple.html' },
];
const jobs = [
  { v: 'wide', w: 3840, h: 1646, css: [2000, 857], file: 'ThePaintedPainter-header-3840x1646.png' },
  { v: 'tall', w: 5244, h: 2950, css: [2000, 1125], file: 'ThePaintedPainter-header-5244x2950.png' },
];
for (const ver of versions) {
  const out = join(root, ver.folder);
  mkdirSync(out, { recursive: true });
  for (const j of jobs) {
    const raw = join(out, `_raw-${j.v}.png`);
    const url = pathToFileURL(join(here, ver.page)).href + `?v=${j.v}`;
    const scale = j.w / j.css[0];
    execFileSync(browser, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', `--force-device-scale-factor=${scale}`,
      `--window-size=${j.css[0]},${j.css[1]}`, '--virtual-time-budget=15000', '--allow-file-access-from-files',
      `--screenshot=${raw}`, url,
    ], { stdio: 'ignore' });
    await sharp(raw).resize(j.w, j.h, { fit: 'fill' }).png().toFile(join(out, j.file));
    rmSync(raw);
    console.log('wrote', ver.folder, j.file);
  }
}
