/**
 * Generates all required Expo icon assets from a source logo PNG.
 * Run: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT = 'C:\\Users\\polmo\\Downloads\\logo.png';
const OUT = join(__dirname, '..', 'assets', 'images');

// Sample the background color from the top-left corner of the source image.
async function sampleBgColor() {
  const { data } = await sharp(INPUT).resize(4, 4).raw().toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2] };
}

// Extract the K mark as kColor-on-transparent.
// Uses color distance from the background with a threshold band:
//   dist < BG_THRESHOLD  → fully transparent (background)
//   dist > K_THRESHOLD   → fully opaque (K mark)
//   in between           → smooth antialiasing transition
async function makeTransparentK(size, kColor = { r: 237, g: 216, b: 61 }) {
  const bg = await sampleBgColor();
  const BG_THRESHOLD = 80;  // pixels this close to bg color → transparent
  const K_THRESHOLD  = 220; // pixels this far from bg color → fully opaque

  const { data, info } = await sharp(INPUT)
    .resize(size, size)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dist = Math.sqrt((r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2);
    let alpha;
    if (dist < BG_THRESHOLD) {
      alpha = 0;
    } else if (dist > K_THRESHOLD) {
      alpha = 255;
    } else {
      alpha = Math.round(((dist - BG_THRESHOLD) / (K_THRESHOLD - BG_THRESHOLD)) * 255);
    }
    data[i]     = kColor.r;
    data[i + 1] = kColor.g;
    data[i + 2] = kColor.b;
    data[i + 3] = alpha;
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
}

async function run() {
  // 1. icon.png — iOS app icon, 1024×1024, original logo (yellow bg, black K)
  await sharp(INPUT).resize(1024, 1024).png().toFile(join(OUT, 'icon.png'));
  console.log('✓ icon.png');

  // 2. favicon.png — browser tab, 48×48
  await sharp(INPUT).resize(48, 48).png().toFile(join(OUT, 'favicon.png'));
  console.log('✓ favicon.png');

  // 3. splash-icon.png — K in yellow on transparent (splash bg = #131313 via app.json)
  await (await makeTransparentK(512)).toFile(join(OUT, 'splash-icon.png'));
  console.log('✓ splash-icon.png');

  // 4. android-icon-background.png — solid #131313 square
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 19, g: 19, b: 19, alpha: 1 } },
  }).png().toFile(join(OUT, 'android-icon-background.png'));
  console.log('✓ android-icon-background.png');

  // 5. android-icon-foreground.png — yellow K on transparent (safe zone: K centred at ~60%)
  const fgBuffer = await (await makeTransparentK(1024)).toBuffer();
  // Shrink to 60% and centre it on a 1024 transparent canvas (Android safe zone)
  const kSmall = await sharp(fgBuffer).resize(614, 614).toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: kSmall, gravity: 'centre' }])
    .png()
    .toFile(join(OUT, 'android-icon-foreground.png'));
  console.log('✓ android-icon-foreground.png');

  // 6. android-icon-monochrome.png — white K on transparent (Android 13+ themed icons)
  await (await makeTransparentK(1024, { r: 255, g: 255, b: 255 })).toFile(join(OUT, 'android-icon-monochrome.png'));
  console.log('✓ android-icon-monochrome.png');

  console.log('\nAll icons generated in assets/images/');
}

run().catch((err) => { console.error(err); process.exit(1); });
