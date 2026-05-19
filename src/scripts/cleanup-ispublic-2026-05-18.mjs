/**
 * One-shot cleanup (2026-05-18) for the historical `isPublic` / `courseType` conflation.
 *
 * Background: seed scripts set `isPublic=false` on private clubs, conflating the
 * admin-moderation "hide from listings" flag with the user-facing course access
 * type. This hid 690 legitimate courses (incl. Boca Grove, Sleepy Hollow CC,
 * Fishers Island, National Golf Links) from search.
 *
 * After this script: `isPublic` means "admin chose to hide this record"; the
 * user-facing access type lives in `courseType` (PUBLIC | SEMI_PRIVATE | PRIVATE).
 *
 * Idempotent. Safe to re-run.
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Known true-duplicate hides from src/scripts/seed-region-bulk.mjs:10-14.
// These should remain isPublic=false because they are duplicate rows of other
// listed courses, not because of access-type semantics.
const KEEP_HIDDEN = [
  "0089d1f7-336b-4b97-9d0b-8627ea855718", // Quaker Ridge dup of 444a627b
  "16e9dd33-0d7b-4958-93f3-5063fa122144", // Saxon Woods dup of e4de2fa4
  "f90a8422-b5e4-4540-9950-1904bd95daf1", // Sunningdale dup of 3b5d99e5
];

const { count: before } = await sb.from("Course").select("*", { count: "exact", head: true }).eq("isPublic", false);
console.log(`Before: ${before} courses with isPublic=false`);

const { data: flipped, error } = await sb
  .from("Course")
  .update({ isPublic: true, updatedAt: new Date().toISOString() })
  .eq("isPublic", false)
  .not("id", "in", `(${KEEP_HIDDEN.map(id => `"${id}"`).join(",")})`)
  .select("id");

if (error) { console.error(error); process.exit(1); }

const { count: after } = await sb.from("Course").select("*", { count: "exact", head: true }).eq("isPublic", false);
console.log(`Flipped to isPublic=true: ${flipped?.length ?? 0} courses`);
console.log(`After:  ${after} courses with isPublic=false (should be ${KEEP_HIDDEN.length} — preserved duplicates)`);
