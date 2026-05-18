// Audit existing UploadTag rows to see how many clips have:
//   - 0 approved tags
//   - 1 approved tag (clean single-co-star case)
//   - 2+ approved tags (multi-tag case that needs a tiebreaker)
//
// Helps decide the migration strategy: how many multi-tag clips
// exist in the wild, and which users + clips are affected.
//
// Usage: node src/scripts/audit-cost-tags.mjs

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
  console.log("\n🔍 UploadTag audit — counts + multi-tag clip details\n");

  const tags = await fetchAll("UploadTag", "id, uploadId, userId, approved, isHero, createdAt");
  console.log(`Total UploadTag rows: ${tags.length}`);
  const approved = tags.filter(t => t.approved === true);
  const pending = tags.filter(t => t.approved === null);
  const denied = tags.filter(t => t.approved === false);
  const heroTags = tags.filter(t => t.isHero === true);
  console.log(`  approved: ${approved.length}`);
  console.log(`  pending:  ${pending.length}`);
  console.log(`  denied:   ${denied.length}`);
  console.log(`  already hero (isHero=true): ${heroTags.length}`);

  // Group approved tags by uploadId
  const byUpload = new Map();
  for (const t of approved) {
    if (!byUpload.has(t.uploadId)) byUpload.set(t.uploadId, []);
    byUpload.get(t.uploadId).push(t);
  }

  const single = [];
  const multi = [];
  for (const [uploadId, ts] of byUpload) {
    if (ts.length === 1) single.push(uploadId);
    else multi.push({ uploadId, tags: ts });
  }

  console.log(`\nApproved-tag clip breakdown:`);
  console.log(`  Clips with 1 approved co-star:   ${single.length}`);
  console.log(`  Clips with 2+ approved co-stars: ${multi.length}`);

  if (multi.length > 0) {
    console.log(`\n=== Multi-tag clips (need a tiebreaker for hero) ===`);
    const userIds = [...new Set(multi.flatMap(m => m.tags.map(t => t.userId)))];
    const uploadIds = multi.map(m => m.uploadId);

    const [{ data: users }, { data: uploads }] = await Promise.all([
      sb.from("User").select("id, username, displayName").in("id", userIds),
      sb.from("Upload").select("id, userId, courseId, holeId, createdAt").in("id", uploadIds),
    ]);
    const userMap = new Map((users || []).map(u => [u.id, u]));
    const uploadMap = new Map((uploads || []).map(u => [u.id, u]));

    const courseIds = [...new Set((uploads || []).map(u => u.courseId))];
    const ownerIds = [...new Set((uploads || []).map(u => u.userId))];
    const [{ data: courses }, { data: owners }, { data: holes }] = await Promise.all([
      sb.from("Course").select("id, name").in("id", courseIds),
      sb.from("User").select("id, username").in("id", ownerIds),
      sb.from("Hole").select("id, holeNumber").in("id", (uploads || []).map(u => u.holeId).filter(Boolean)),
    ]);
    const courseMap = new Map((courses || []).map(c => [c.id, c]));
    const ownerMap = new Map((owners || []).map(u => [u.id, u]));
    const holeMap = new Map((holes || []).map(h => [h.id, h]));

    for (const m of multi) {
      const up = uploadMap.get(m.uploadId);
      const course = up ? courseMap.get(up.courseId) : null;
      const hole = up ? holeMap.get(up.holeId) : null;
      const owner = up ? ownerMap.get(up.userId) : null;
      m.tags.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const tagNames = m.tags.map(t => userMap.get(t.userId)?.username || t.userId.slice(0, 8));
      console.log(`  ${course?.name ?? "?"} — Hole ${hole?.holeNumber ?? "?"} (uploader @${owner?.username ?? "?"})`);
      console.log(`    tagged: ${tagNames.join(", ")} (chronological)`);
    }
  }

  console.log("\nDone.");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
