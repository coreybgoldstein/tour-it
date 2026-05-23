/**
 * Server-side cover/logo optimisation used by the auto-seeder, the
 * backfill scripts, and any future API route that ingests course
 * imagery.
 *
 * Why this exists: Satori (the engine behind our Open Graph image
 * generator at app/courses/[id]/opengraph-image.tsx) silently throws
 * RangeError parsing JPEGs above roughly 400KB. The OG card then
 * comes back as a 0-byte response and iMessage / Slack render a
 * broken-image preview. Capping every uploaded cover at <300KB by
 * default eliminates the ceiling.
 *
 * Output targets (chosen against the 1200x630 OG canvas):
 *   - Cover: max 1600px wide, mozjpeg quality 78
 *   - Logo: max 600px wide, mozjpeg quality 80, PNG preserved
 *     when an alpha channel is present
 *
 * Sharp's mozjpeg path produces ~30-40% smaller files than the
 * default encoder for the same visual quality.
 */

import sharp from "sharp";

export type OptimizedImage = {
  bytes: Uint8Array;
  contentType: string;
  width: number;
  height: number;
};

const COVER_MAX_WIDTH = 1600;
const LOGO_MAX_WIDTH = 600;
const COVER_QUALITY = 78;
const LOGO_QUALITY = 80;

/**
 * Resize+recompress a course cover photo. Always outputs JPEG —
 * covers are full-frame photos and JPEG is the right format.
 */
export async function optimizeCover(input: Uint8Array | Buffer): Promise<OptimizedImage> {
  const image = sharp(input, { failOn: "none" }).rotate(); // honour EXIF orientation
  const meta = await image.metadata();

  const outBuf = await image
    .resize({
      width: COVER_MAX_WIDTH,
      withoutEnlargement: true,
      fit: "inside",
    })
    .jpeg({ quality: COVER_QUALITY, mozjpeg: true, progressive: false })
    .toBuffer();

  return {
    bytes: new Uint8Array(outBuf),
    contentType: "image/jpeg",
    width: Math.min(meta.width ?? COVER_MAX_WIDTH, COVER_MAX_WIDTH),
    height: meta.height ?? 0,
  };
}

/**
 * Resize+recompress a course logo. Preserves PNG (and the alpha
 * channel) when the source has transparency; otherwise emits JPEG
 * for the size win. Per CLAUDE.md, club logos should not be
 * transparent — but be defensive in case one slips through.
 */
export async function optimizeLogo(input: Uint8Array | Buffer): Promise<OptimizedImage> {
  const image = sharp(input, { failOn: "none" }).rotate();
  const meta = await image.metadata();
  const hasAlpha = meta.hasAlpha ?? false;

  if (hasAlpha) {
    const outBuf = await image
      .resize({ width: LOGO_MAX_WIDTH, withoutEnlargement: true, fit: "inside" })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
    return {
      bytes: new Uint8Array(outBuf),
      contentType: "image/png",
      width: Math.min(meta.width ?? LOGO_MAX_WIDTH, LOGO_MAX_WIDTH),
      height: meta.height ?? 0,
    };
  }

  const outBuf = await image
    .resize({ width: LOGO_MAX_WIDTH, withoutEnlargement: true, fit: "inside" })
    .jpeg({ quality: LOGO_QUALITY, mozjpeg: true })
    .toBuffer();
  return {
    bytes: new Uint8Array(outBuf),
    contentType: "image/jpeg",
    width: Math.min(meta.width ?? LOGO_MAX_WIDTH, LOGO_MAX_WIDTH),
    height: meta.height ?? 0,
  };
}
