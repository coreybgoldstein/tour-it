import sharp from 'sharp';
import fs from 'fs';

const SOURCE = 'C:/Users/corey/Downloads/Gemini_Generated_Image_51t0rf51t0rf51t0.png';
const BG = { r: 7, g: 16, b: 10 }; // #07100a

const ICON_PATH = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png';
const SPLASH_PATHS = [
  'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png',
  'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png',
  'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png',
];

async function main() {
  const meta = await sharp(SOURCE).metadata();
  const { width, height } = meta;
  console.log(`Source: ${width}x${height}, hasAlpha: ${meta.hasAlpha}`);

  // ─── APP ICON ────────────────────────────────────────────────────
  // Crop the left half where the pin lives, then trim transparent margins
  // Pin occupies roughly left 38% of image
  const pinRegionW = Math.floor(width * 0.40);

  // Extract pin region first, then trim in a second pass (sharp can't chain these)
  const pinCropped = await sharp(SOURCE)
    .extract({ left: 0, top: 0, width: pinRegionW, height })
    .toBuffer();

  const pinBuffer = await sharp(pinCropped)
    .trim({ threshold: 10 })
    .toBuffer();

  const pinMeta = await sharp(pinBuffer).metadata();
  console.log(`Pin crop (after trim): ${pinMeta.width}x${pinMeta.height}`);

  // Resize pin to fill 75% of 1024 canvas
  const ICON_SIZE = 1024;
  const PIN_FILL = Math.floor(ICON_SIZE * 0.75); // 768

  const pinResized = await sharp(pinBuffer)
    .resize(PIN_FILL, PIN_FILL, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: { width: ICON_SIZE, height: ICON_SIZE, channels: 3, background: BG },
  })
    .composite([{ input: pinResized, gravity: 'center' }])
    .removeAlpha()
    .png()
    .toFile(ICON_PATH);

  console.log(`✓ Icon saved: ${ICON_PATH}`);

  // ─── SPLASH SCREEN ──────────────────────────────────────────────
  // Remove the sparkle (4-pointed star) from bottom-right corner.
  // Sparkle is at roughly x: 91-99%, y: 80-98% of source image.
  // Since bg is transparent, just paint transparent pixels over it.
  const sLeft = Math.floor(width * 0.89);
  const sTop = Math.floor(height * 0.78);
  const sW = width - sLeft;
  const sH = height - sTop;

  const clearRect = await sharp({
    create: {
      width: sW,
      height: sH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();

  const logoClean = await sharp(SOURCE)
    .composite([{ input: clearRect, left: sLeft, top: sTop, blend: 'dest-out' }])
    .png()
    .toBuffer();

  // Resize logo so it fills 40% of the 2732 splash canvas width
  const SPLASH_SIZE = 2732;
  const LOGO_W = Math.floor(SPLASH_SIZE * 0.40); // 1092

  const logoResized = await sharp(logoClean)
    .resize(LOGO_W, null, { fit: 'inside' })
    .png()
    .toBuffer();

  const logoRMeta = await sharp(logoResized).metadata();
  console.log(`Logo resized: ${logoRMeta.width}x${logoRMeta.height}`);

  const splashBuf = await sharp({
    create: { width: SPLASH_SIZE, height: SPLASH_SIZE, channels: 3, background: BG },
  })
    .composite([{ input: logoResized, gravity: 'center' }])
    .removeAlpha()
    .png()
    .toBuffer();

  for (const p of SPLASH_PATHS) {
    await fs.promises.writeFile(p, splashBuf);
    console.log(`✓ Splash saved: ${p}`);
  }

  // Confirm file sizes
  console.log('\n── File sizes ──');
  const allPaths = [ICON_PATH, ...SPLASH_PATHS];
  for (const p of allPaths) {
    const stat = fs.statSync(p);
    console.log(`  ${p.split('/').at(-1)}: ${(stat.size / 1024).toFixed(1)} KB`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
