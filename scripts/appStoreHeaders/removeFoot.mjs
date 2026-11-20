// The source picture shows three boots. This paints out the outer-left one with the blurred city behind it:
//   superman-flying.jpg -> superman-flying-clean.jpg   (then addSunglasses.mjs -> superman-flying-shades.jpg)
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const W = 1024, H = 768;
const { data } = await sharp(join(here, 'superman-flying.jpg')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const out = Buffer.from(data);
const X0 = 360, X1 = 432, Y0 = 538, Y1 = 630; // the box around the left boot
const px = (x, y) => (y * W + x) * 3;
const isRed = (x, y) => { const i = px(x, y); return data[i] > data[i + 1] + 45 && data[i] > data[i + 2] + 45; };
// mask: red pixels in the box, grown a few pixels so the soft boot edge goes too
const mask = Buffer.alloc(W * H);
for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) if (isRed(x, y)) {
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const xx = x + dx, yy = y + dy; if (xx >= X0 - 6 && xx < X1 + 6 && yy >= Y0 - 6 && yy < Y1 + 6) mask[yy * W + xx] = 255; }
}
const sb = await sharp(mask, { raw: { width: W, height: H, channels: 1 } }).blur(3).extractChannel(0).raw().toBuffer({ resolveWithObject: true }); const soft = sb.data; console.log("mask px", mask.reduce((n, v) => n + (v ? 1 : 0), 0), sb.info.channels);
for (let y = Y0 - 6; y < Y1 + 6; y++) {
  // the background just left of the boot, averaged, carried across this row
  let r = 0, g = 0, b = 0;
  for (let x = 336; x < 352; x++) { const i = px(x, y); r += data[i]; g += data[i + 1]; b += data[i + 2]; }
  r /= 16; g /= 16; b /= 16;
  for (let x = X0 - 6; x < X1 + 6; x++) {
    const a = soft[y * W + x] / 255; if (!a) continue;
    const i = px(x, y);
    out[i] = Math.round(data[i] * (1 - a) + r * a); out[i + 1] = Math.round(data[i + 1] * (1 - a) + g * a); out[i + 2] = Math.round(data[i + 2] * (1 - a) + b * a);
  }
}
await sharp(out, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 96 }).toFile(join(here, 'superman-flying-clean.jpg'));
await sharp(join(here, 'superman-flying-clean.jpg')).extract({ left: 330, top: 420, width: 340, height: 240 }).resize(1020).toFile(process.env.TEMP + '/feet-after.png');
