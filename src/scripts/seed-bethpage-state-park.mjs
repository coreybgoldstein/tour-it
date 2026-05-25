// Bethpage State Park Golf Course (Farmingdale, NY) — 5-course seed.
//
// The facility has five 18-hole courses (Black, Red, Blue, Green,
// Yellow). DB state going in:
//   - Black (id ceb95a05) — has UGC (8 clips, 3 rounds, 2 saves).
//     Per-hole data updated in place, ID preserved.
//   - Red (id 95cfb249) — clean. Per-hole data refreshed.
//   - Yellow (id 25f57067) — clean. Per-hole data refreshed.
//   - "Bethpage State Park Golf Courses" junk row (id 130f31c4)
//     with 18 zero-yardage holes + 1 empty placeholder round
//     attached. Round is migrated to Black, then the junk row +
//     its holes are deleted.
//   - Blue, Green — never seeded. Inserted as new Course rows.
//
// Yardage / par / stroke-index data sourced 2026-05-26 from
// golfify.io's __NEXT_DATA__ blob for each course, which mirrors
// the official Bethpage scorecards (cross-validated against the
// USGA NCRDB course/slope ratings). All tips data: golfify Blue tee.
//
// Architect / year per course also from the same source, with
// Yellow corrected to Alfred H. Tull (golfify mis-attributed to
// Tillinghast — Tillinghast died in 1942; Yellow opened 1958, per
// Wikipedia and NY State Parks).
//
// Usage:
//   node src/scripts/seed-bethpage-state-park.mjs            # dry run
//   node src/scripts/seed-bethpage-state-park.mjs --execute  # write

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const EXECUTE = process.argv.includes("--execute");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const JUNK_ROW_ID = "130f31c4-5471-4351-a11d-90f3ad5d8a96";
const BLACK_ID = "ceb95a05-d039-4f2d-ae01-6bdd954d00c1";

// Shared facility metadata. Address per golfify + NY State Parks.
const FACILITY = {
  city: "Farmingdale",
  state: "NY",
  country: "US",
  zipCode: "11735",
  phone: "(516) 249-4040",
  websiteUrl: "https://parks.ny.gov/golf-courses/11/details.aspx",
  courseType: "PUBLIC",
  isPublic: true,
  holeCount: 18,
};

const BLACK = {
  existingId: BLACK_ID, // preserve — has UGC
  name: "Bethpage Black",
  slug: "bethpage-black-golf-course",
  yearEstablished: 1936,
  latitude: 40.7519,
  longitude: -73.4565,
  description:
    "The most famous public golf course in America. A.W. Tillinghast's brutal 1936 routing was restored by Rees Jones for the 2002 U.S. Open (won by Tiger), and it has since hosted a second U.S. Open (2009), the 2019 PGA Championship, and the 2025 Ryder Cup. The Blue tees stretch to 7,468 yards at par 70 with a 78.1 rating and 152 slope — among the hardest setups in public golf. The sign at the first tee says it all: \"Warning: The Black Course is an extremely difficult golf course which we recommend only for highly skilled golfers.\"",
  holes: [
    { par: 4, yardage: 430, handicapRank: 8 },
    { par: 4, yardage: 389, handicapRank: 16 },
    { par: 3, yardage: 230, handicapRank: 18 },
    { par: 5, yardage: 517, handicapRank: 2 },
    { par: 4, yardage: 478, handicapRank: 4 },
    { par: 4, yardage: 408, handicapRank: 10 },
    { par: 4, yardage: 553, handicapRank: 6 },
    { par: 3, yardage: 210, handicapRank: 14 },
    { par: 4, yardage: 460, handicapRank: 12 },
    { par: 4, yardage: 502, handicapRank: 9 },
    { par: 4, yardage: 435, handicapRank: 11 },
    { par: 4, yardage: 501, handicapRank: 7 },
    { par: 5, yardage: 608, handicapRank: 3 },
    { par: 3, yardage: 161, handicapRank: 17 },
    { par: 4, yardage: 478, handicapRank: 1 },
    { par: 4, yardage: 490, handicapRank: 5 },
    { par: 3, yardage: 207, handicapRank: 13 },
    { par: 4, yardage: 411, handicapRank: 15 },
  ],
};

const RED = {
  existingId: "95cfb249-ec57-43e8-8994-a791587b5d83",
  name: "Bethpage Red",
  slug: "bethpage-red-golf-course",
  yearEstablished: 1935,
  latitude: 40.7282,
  longitude: -73.4549,
  description:
    "The locals' favorite of Bethpage's five courses. A.W. Tillinghast's 1935 layout is widely considered the second-best of the quintet — a demanding tree-lined par 70 with a brutal opening stretch (the 471-yard first is the 3rd-hardest hole) and the formidable 565-yard par-5 16th. Plays 7,092 yards from the tips with a 73.4 rating and 129 slope. The grown-up alternative when the Black is booked solid.",
  holes: [
    { par: 4, yardage: 471, handicapRank: 3 },
    { par: 4, yardage: 401, handicapRank: 7 },
    { par: 4, yardage: 390, handicapRank: 11 },
    { par: 3, yardage: 181, handicapRank: 15 },
    { par: 5, yardage: 528, handicapRank: 5 },
    { par: 4, yardage: 350, handicapRank: 9 },
    { par: 3, yardage: 184, handicapRank: 17 },
    { par: 4, yardage: 418, handicapRank: 13 },
    { par: 4, yardage: 466, handicapRank: 1 },
    { par: 4, yardage: 492, handicapRank: 14 },
    { par: 4, yardage: 462, handicapRank: 12 },
    { par: 3, yardage: 208, handicapRank: 16 },
    { par: 4, yardage: 400, handicapRank: 6 },
    { par: 4, yardage: 466, handicapRank: 4 },
    { par: 4, yardage: 482, handicapRank: 2 },
    { par: 5, yardage: 565, handicapRank: 8 },
    { par: 3, yardage: 165, handicapRank: 18 },
    { par: 4, yardage: 463, handicapRank: 10 },
  ],
};

const BLUE = {
  existingId: null,
  name: "Bethpage Blue",
  slug: "bethpage-blue-golf-course",
  yearEstablished: 1935,
  latitude: 40.7416,
  longitude: -73.4536,
  description:
    "A.W. Tillinghast's original 1935 routing, later refined by Alfred Tull. A genuine par 72 at 6,656 yards from the tips — the only par 72 at Bethpage and the friendliest of Tillinghast's three originals. Four par 5s (including a reachable 491-yard fourth) and only four par 3s make this the most birdie-able of the five courses, and a hidden gem that locals book to escape the Black queues.",
  holes: [
    { par: 4, yardage: 437, handicapRank: 9 },
    { par: 4, yardage: 454, handicapRank: 5 },
    { par: 3, yardage: 190, handicapRank: 17 },
    { par: 5, yardage: 491, handicapRank: 7 },
    { par: 4, yardage: 307, handicapRank: 15 },
    { par: 4, yardage: 477, handicapRank: 1 },
    { par: 3, yardage: 186, handicapRank: 11 },
    { par: 5, yardage: 555, handicapRank: 3 },
    { par: 4, yardage: 346, handicapRank: 13 },
    { par: 4, yardage: 381, handicapRank: 14 },
    { par: 3, yardage: 187, handicapRank: 18 },
    { par: 5, yardage: 473, handicapRank: 6 },
    { par: 4, yardage: 362, handicapRank: 8 },
    { par: 4, yardage: 383, handicapRank: 10 },
    { par: 4, yardage: 387, handicapRank: 4 },
    { par: 5, yardage: 501, handicapRank: 2 },
    { par: 3, yardage: 175, handicapRank: 16 },
    { par: 4, yardage: 364, handicapRank: 12 },
  ],
};

const GREEN = {
  existingId: null,
  name: "Bethpage Green",
  slug: "bethpage-green-golf-course",
  yearEstablished: 1923,
  latitude: 40.7460,
  longitude: -73.4625,
  description:
    "The oldest of the five — originally Devereux Emmet's 1923 Lenox Hills Course, taken over by the state and reworked by Tillinghast when Bethpage State Park opened in 1936. 6,378 yards of par 71 with a 70.2 rating and 129 slope. Tighter and tree-lined where Tillinghast's other Bethpage courses are open and rolling — a thinking-player's track that puts a premium on shot shape over raw distance.",
  holes: [
    { par: 4, yardage: 354, handicapRank: 15 },
    { par: 4, yardage: 380, handicapRank: 3 },
    { par: 3, yardage: 153, handicapRank: 17 },
    { par: 4, yardage: 363, handicapRank: 9 },
    { par: 4, yardage: 400, handicapRank: 5 },
    { par: 3, yardage: 190, handicapRank: 11 },
    { par: 5, yardage: 507, handicapRank: 7 },
    { par: 4, yardage: 347, handicapRank: 13 },
    { par: 5, yardage: 560, handicapRank: 1 },
    { par: 4, yardage: 343, handicapRank: 10 },
    { par: 3, yardage: 171, handicapRank: 18 },
    { par: 4, yardage: 291, handicapRank: 16 },
    { par: 5, yardage: 572, handicapRank: 2 },
    { par: 4, yardage: 366, handicapRank: 14 },
    { par: 3, yardage: 207, handicapRank: 12 },
    { par: 4, yardage: 358, handicapRank: 8 },
    { par: 4, yardage: 418, handicapRank: 4 },
    { par: 4, yardage: 398, handicapRank: 6 },
  ],
};

const YELLOW = {
  existingId: "25f57067-7c7c-46a6-a5e7-2d5191defdbd",
  name: "Bethpage Yellow",
  slug: "bethpage-yellow-golf-course",
  yearEstablished: 1958,
  latitude: 40.7416434,
  longitude: -73.4586662,
  description:
    "Alfred Tull's 1958 addition and the most playable of the five. 6,324 yards of par 71 with a 69.6 rating and 120 slope — the most forgiving Bethpage setup and a great destination for a quick round or a beginner's first taste of the property. Wide fairways, accessible par 5s, and the kind of tee times you can actually book without setting an alarm.",
  holes: [
    { par: 4, yardage: 429, handicapRank: 3 },
    { par: 4, yardage: 398, handicapRank: 1 },
    { par: 4, yardage: 390, handicapRank: 7 },
    { par: 3, yardage: 166, handicapRank: 13 },
    { par: 4, yardage: 347, handicapRank: 9 },
    { par: 5, yardage: 487, handicapRank: 5 },
    { par: 3, yardage: 174, handicapRank: 17 },
    { par: 4, yardage: 338, handicapRank: 11 },
    { par: 4, yardage: 386, handicapRank: 15 },
    { par: 5, yardage: 524, handicapRank: 4 },
    { par: 3, yardage: 188, handicapRank: 14 },
    { par: 4, yardage: 313, handicapRank: 18 },
    { par: 4, yardage: 429, handicapRank: 2 },
    { par: 3, yardage: 188, handicapRank: 12 },
    { par: 4, yardage: 363, handicapRank: 8 },
    { par: 4, yardage: 353, handicapRank: 10 },
    { par: 5, yardage: 485, handicapRank: 6 },
    { par: 4, yardage: 366, handicapRank: 16 },
  ],
};

const COURSES = [BLACK, RED, BLUE, GREEN, YELLOW];

// ── Validate scorecards before touching anything ──────────────────
for (const c of COURSES) {
  if (c.holes.length !== 18) throw new Error(`${c.name}: expected 18 holes`);
  const totalPar = c.holes.reduce((s, h) => s + h.par, 0);
  const totalYards = c.holes.reduce((s, h) => s + h.yardage, 0);
  const hcps = c.holes.map(h => h.handicapRank).sort((a, b) => a - b);
  const hcpsValid = hcps.every((v, i) => v === i + 1);
  console.log(`  ${c.name}: par ${totalPar}, ${totalYards} yds, HCPs ${hcpsValid ? "OK (1..18 unique)" : "INVALID"}`);
  if (!hcpsValid) throw new Error(`${c.name}: stroke indexes don't form 1..18`);
}

if (!EXECUTE) {
  console.log("\nDry run only. Re-run with --execute to write to DB.");
  process.exit(0);
}

const now = new Date().toISOString();

// ── Step 1: Migrate the junk row's round → Black, delete junk row ──
console.log("\n── Cleanup: junk \"Bethpage State Park Golf Courses\" row ──");
const { error: migrateErr } = await admin
  .from("Round")
  .update({ courseId: BLACK_ID })
  .eq("courseId", JUNK_ROW_ID);
if (migrateErr) throw new Error(`Round migration: ${migrateErr.message}`);
console.log(`  ✓ Migrated rounds: ${JUNK_ROW_ID} → ${BLACK_ID} (Black)`);

const { error: holesDelErr } = await admin.from("Hole").delete().eq("courseId", JUNK_ROW_ID);
if (holesDelErr) throw new Error(`Junk holes delete: ${holesDelErr.message}`);
console.log(`  ✓ Deleted holes on junk row`);

const { error: courseDelErr } = await admin.from("Course").delete().eq("id", JUNK_ROW_ID);
if (courseDelErr) throw new Error(`Junk course delete: ${courseDelErr.message}`);
console.log(`  ✓ Deleted junk course row`);

// ── Step 2: Upsert each course + reseed its 18 holes ──────────────
async function upsertCourse(course) {
  const id = course.existingId ?? randomUUID();
  const row = {
    id,
    name: course.name,
    slug: course.slug,
    description: course.description,
    yearEstablished: course.yearEstablished,
    latitude: course.latitude,
    longitude: course.longitude,
    ...FACILITY,
    updatedAt: now,
    ...(course.existingId ? {} : { createdAt: now }),
  };
  const { error } = await admin.from("Course").upsert(row, { onConflict: "id" });
  if (error) throw new Error(`Course upsert (${course.name}): ${error.message}`);
  console.log(`  ✓ Course ${course.existingId ? "updated" : "inserted"}: ${course.name} (${id})`);
  return id;
}

async function seedHoles(courseId, course) {
  // Re-key holes by deleting and inserting fresh. Hole rows are
  // referenced by uploads via Upload.holeId — re-keying with new
  // UUIDs would orphan uploads.
  //
  // BUT: we just confirmed Black has UGC. So when re-seeding Black,
  // we need to UPDATE existing hole rows in place (matching on
  // holeNumber) rather than delete-and-insert. For the other four
  // courses (zero uploads), delete-and-insert is safe.
  const { count: uploadCount } = await admin
    .from("Upload")
    .select("id", { count: "exact", head: true })
    .eq("courseId", courseId);

  if ((uploadCount ?? 0) > 0) {
    // Update in place — match on (courseId, holeNumber).
    for (let i = 0; i < course.holes.length; i++) {
      const h = course.holes[i];
      const { error } = await admin
        .from("Hole")
        .update({ par: h.par, yardage: h.yardage, handicapRank: h.handicapRank, updatedAt: now })
        .eq("courseId", courseId)
        .eq("holeNumber", i + 1);
      if (error) throw new Error(`Hole update (${course.name} H${i + 1}): ${error.message}`);
    }
    console.log(`  ✓ Holes updated in place: 18 rows for ${course.name} (preserved holeIds for ${uploadCount} uploads)`);
  } else {
    const { error: delErr } = await admin.from("Hole").delete().eq("courseId", courseId);
    if (delErr) throw new Error(`Hole delete (${course.name}): ${delErr.message}`);

    const rows = course.holes.map((h, i) => ({
      id: randomUUID(),
      courseId,
      holeNumber: i + 1,
      par: h.par,
      yardage: h.yardage,
      handicapRank: h.handicapRank,
      uploadCount: 0,
      createdAt: now,
      updatedAt: now,
    }));
    const { error: insErr } = await admin.from("Hole").insert(rows);
    if (insErr) throw new Error(`Hole insert (${course.name}): ${insErr.message}`);
    console.log(`  ✓ Holes seeded: 18 fresh rows for ${course.name}`);
  }
}

for (const c of COURSES) {
  console.log(`\n── ${c.name} ──`);
  const id = await upsertCourse(c);
  await seedHoles(id, c);
}

console.log("\nDone.");
