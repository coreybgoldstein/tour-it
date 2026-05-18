// One-off script: takes new-icon-source.jpg in the repo root and produces
// the iOS app icon PNG at the exact spec Apple requires:
//
//   • 1024 x 1024
//   • PNG, 8-bit/color RGB
//   • NO alpha channel  (Apple Connect rejects icons with transparency)
//   • Centered, edge-to-edge (no padding around the design)
//
// Uses sharp's `cover` fit so the source image fills the 1024 canvas
// proportionally and the longer axis is center-cropped. For a near-
// square source like 1276x1254 the crop is ~10px per side, invisible.
// `flatten({ background })` guarantees the output is pure RGB even if
// sharp's PNG encoder would otherwise write an alpha channel.

import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const SOURCE = path.join(repoRoot, "new-icon-source.jpg");
const TARGET = path.join(
  repoRoot,
  "ios", "App", "App", "Assets.xcassets",
  "AppIcon.appiconset", "AppIcon-512@2x.png"
);

const BRAND_DARK = "#07100a";

const meta = await sharp(SOURCE).metadata();
console.log(`source: ${meta.format} ${meta.width}x${meta.height} ${meta.channels}ch alpha=${meta.hasAlpha}`);

await sharp(SOURCE)
  .resize(1024, 1024, { fit: "cover", position: "center" })
  .flatten({ background: BRAND_DARK })
  .png({ compressionLevel: 9, palette: false })
  .toFile(TARGET);

const out = await sharp(TARGET).metadata();
console.log(`output: ${out.format} ${out.width}x${out.height} ${out.channels}ch alpha=${out.hasAlpha} size=${out.size}b`);

if (out.width !== 1024 || out.height !== 1024) {
  console.error("FAIL: output dimensions wrong");
  process.exit(1);
}
if (out.hasAlpha) {
  console.error("FAIL: output has alpha channel — Apple will reject");
  process.exit(1);
}
console.log(`✅ wrote ${TARGET}`);
