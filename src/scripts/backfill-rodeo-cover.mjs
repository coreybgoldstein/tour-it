// Backfill: recompress Rodeo Dunes' 579KB cover (which exceeds the
// 400KB ceiling enforced in app/courses/[id]/opengraph-image.tsx) so
// the OG card can actually embed the photo instead of falling back
// to the brand-gradient design.
//
// Run with: node src/scripts/backfill-rodeo-cover.mjs
//
// Idempotent — running it again on an already-compressed cover is
// fine (sharp will just re-encode at the same quality).

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const COURSE_ID = "d25aaac7-bd58-4d2f-883c-f37d12161ec3"; // Rodeo Dunes, Roggen CO
const COVER_MAX_WIDTH = 1600;
const COVER_QUALITY = 78;
const BUCKET = "tour-it-photos";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { data: course, error: ce } = await sb
    .from("Course")
    .select("id, name, coverImageUrl")
    .eq("id", COURSE_ID)
    .single();
  if (ce || !course) throw new Error(`Course not found: ${ce?.message}`);
  if (!course.coverImageUrl) throw new Error(`${course.name}: no coverImageUrl set`);

  console.log(`[${course.name}] fetching ${course.coverImageUrl}`);
  const res = await fetch(course.coverImageUrl);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const original = new Uint8Array(await res.arrayBuffer());
  console.log(`  original size: ${(original.length / 1024).toFixed(0)}KB`);

  const meta = await sharp(original).metadata();
  console.log(`  original dimensions: ${meta.width}x${meta.height} ${meta.format}`);

  const compressed = await sharp(original, { failOn: "none" })
    .rotate()
    .resize({ width: COVER_MAX_WIDTH, withoutEnlargement: true, fit: "inside" })
    .jpeg({ quality: COVER_QUALITY, mozjpeg: true, progressive: false })
    .toBuffer();
  const compressedMeta = await sharp(compressed).metadata();
  console.log(`  compressed size: ${(compressed.length / 1024).toFixed(0)}KB`);
  console.log(`  compressed dimensions: ${compressedMeta.width}x${compressedMeta.height}`);

  // Re-upload to the same path so the existing public URL stays valid.
  // upsert: true is required since the file already exists.
  const path = `course-images/${COURSE_ID}-cover.jpg`;
  const { error: ue } = await sb.storage.from(BUCKET).upload(path, compressed, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (ue) throw new Error(`upload failed: ${ue.message}`);

  // The public URL doesn't change, but bust Supabase's CDN cache by
  // updating the Course row's updatedAt timestamp so the OG image
  // route's coverImageUrl read returns a fresh fetch on the next
  // request. (The URL itself is stable; only Supabase's edge cache
  // matters here, which honours the upload's new ETag.)
  await sb.from("Course").update({ updatedAt: new Date().toISOString() }).eq("id", COURSE_ID);

  console.log(`[${course.name}] DONE — re-uploaded ${(compressed.length / 1024).toFixed(0)}KB`);
}

main().catch(err => {
  console.error("FAILED:", err);
  process.exit(1);
});
