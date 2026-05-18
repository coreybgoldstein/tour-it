// Backfill existing clip_tag Notification.linkUrl values to deep-link to
// the specific clip's hole-page instead of just the course page. Run
// once after the notification-thumbnail feature ships so legacy pending
// notifications also route correctly when the user taps the preview.
//
// New format: /courses/{courseId}/holes/{holeNumber}?clip={uploadId}
// Old format: /courses/{courseId}
//
// Idempotent — already-deep-linked notifications are skipped.
//
// Usage: node src/scripts/backfill-tag-notification-links.mjs

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function fetchAll(table, columns, filterFn) {
  const PAGE = 1000;
  const all = [];
  let from = 0;
  for (;;) {
    let q = sb.from(table).select(columns).range(from, from + PAGE - 1);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  console.log("\n🔁  Backfilling clip_tag notification linkUrls to deep clip links\n");

  const notifs = await fetchAll(
    "Notification",
    "id, userId, type, linkUrl, referenceId",
    (q) => q.eq("type", "clip_tag").not("referenceId", "is", null)
  );
  console.log(`Found ${notifs.length} clip_tag notifications with a referenceId`);

  // Anything that already has a /holes/ segment is deep-linked — skip
  const needsUpdate = notifs.filter(n => !n.linkUrl || !n.linkUrl.includes("/holes/"));
  console.log(`  ${needsUpdate.length} need deep-link backfill`);

  if (needsUpdate.length === 0) {
    console.log("Nothing to do. All clip_tag links are already deep-linked.");
    return;
  }

  // Resolve uploadId → (courseId, holeId)
  const uploadIds = [...new Set(needsUpdate.map(n => n.referenceId))];
  const uploadRows = [];
  for (let i = 0; i < uploadIds.length; i += 200) {
    const chunk = uploadIds.slice(i, i + 200);
    const { data } = await sb.from("Upload").select("id, courseId, holeId").in("id", chunk);
    if (data) uploadRows.push(...data);
  }
  const uploadById = new Map(uploadRows.map(u => [u.id, u]));

  // Resolve holeId → holeNumber
  const holeIds = [...new Set(uploadRows.map(u => u.holeId).filter(Boolean))];
  const holeRows = [];
  for (let i = 0; i < holeIds.length; i += 200) {
    const chunk = holeIds.slice(i, i + 200);
    const { data } = await sb.from("Hole").select("id, holeNumber").in("id", chunk);
    if (data) holeRows.push(...data);
  }
  const holeNumberById = new Map(holeRows.map(h => [h.id, h.holeNumber]));

  // Build patches
  let updated = 0;
  let skipped = 0;
  for (const n of needsUpdate) {
    const upload = uploadById.get(n.referenceId);
    if (!upload) { skipped++; continue; }
    const holeNumber = holeNumberById.get(upload.holeId);
    if (!holeNumber) { skipped++; continue; }
    const newLink = `/courses/${upload.courseId}/holes/${holeNumber}?clip=${n.referenceId}`;
    const { error } = await sb.from("Notification").update({ linkUrl: newLink }).eq("id", n.id);
    if (error) { console.warn(`  failed ${n.id}: ${error.message}`); continue; }
    updated++;
  }

  console.log(`\n✅ Updated ${updated} notification linkUrls`);
  if (skipped > 0) console.log(`   ${skipped} skipped (upload or hole row missing)`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
