/**
 * Cleanup Manual Seed — Tour It
 *
 * Finds courses that were manually seeded (no lat/lng) and:
 *   1. Deletes those with zero uploads — safe, OSM re-import will recreate them with lat/lng
 *   2. Prints courses with uploads that were KEPT — you'll need to handle those manually
 *
 * After running this, re-run: node src/scripts/seed-osm-courses.mjs
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("🏌️  Tour It — Manual Seed Cleanup");
  console.log("=====================================\n");

  // 1. Find all courses with no lat/lng (manually seeded)
  const { data: nullLatCourses, error } = await supabase
    .from("Course")
    .select("id, name, city, state, uploadCount, slug")
    .is("latitude", null)
    .order("uploadCount", { ascending: false });

  if (error) {
    console.error("Failed to fetch courses:", error.message);
    process.exit(1);
  }

  if (!nullLatCourses || nullLatCourses.length === 0) {
    console.log("✓ No courses with missing lat/lng found — nothing to clean up.");
    return;
  }

  console.log(`Found ${nullLatCourses.length} courses with no lat/lng (manually seeded):\n`);

  const toDelete = nullLatCourses.filter(c => c.uploadCount === 0);
  const toKeep   = nullLatCourses.filter(c => c.uploadCount > 0);

  // 2. Report courses with uploads that we can't delete
  if (toKeep.length > 0) {
    console.log(`⚠️  ${toKeep.length} course(s) have uploads — KEEPING THEM (won't delete):`);
    toKeep.forEach(c => console.log(`   • ${c.name} (${c.city}, ${c.state}) — ${c.uploadCount} clip(s)`));
    console.log();
  }

  // 3. Delete courses with zero uploads
  console.log(`🗑️  Deleting ${toDelete.length} empty manually-seeded courses...`);

  if (toDelete.length === 0) {
    console.log("   None to delete.");
  } else {
    const ids = toDelete.map(c => c.id);

    // Delete Holes first (foreign key constraint)
    const { error: holeErr } = await supabase
      .from("Hole")
      .delete()
      .in("courseId", ids);

    if (holeErr) {
      console.error("Failed to delete holes:", holeErr.message);
      process.exit(1);
    }

    // Delete Courses
    const { error: courseErr } = await supabase
      .from("Course")
      .delete()
      .in("id", ids);

    if (courseErr) {
      console.error("Failed to delete courses:", courseErr.message);
      process.exit(1);
    }

    console.log(`   ✓ Deleted ${toDelete.length} courses and their holes.\n`);

    // Show a sample of what was deleted
    const sample = toDelete.slice(0, 10);
    sample.forEach(c => console.log(`   ✓ ${c.name} (${c.city}, ${c.state})`));
    if (toDelete.length > 10) console.log(`   ... and ${toDelete.length - 10} more`);
  }

  console.log("\n✅ Done.\n");
  console.log("Next step: re-run the OSM import to restore these with proper lat/lng:");
  console.log("   node src/scripts/seed-osm-courses.mjs\n");

  if (toKeep.length > 0) {
    console.log(`Note: ${toKeep.length} course(s) with existing clips still have no lat/lng.`);
    console.log("After re-running OSM, those course pages will work fine — they just won't appear in 'Courses Near Me' until we patch their coordinates.");
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
