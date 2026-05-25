// One-off: nuke a set of test users completely.
//
// Mirrors src/app/api/user/delete/route.ts cascade order but operates
// on a hardcoded username list instead of the auth.getUser() identity.
// Service-role only — never expose this as an HTTP endpoint.
//
// Usage:
//   node src/scripts/delete-test-users.mjs            # dry run (default)
//   node src/scripts/delete-test-users.mjs --execute  # actually delete
//
// The dry-run prints what would be deleted and bails out before any
// destructive call. --execute is required to actually perform the work.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const TARGET_USERNAMES = ["scottietest", "rory", "testtest", "test"];
const EXECUTE = process.argv.includes("--execute");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─────────────────────────────────────────────────────────────────────
// Resolve usernames → user IDs (and surface email so the operator can
// eyeball whether they're the right accounts before --execute).
// ─────────────────────────────────────────────────────────────────────
const { data: users, error: lookupErr } = await admin
  .from("User")
  .select("id, username, displayName, email")
  .in("username", TARGET_USERNAMES);
if (lookupErr) {
  console.error("Lookup failed:", lookupErr.message);
  process.exit(1);
}
if (!users || users.length === 0) {
  console.error("No matching users found. Targets:", TARGET_USERNAMES);
  process.exit(1);
}

console.log("Resolved targets:");
for (const u of users) {
  console.log(`  • @${u.username}  ${u.displayName ?? ""}  <${u.email ?? "no-email"}>  id=${u.id}`);
}
const missing = TARGET_USERNAMES.filter(n => !users.some(u => u.username === n));
if (missing.length) {
  console.warn("⚠ Not found in DB (skipping):", missing.join(", "));
}

if (!EXECUTE) {
  console.log("\nDry run only. Re-run with --execute to perform the deletes.");
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────
// Cascade per user. Same step order as /api/user/delete — any failure
// is logged and we continue so a partial failure leaves the smallest
// possible footprint.
// ─────────────────────────────────────────────────────────────────────
async function tryStep(label, fn) {
  try { await fn(); console.log(`  ✓ ${label}`); }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${label}: ${msg}`);
  }
}

async function deleteUser(uid, username) {
  console.log(`\n── Deleting @${username} (${uid}) ──`);

  // Phase 1 — engagement on others' content
  await tryStep("Like (by user)",         () => admin.from("Like").delete().eq("userId", uid));
  await tryStep("Comment (by user)",      () => admin.from("Comment").delete().eq("userId", uid));
  await tryStep("View (by user)",         () => admin.from("View").delete().eq("userId", uid));
  await tryStep("Save (by user)",         () => admin.from("Save").delete().eq("userId", uid));
  await tryStep("UploadTag (by user)",    () => admin.from("UploadTag").delete().eq("userId", uid));
  await tryStep("UploadPhoto (by user)",  () => admin.from("UploadPhoto").delete().eq("userId", uid));

  // Phase 2 — moderation reports
  await tryStep("ModerationReport (filed by)",      () => admin.from("ModerationReport").delete().eq("reportedById", uid));
  await tryStep("ModerationReport (filed against)", () => admin.from("ModerationReport").delete().eq("reportedUserId", uid));

  // Phase 3 — social graph
  await tryStep("Follow (as follower)",  () => admin.from("Follow").delete().eq("followerId", uid));
  await tryStep("Follow (as following)", () => admin.from("Follow").delete().eq("followingId", uid));

  // Phase 4 — referrals
  await tryStep("Referral (as inviter)",  () => admin.from("Referral").delete().eq("inviterId", uid));
  await tryStep("Referral (as invitee)",  () => admin.from("Referral").delete().eq("inviteeId", uid));

  // Phase 5 — own uploads (clear other users' engagement first)
  const { data: uploads } = await admin.from("Upload").select("id").eq("userId", uid);
  const uploadIds = (uploads ?? []).map(u => u.id);
  if (uploadIds.length > 0) {
    await tryStep("Comment (on user's uploads)",            () => admin.from("Comment").delete().in("uploadId", uploadIds));
    await tryStep("Like (on user's uploads)",               () => admin.from("Like").delete().in("uploadId", uploadIds));
    await tryStep("View (on user's uploads)",               () => admin.from("View").delete().in("uploadId", uploadIds));
    await tryStep("UploadTag (on user's uploads)",          () => admin.from("UploadTag").delete().in("uploadId", uploadIds));
    await tryStep("UploadPhoto (on user's uploads)",        () => admin.from("UploadPhoto").delete().in("uploadId", uploadIds));
    await tryStep("ModerationReport (against uploads)",     () => admin.from("ModerationReport").delete().in("uploadId", uploadIds));
    await tryStep("Notification (referencing uploads)",     () => admin.from("Notification").delete().in("referenceId", uploadIds));
  }
  await tryStep("Upload (by user)", () => admin.from("Upload").delete().eq("userId", uid));

  // Phase 6 — trips and TripGames
  const { data: trips } = await admin.from("GolfTrip").select("id").eq("createdBy", uid);
  const tripIds = (trips ?? []).map(t => t.id);
  if (tripIds.length > 0) {
    await tryStep("GolfTrip (created by user)", () => admin.from("GolfTrip").delete().in("id", tripIds));
  }
  await tryStep("TripGame (created on others' trips)", () => admin.from("TripGame").delete().eq("createdBy", uid));

  // Phase 7 — string-FK misc
  await tryStep("CourseRequest",            () => admin.from("CourseRequest").delete().eq("userId", uid));
  await tryStep("CourseFieldContribution",  () => admin.from("CourseFieldContribution").delete().eq("userId", uid));
  await tryStep("CourseContribution",       () => admin.from("CourseContribution").delete().eq("userId", uid));
  await tryStep("RewardsWaitlist",          () => admin.from("RewardsWaitlist").delete().eq("userId", uid));
  await tryStep("LeaderboardSnapshot",      () => admin.from("LeaderboardSnapshot").delete().eq("userId", uid));
  await tryStep("SearchClick",              () => admin.from("SearchClick").delete().eq("userId", uid));
  await tryStep("SearchLog",                () => admin.from("SearchLog").delete().eq("userId", uid));

  // Phase 8 — progression + notifications + rounds
  await tryStep("Notification",       () => admin.from("Notification").delete().eq("userId", uid));
  await tryStep("UserBadge",          () => admin.from("UserBadge").delete().eq("userId", uid));
  await tryStep("UserPointsLedger",   () => admin.from("UserPointsLedger").delete().eq("userId", uid));
  await tryStep("UserProgression",    () => admin.from("UserProgression").delete().eq("userId", uid));
  await tryStep("Round",              () => admin.from("Round").delete().eq("userId", uid));

  // Phase 9 — User row + auth identity
  await tryStep("User row", () => admin.from("User").delete().eq("id", uid));
  await tryStep("auth.admin.deleteUser", () => admin.auth.admin.deleteUser(uid));
}

for (const u of users) {
  await deleteUser(u.id, u.username);
}

console.log("\nDone.");
