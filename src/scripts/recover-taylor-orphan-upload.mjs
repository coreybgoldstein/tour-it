// One-off: recover Taylor Muth's orphaned upload from 2026-05-23.
//
// He uploaded a FULL_ROUND photo (3.2MB JPEG) to Plantation Preserve
// Golf Course & Club. The file landed in Supabase Storage but the
// Upload row insert never completed (likely network drop or app
// backgrounded between the storage upload and the DB write — the
// same failure mode the upload-reliability refactor in
// /api/uploads/create is meant to prevent going forward).
//
// This script:
//   - Verifies the orphan file exists in storage
//   - Creates the Upload row pointing at it (PHOTO / FULL_ROUND / APPROVED)
//   - Bumps Course.uploadCount
//   - Auto-links to a Round (creates one if missing)
// Idempotent: re-running finds the existing Upload row and exits.
//
// Run: node src/scripts/recover-taylor-orphan-upload.mjs

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const TAYLOR_ID = "ac252ff7-a18f-4f74-b7b6-fd36c8b68d03";
const COURSE_ID = "22f3e18e-53f9-475f-a7ec-9275a9f03d85"; // Plantation Preserve Golf Course & Club
// Hole.holeId is NOT NULL in the schema even for FULL_ROUND, so we attach
// to Hole 1 as a sane default — Taylor can re-tag the clip from his profile.
const HOLE_ID = "066323e6-2c36-4be1-b1b1-669977878e6a"; // Plantation Preserve, Hole 1
const FILE_NAME = "1779557906890.jpeg";
const STORAGE_PATH = `${TAYLOR_ID}/${COURSE_ID}/FULL_ROUND/${FILE_NAME}`;
// Timestamp from the storage object — preserves Taylor's real upload moment
const UPLOAD_TS = "2026-05-23T17:38:33.839Z";

async function main() {
  // 1. Confirm the orphan file is still in storage
  const { data: filelist, error: lsErr } = await sb.storage
    .from("tour-it-photos")
    .list(`${TAYLOR_ID}/${COURSE_ID}/FULL_ROUND`, { limit: 10 });
  if (lsErr) throw lsErr;
  const file = filelist?.find(f => f.name === FILE_NAME);
  if (!file) {
    console.error("Orphan file no longer exists in storage. Aborting.");
    process.exit(1);
  }
  console.log("✓ Orphan file confirmed:", FILE_NAME, `(${file.metadata?.size} bytes)`);

  // 2. Idempotency — check for an existing row pointing at this file
  const { data: pub } = sb.storage.from("tour-it-photos").getPublicUrl(STORAGE_PATH);
  const mediaUrl = pub.publicUrl;
  const { data: existing } = await sb
    .from("Upload")
    .select("id, createdAt")
    .eq("userId", TAYLOR_ID)
    .eq("mediaUrl", mediaUrl)
    .maybeSingle();
  if (existing) {
    console.log("✓ Upload row already exists, no-op:", existing.id);
    return;
  }

  // 3. Insert Upload row
  const uploadId = randomUUID();
  const { error: insErr } = await sb.from("Upload").insert({
    id: uploadId,
    userId: TAYLOR_ID,
    courseId: COURSE_ID,
    holeId: HOLE_ID,
    mediaType: "PHOTO",
    mediaUrl,
    cloudflareVideoId: null,
    teeBoxId: null,
    shotType: "FULL_ROUND",
    yardageOverlay: null,
    clubUsed: null,
    windCondition: null,
    strategyNote: null,
    handicapRange: null,
    datePlayedAt: null,
    rankScore: 1 / Math.pow(2, 1.3),
    clipLat: null,
    clipLng: null,
    tripId: null,
    tripPublic: true,
    moderationStatus: "APPROVED",
    likeCount: 0,
    commentCount: 0,
    viewCount: 0,
    saveCount: 0,
    createdAt: UPLOAD_TS,
    updatedAt: UPLOAD_TS,
  });
  if (insErr) throw insErr;
  console.log("✓ Upload row inserted:", uploadId);

  // 4. Auto-link to a Round (one per user/course/date)
  const dateStr = UPLOAD_TS.split("T")[0];
  const { data: existingRound } = await sb
    .from("Round")
    .select("id")
    .eq("userId", TAYLOR_ID)
    .eq("courseId", COURSE_ID)
    .eq("date", dateStr)
    .maybeSingle();
  let roundId;
  if (existingRound) {
    roundId = existingRound.id;
    console.log("✓ Found existing Round:", roundId);
  } else {
    roundId = randomUUID();
    const { error: rErr } = await sb.from("Round").insert({
      id: roundId,
      userId: TAYLOR_ID,
      courseId: COURSE_ID,
      date: dateStr,
      createdAt: UPLOAD_TS,
      updatedAt: UPLOAD_TS,
    });
    if (rErr) throw rErr;
    console.log("✓ Created Round:", roundId);
  }
  await sb.from("Upload").update({ roundId }).eq("id", uploadId);

  // 5. Bump Course.uploadCount
  const { data: c } = await sb.from("Course").select("uploadCount").eq("id", COURSE_ID).single();
  await sb.from("Course").update({ uploadCount: (c?.uploadCount || 0) + 1 }).eq("id", COURSE_ID);
  console.log("✓ Course.uploadCount: " + (c?.uploadCount || 0) + " → " + ((c?.uploadCount || 0) + 1));

  // 6. Bump User.uploadCount
  const { data: u } = await sb.from("User").select("uploadCount").eq("id", TAYLOR_ID).single();
  await sb.from("User").update({ uploadCount: (u?.uploadCount || 0) + 1 }).eq("id", TAYLOR_ID);
  console.log("✓ User.uploadCount: " + (u?.uploadCount || 0) + " → " + ((u?.uploadCount || 0) + 1));

  console.log("\nDone. Taylor's upload should appear at:");
  console.log(`  https://www.touritgolf.com/profile/${TAYLOR_ID}`);
}

main().catch(err => { console.error(err); process.exit(1); });
