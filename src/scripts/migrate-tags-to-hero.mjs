// One-time migration script run when co-star tagging was retired in favor
// of hero-only tagging.
//
// What it does:
//   1. Flips isHero=true on every existing UploadTag row (so pending
//      notifications render the hero approve/decline buttons instead of
//      the old co-star ones).
//   2. For every APPROVED tag, auto-transfers Upload.userId to the tagged
//      user immediately. uploadedByUserId is stamped with the original
//      uploader so the "uploaded by @x" attribution chip renders on the
//      clip everywhere.
//   3. For PENDING tags: no transfer (consent not yet given). The hero
//      notification UI will let the user choose [Yes, this is my shot]
//      or [Not me] from their inbox.
//
// Idempotent — safe to re-run. Already-hero or already-transferred rows
// are skipped via guarded updates.
//
// Usage: node src/scripts/migrate-tags-to-hero.mjs

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
  console.log("\n🔁  Migrating UploadTag rows from co-star → hero\n");

  const tags = await fetchAll("UploadTag", "id, uploadId, userId, approved, isHero, createdAt");
  console.log(`Loaded ${tags.length} UploadTag rows`);

  const needsHeroFlag = tags.filter(t => t.isHero !== true);
  const approvedTags = tags.filter(t => t.approved === true);

  // 1. Flip isHero=true on everything that isn't already hero
  if (needsHeroFlag.length > 0) {
    console.log(`\nFlipping isHero=true on ${needsHeroFlag.length} tags...`);
    const ids = needsHeroFlag.map(t => t.id);
    // Update in chunks to stay polite
    const CHUNK = 100;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { error } = await sb.from("UploadTag").update({ isHero: true }).in("id", slice);
      if (error) throw new Error(`UploadTag.isHero update: ${error.message}`);
    }
    console.log(`✅ ${needsHeroFlag.length} tag rows now isHero=true`);
  } else {
    console.log("✅ All tags already isHero=true (nothing to flip)");
  }

  // 2. Auto-transfer ownership on approved tags
  console.log(`\nAuto-transferring ownership for ${approvedTags.length} approved tags...`);
  let transferred = 0;
  let skipped = 0;
  for (const t of approvedTags) {
    const { data: upload } = await sb
      .from("Upload")
      .select("userId, uploadedByUserId")
      .eq("id", t.uploadId)
      .maybeSingle();
    if (!upload) { console.warn(`  skip: upload ${t.uploadId} not found`); skipped++; continue; }
    if (upload.userId === t.userId) {
      // Already owned by the tagged user (likely a prior transfer)
      skipped++;
      continue;
    }
    const originalUploader = upload.uploadedByUserId ?? upload.userId;
    const { error } = await sb
      .from("Upload")
      .update({ userId: t.userId, uploadedByUserId: originalUploader, updatedAt: new Date().toISOString() })
      .eq("id", t.uploadId);
    if (error) { console.warn(`  failed: ${t.uploadId} — ${error.message}`); continue; }
    transferred++;
    console.log(`  transferred ${t.uploadId} → ${t.userId} (was ${originalUploader})`);
  }

  console.log(`\n✅ ${transferred} clips transferred, ${skipped} skipped (already owned or missing)`);

  // 3. Summary
  const pendingHeroTags = tags.filter(t => t.approved === null);
  console.log(`\n📨  ${pendingHeroTags.length} pending tags remain — those users will see hero approve/decline buttons in their notifications. Ownership transfers when they tap "Yes, this is my shot".`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
