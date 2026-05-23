// Backfill: find every course whose coverImageUrl ends in .webp (or
// reports image/webp content-type) and reconvert it to JPEG so the
// /courses/[id]/opengraph-image endpoint can actually render the
// card. Satori (the underlying ImageResponse engine) does not support
// WebP — handing it a WebP data URI causes the whole response to
// come back as 200 OK with Content-Length: 0, which iMessage /
// WhatsApp / Slack then render as a compact preview (title + favicon)
// instead of the rich OG card.
//
// The Polo Club Boca Raton — Club Course was the canary on 2026-05-23.
// The "Contribute" upload path on the course profile page uploads
// whatever extension the user picked without going through
// optimizeCover, so any WebP source slips through.
//
// Run: node src/scripts/backfill-webp-covers.mjs

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const BUCKET = "tour-it-photos";

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") || "" };
}

async function recompressToJpeg(bytes) {
  const out = await sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true, fit: "inside" })
    .jpeg({ quality: 78, mozjpeg: true, progressive: false })
    .toBuffer();
  return new Uint8Array(out);
}

async function main() {
  // Find any cover whose URL or stored bytes look WebP-ish.
  const { data: courses, error } = await sb
    .from("Course")
    .select("id, name, coverImageUrl")
    .not("coverImageUrl", "is", null);
  if (error) throw error;

  const candidates = [];
  for (const c of courses ?? []) {
    if (!c.coverImageUrl) continue;
    // Heuristic 1: explicit .webp extension in URL
    if (c.coverImageUrl.toLowerCase().includes(".webp")) {
      candidates.push(c);
      continue;
    }
    // Heuristic 2: HEAD the URL and look at content-type. Skipped here
    // to keep the script fast; the URL extension is reliable for the
    // contribute-upload path that produced today's break.
  }
  console.log(`Found ${candidates.length} WebP covers across ${courses?.length ?? 0} courses.`);

  for (const c of candidates) {
    try {
      console.log(`\n[${c.name}]`);
      console.log(`  source: ${c.coverImageUrl}`);
      const { bytes, contentType } = await fetchBytes(c.coverImageUrl);
      console.log(`  fetched ${bytes.byteLength} bytes (${contentType})`);

      const jpegBytes = await recompressToJpeg(bytes);
      console.log(`  recompressed → ${jpegBytes.byteLength} bytes JPEG`);

      // Upload to a stable path: covers/{id}/{timestamp}.jpg
      const newPath = `covers/${c.id}/${Date.now()}.jpg`;
      const { error: upErr } = await sb.storage.from(BUCKET).upload(newPath, jpegBytes, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (upErr) throw upErr;
      const newUrl = sb.storage.from(BUCKET).getPublicUrl(newPath).data.publicUrl;

      const { error: updErr } = await sb.from("Course").update({ coverImageUrl: newUrl }).eq("id", c.id);
      if (updErr) throw updErr;
      console.log(`  ✓ Course.coverImageUrl updated → ${newUrl}`);
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
