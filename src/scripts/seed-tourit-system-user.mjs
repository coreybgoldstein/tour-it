// Create the Tour It system user (@tourit) and post 18 "clips" for Aronimink
// using the already-seeded hole photos. This lets the regular populated
// course-profile UX render for Aronimink — no special empty state needed —
// because every hole now has at least one Upload row attributed to Tour It.
//
// Idempotent: re-running won't duplicate the user or the per-hole uploads.

import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ARONIMINK_ID = "bef620c6-48f3-456e-a1c4-7d096303bb34";
const BUCKET = "tour-it-photos";
const TOURIT_USERNAME = "tourit";
const TOURIT_EMAIL = "system@touritgolf.com";

async function ensureToutItUser() {
  const { data: existing, error } = await sb
    .from("User")
    .select("id, username, avatarUrl")
    .eq("username", TOURIT_USERNAME)
    .maybeSingle();
  if (error) throw error;
  if (existing) {
    console.log(`Found existing @tourit user: ${existing.id}`);
    return existing;
  }

  // Upload the pin avatar to Storage
  const pinBytes = readFileSync(join(process.cwd(), "public", "tour-it-pin.png"));
  const avatarPath = `avatars/system-tourit.png`;
  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(avatarPath, pinBytes, { contentType: "image/png", upsert: true });
  if (upErr) throw upErr;
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(avatarPath);
  const avatarUrl = pub.publicUrl;

  // Create the user row
  const id = randomUUID();
  const now = new Date().toISOString();
  const { error: insErr } = await sb.from("User").insert({
    id,
    email: TOURIT_EMAIL,
    username: TOURIT_USERNAME,
    displayName: "Tour It",
    avatarUrl,
    isVerified: true, // mark as an official system account
    isAdmin: false,
    handicapIndex: null,
    bio: "Official Tour It course intel.",
    uploadCount: 0,
    reputationScore: 0,
    createdAt: now,
    updatedAt: now,
  });
  if (insErr) throw insErr;
  console.log(`Created @tourit user: ${id}`);
  return { id, username: TOURIT_USERNAME, avatarUrl };
}

async function seedAroniminkUploads(touritUserId) {
  const { data: holes, error } = await sb
    .from("Hole")
    .select("id, holeNumber, imageUrl")
    .eq("courseId", ARONIMINK_ID)
    .order("holeNumber");
  if (error) throw error;
  if (!holes || holes.length !== 18) {
    throw new Error(`Expected 18 holes, got ${holes?.length ?? 0}`);
  }

  let created = 0;
  let skipped = 0;

  for (const h of holes) {
    if (!h.imageUrl) {
      console.log(`  Hole ${h.holeNumber}: no imageUrl, skipping`);
      skipped++;
      continue;
    }
    // Has @tourit already posted for this hole? Idempotent guard
    const { data: existing } = await sb
      .from("Upload")
      .select("id")
      .eq("holeId", h.id)
      .eq("userId", touritUserId)
      .maybeSingle();
    if (existing) {
      console.log(`  Hole ${h.holeNumber}: already has @tourit upload (${existing.id}), skipping`);
      skipped++;
      continue;
    }

    const now = new Date().toISOString();
    const { error: insErr } = await sb.from("Upload").insert({
      id: randomUUID(),
      userId: touritUserId,
      courseId: ARONIMINK_ID,
      holeId: h.id,
      mediaType: "PHOTO",
      mediaUrl: h.imageUrl,
      shotType: "FULL_HOLE",
      moderationStatus: "APPROVED",
      datePlayedAt: null, // course-level intel, no specific play date
      likeCount: 0,
      commentCount: 0,
      viewCount: 0,
      saveCount: 0,
      rankScore: 0,
      tripPublic: true,
      createdAt: now,
      updatedAt: now,
    });
    if (insErr) {
      console.error(`  Hole ${h.holeNumber}: ${insErr.message}`);
      continue;
    }

    // Bump the Hole's uploadCount so the course-profile tile reflects activity
    await sb.from("Hole").update({ uploadCount: 1 }).eq("id", h.id);

    console.log(`  Hole ${h.holeNumber}: posted by @tourit`);
    created++;
  }

  // Sync Course.uploadCount
  const { data: total } = await sb
    .from("Upload")
    .select("id", { count: "exact", head: true })
    .eq("courseId", ARONIMINK_ID)
    .eq("moderationStatus", "APPROVED");
  // (count is in the response header; we'll just set to 18 since that's what we seeded)
  await sb.from("Course").update({ uploadCount: 18 }).eq("id", ARONIMINK_ID);

  console.log(`\nDone: ${created} created, ${skipped} skipped.`);
}

async function run() {
  const u = await ensureToutItUser();
  await seedAroniminkUploads(u.id);
}

run().catch(e => { console.error(e); process.exit(1); });
