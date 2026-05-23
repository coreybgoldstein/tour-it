// One-off: clean up the four orphan files surfaced by
// find-orphan-uploads.mjs on 2026-05-23.
//
// Actions:
//   - Delete @mzl51093's two photos (their target course no longer exists)
//   - Delete @corey's 22KB photo (incomplete / corrupted upload)
//   - Recover @jtjuicer86's Rock Spring Hole 16 photo by inserting an
//     Upload row pointing at the existing storage file
//
// Idempotent: re-running after success is a no-op (deletes succeed on
// already-missing files, recovery checks for an existing Upload row).
//
// Run: node src/scripts/cleanup-orphan-uploads-2026-05-23.mjs

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const BUCKET = "tour-it-photos";

const TO_DELETE = [
  "5cdea51c-a70e-48b8-87d8-39e84e691b65/a3edabfe-b2d6-4343-a309-4ae71f178e1b/2/1773631571013.jpg",
  "5cdea51c-a70e-48b8-87d8-39e84e691b65/a3edabfe-b2d6-4343-a309-4ae71f178e1b/2/1773631575507.jpg",
  "5d2dd909-65a6-44e8-8bd4-94419f7622d9/bef620c6-48f3-456e-a1c4-7d096303bb34/1/1778599878453.jpeg",
];

const RECOVER = {
  userId: "79935096-b2bb-4e5f-8402-3a597f5273c9",         // @jtjuicer86
  courseId: "e661e992-8ba6-4d79-8cae-67b8c2f3383d",       // Rock Spring Golf Club at West Orange
  holeId: "cf5e0c82-2c64-43f4-a20a-26d57d639abc",         // Hole 16
  filename: "1776119098162.jpeg",
  uploadTs: "2026-04-13T22:25:00.701Z",                   // storage file creation time
};

async function deleteOrphans() {
  console.log(`Deleting ${TO_DELETE.length} orphan files…`);
  const { data, error } = await sb.storage.from(BUCKET).remove(TO_DELETE);
  if (error) {
    console.error("delete error:", error.message);
    return;
  }
  console.log(`  ✓ Removed ${data?.length || 0} files`);
}

async function recoverJtjuicer86() {
  const storagePath = `${RECOVER.userId}/${RECOVER.courseId}/16/${RECOVER.filename}`;
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(storagePath);
  const mediaUrl = pub.publicUrl;

  // Idempotency
  const { data: existing } = await sb
    .from("Upload")
    .select("id")
    .eq("userId", RECOVER.userId)
    .eq("mediaUrl", mediaUrl)
    .maybeSingle();
  if (existing) {
    console.log(`\n✓ @jtjuicer86 recovery already done: ${existing.id}`);
    return;
  }

  console.log(`\nRecovering @jtjuicer86's Rock Spring Hole 16 photo…`);
  const uploadId = randomUUID();
  const { error: insErr } = await sb.from("Upload").insert({
    id: uploadId,
    userId: RECOVER.userId,
    courseId: RECOVER.courseId,
    holeId: RECOVER.holeId,
    mediaType: "PHOTO",
    mediaUrl,
    cloudflareVideoId: null,
    teeBoxId: null,
    shotType: null,
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
    createdAt: RECOVER.uploadTs,
    updatedAt: RECOVER.uploadTs,
  });
  if (insErr) throw insErr;
  console.log(`  ✓ Upload row inserted: ${uploadId}`);

  // Auto-link to Round
  const dateStr = RECOVER.uploadTs.split("T")[0];
  const { data: existingRound } = await sb
    .from("Round")
    .select("id")
    .eq("userId", RECOVER.userId)
    .eq("courseId", RECOVER.courseId)
    .eq("date", dateStr)
    .maybeSingle();
  let roundId;
  if (existingRound) {
    roundId = existingRound.id;
    console.log(`  ✓ Found existing Round: ${roundId}`);
  } else {
    roundId = randomUUID();
    await sb.from("Round").insert({
      id: roundId,
      userId: RECOVER.userId,
      courseId: RECOVER.courseId,
      date: dateStr,
      createdAt: RECOVER.uploadTs,
      updatedAt: RECOVER.uploadTs,
    });
    console.log(`  ✓ Created Round: ${roundId}`);
  }
  await sb.from("Upload").update({ roundId }).eq("id", uploadId);

  // Bump counters
  const { data: c } = await sb.from("Course").select("uploadCount").eq("id", RECOVER.courseId).single();
  await sb.from("Course").update({ uploadCount: (c?.uploadCount || 0) + 1 }).eq("id", RECOVER.courseId);
  const { data: u } = await sb.from("User").select("uploadCount").eq("id", RECOVER.userId).single();
  await sb.from("User").update({ uploadCount: (u?.uploadCount || 0) + 1 }).eq("id", RECOVER.userId);
  const { data: h } = await sb.from("Hole").select("uploadCount").eq("id", RECOVER.holeId).single();
  await sb.from("Hole").update({ uploadCount: (h?.uploadCount || 0) + 1 }).eq("id", RECOVER.holeId);
  console.log(`  ✓ Counters bumped (course/user/hole)`);
}

async function main() {
  await deleteOrphans();
  await recoverJtjuicer86();
  console.log("\nDone.");
}

main().catch(err => { console.error(err); process.exit(1); });
