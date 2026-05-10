#!/usr/bin/env node

/**
 * Phase 1 — Issue 4b execute
 * Merge Kiawah Ocean Course duplicate into the canonical row, then hard-delete dup.
 *
 * Keeper (canonical): 647bbdcd-23ac-4105-9825-1eea55d2222b
 *   "Kiawah Island Golf Resort - The Ocean Course"
 *   Has: description, courseType, year, website, phone, zip, lat/lng, 18 Holes, 0 dependents
 *   Lacks: coverImageUrl, logoUrl
 *
 * Dupe: a3edabfe-b2d6-4343-a309-4ae71f178e1b
 *   "Kiawah Island Ocean Course"
 *   Has: coverImageUrl, logoUrl, 18 Holes, 18 TeeBoxes, 1 Upload, 1 Save
 *
 * Strategy:
 *   1. Copy coverImageUrl + logoUrl from dupe → keeper (only if keeper has null)
 *   2. Repoint dupe's Save (courseId-only FK) to keeper
 *   3. For dupe's Upload: find matching Hole (by holeNumber) on keeper, repoint courseId + holeId
 *   4. Delete dupe's TeeBoxes (metadata, keeper will get its own as users add)
 *   5. Delete dupe's Holes
 *   6. Delete dupe Course row
 *   7. Verify only one Ocean Course row exists
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const KEEPER = "647bbdcd-23ac-4105-9825-1eea55d2222b";
const DUPE   = "a3edabfe-b2d6-4343-a309-4ae71f178e1b";

async function main() {
  // ── 1. Copy image fields from dupe → keeper if keeper is null ──────────────
  const { data: keeper } = await supabase.from("Course").select("coverImageUrl, logoUrl").eq("id", KEEPER).single();
  const { data: dupe }   = await supabase.from("Course").select("coverImageUrl, logoUrl").eq("id", DUPE).single();

  const updates = {};
  if (!keeper.coverImageUrl && dupe.coverImageUrl) updates.coverImageUrl = dupe.coverImageUrl;
  if (!keeper.logoUrl && dupe.logoUrl) updates.logoUrl = dupe.logoUrl;
  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date().toISOString();
    const { error } = await supabase.from("Course").update(updates).eq("id", KEEPER);
    if (error) throw new Error(`Image copy failed: ${error.message}`);
    console.log(`✅ Copied to keeper: ${Object.keys(updates).filter(k=>k!=="updatedAt").join(", ")}`);
  } else {
    console.log("⏭  Keeper already has image fields, no copy needed");
  }

  // ── 2. Repoint Save (courseId-only) ────────────────────────────────────────
  const { error: saveErr, count: saveCount } = await supabase
    .from("Save")
    .update({ courseId: KEEPER })
    .eq("courseId", DUPE)
    .select("id", { count: "exact", head: true });
  if (saveErr) throw new Error(`Save repoint failed: ${saveErr.message}`);
  console.log(`✅ Save rows repointed: ${saveCount ?? "?"}`);

  // ── 3. Repoint Upload (courseId + holeId via holeNumber map) ──────────────
  const { data: dupeUploads } = await supabase
    .from("Upload")
    .select("id, holeId")
    .eq("courseId", DUPE);

  if (dupeUploads && dupeUploads.length > 0) {
    // Get keeper's holes and dupe's holes for holeNumber mapping
    const { data: keeperHoles } = await supabase.from("Hole").select("id, holeNumber").eq("courseId", KEEPER);
    const { data: dupeHoles }   = await supabase.from("Hole").select("id, holeNumber").eq("courseId", DUPE);
    const dupeHoleById = Object.fromEntries(dupeHoles.map((h) => [h.id, h.holeNumber]));
    const keeperHoleByNum = Object.fromEntries(keeperHoles.map((h) => [h.holeNumber, h.id]));

    for (const u of dupeUploads) {
      const holeNum = u.holeId ? dupeHoleById[u.holeId] : null;
      const newHoleId = holeNum ? keeperHoleByNum[holeNum] : null;
      const upd = { courseId: KEEPER };
      if (newHoleId) upd.holeId = newHoleId;
      const { error } = await supabase.from("Upload").update(upd).eq("id", u.id);
      if (error) throw new Error(`Upload ${u.id} repoint failed: ${error.message}`);
    }
    console.log(`✅ Upload rows repointed: ${dupeUploads.length} (holeId remapped by holeNumber)`);
  } else {
    console.log("⏭  No uploads on dupe");
  }

  // Other tables: View, CourseContribution, CourseFieldContribution
  for (const tbl of ["View", "CourseContribution", "CourseFieldContribution"]) {
    const { error, count } = await supabase
      .from(tbl)
      .update({ courseId: KEEPER })
      .eq("courseId", DUPE)
      .select("id", { count: "exact", head: true });
    if (error) throw new Error(`${tbl} repoint failed: ${error.message}`);
    if (count) console.log(`✅ ${tbl} rows repointed: ${count}`);
  }

  // ── 4. Delete dupe TeeBoxes (metadata, will be recreated by users) ─────────
  const { error: tbErr, count: tbCount } = await supabase
    .from("TeeBox")
    .delete({ count: "exact" })
    .eq("courseId", DUPE);
  if (tbErr) throw new Error(`TeeBox delete failed: ${tbErr.message}`);
  console.log(`✅ TeeBoxes deleted from dupe: ${tbCount}`);

  // ── 5. Delete dupe Holes ───────────────────────────────────────────────────
  const { error: holeErr, count: holeCount } = await supabase
    .from("Hole")
    .delete({ count: "exact" })
    .eq("courseId", DUPE);
  if (holeErr) throw new Error(`Hole delete failed: ${holeErr.message}`);
  console.log(`✅ Holes deleted from dupe: ${holeCount}`);

  // ── 6. Delete dupe Course ──────────────────────────────────────────────────
  const { error: courseErr } = await supabase.from("Course").delete().eq("id", DUPE);
  if (courseErr) throw new Error(`Course delete failed: ${courseErr.message}`);
  console.log(`✅ Dupe Course row deleted`);

  // ── 7. Verify ──────────────────────────────────────────────────────────────
  const { data: ocean } = await supabase
    .from("Course")
    .select("id, name, city, state")
    .ilike("name", "%Ocean Course%")
    .order("name");
  console.log("\nVerification — Course rows matching '%Ocean Course%':");
  ocean?.forEach((r) => console.log(`  ${r.name} — ${r.city}, ${r.state}  [${r.id}]`));
}

main().catch((err) => {
  console.error("✗ Fatal:", err.message);
  process.exit(1);
});
