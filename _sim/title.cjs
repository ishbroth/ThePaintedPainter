const sharp = require('sharp');
(async () => {
  const L = 480, T = 870, W = 840, H = 160;
  const { data, info } = await sharp('public/IMG_7201.PNG').extract({ left: L, top: T, width: W, height: H }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const m = Math.min(r, g, b);
    // letters are pure white; sky/cloud highlights are lighter blues and creams, so only near-white counts
    const a = Math.max(0, Math.min(1, (m - 222) / (248 - 222)));
    out[i * 4] = 255; out[i * 4 + 1] = 255; out[i * 4 + 2] = 255; out[i * 4 + 3] = Math.round(a * 255);
  }
  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile('public/hero-title.png');
  // preview on a dark background to check the cut
  await sharp({ create: { width: W, height: H, channels: 3, background: { r: 40, g: 70, b: 140 } } })
    .composite([{ input: 'public/hero-title.png' }]).png().toFile('_sim/title-preview.png');
  console.log('done', W, H);
})();
