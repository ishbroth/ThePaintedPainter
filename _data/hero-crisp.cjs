const sharp = require('sharp');
(async () => {
  const W = 1566, H = 774, S = 2;
  const base = await sharp('public/hero-superman.jpg').resize(W * S, H * S, { kernel: 'lanczos3' }).sharpen({ sigma: 1.1, m1: 0.8, m2: 1.4 }).toBuffer();
  const tw = Math.round(0.4768 * W * S), th = Math.round(0.1837 * H * S);
  const title = await sharp('public/hero-title.png').resize(tw, th, { kernel: 'lanczos3', fit: 'fill' }).toBuffer();
  await sharp(base).composite([{ input: title, left: Math.round(0.2623 * W * S), top: Math.round(0.4655 * H * S) }]).jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile('_data/hero-superman-2x.jpg');
  const m = await sharp('_data/hero-superman-2x.jpg').metadata();
  console.log(m.width, m.height, require('fs').statSync('_data/hero-superman-2x.jpg').size);
  // crops to compare: the lettering, old (upscaled plainly) and new
  await sharp('public/hero-superman.jpg').resize(W * S, H * S, { kernel: 'cubic' }).extract({ left: 820, top: 700, width: 1500, height: 330 }).toFile('_data/cmp-old.png');
  await sharp('_data/hero-superman-2x.jpg').extract({ left: 820, top: 700, width: 1500, height: 330 }).toFile('_data/cmp-new.png');
})();
