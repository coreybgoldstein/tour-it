// Eisenhower Park Golf Course (East Meadow, NY) — three-course seed.
//
// The park has three full 18-hole courses (Red, White, Blue). The
// existing DB row was a single generic "Eisenhower Park Golf Course"
// whose stats happened to match the Blue course at tips (par 72,
// 5,773 yds — exact hole-by-hole match against the scorecard the
// user provided). So:
//
//   - Existing row (id f678e26d-...) is RENAMED in place to
//     "Eisenhower Park — Blue Course". Slug, description, city
//     all updated. Cover image + course-center lat/lng kept.
//     18 existing Hole rows are already correct; we no-op them.
//   - White and Red courses are INSERTED as new Course rows with
//     fresh IDs + 18 Hole rows each.
//
// Yardages, pars, and stroke indexes below are from the user's
// scorecard photos (2026-05-26):
//   - Red:   physical scorecard, BLUE/championship tees (7,199 / 73)
//   - White: digital scorecard, TIPS                    (6,881 / 72)
//   - Blue:  digital scorecard, TIPS                    (5,773 / 72)
//
// All three courses share the same address / lat-lng / phone /
// website / type — same Nassau County operation, same entrance.
// yearEstablished: Red is 1917 (Devereux Emmet design, per the
// scorecard cover). White / Blue years are unknown; left at 1914
// (existing value).
//
// Usage:
//   node src/scripts/seed-eisenhower-park.mjs            # dry run
//   node src/scripts/seed-eisenhower-park.mjs --execute  # write to DB

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const EXECUTE = process.argv.includes("--execute");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Shared facility metadata ──────────────────────────────────────
const FACILITY = {
  city: "East Meadow",
  state: "NY",
  country: "US",
  zipCode: "11554",
  latitude: 40.7391018,
  longitude: -73.5704566,
  phone: "(516) 572-0327",
  websiteUrl: "https://www.nassaucountyny.gov/1190/Golf",
  courseType: "PUBLIC",
  isPublic: true,
  holeCount: 18,
};

// ── Per-course scorecards (tips) ──────────────────────────────────
// Each `holes` array is 18 entries: { par, yardage, handicapRank }.
// holeNumber is the index + 1.

const RED = {
  existingId: null, // new row
  name: "Eisenhower Park — Red Course",
  slug: "eisenhower-park-red-course",
  yearEstablished: 1917,
  description:
    "Devereux Emmet's 1917 masterpiece and the marquee of Nassau County's three-course Eisenhower Park complex. The championship setup stretches to 7,199 yards at par 73, with the long 271-yard par-4 second and the brutal 582-yard 17th anchoring a layout that has hosted USGA qualifying and countless county championships. The most demanding public test on Long Island — bring everything you've got.",
  holes: [
    { par: 5, yardage: 488, handicapRank: 11 },
    { par: 4, yardage: 271, handicapRank: 15 },
    { par: 5, yardage: 515, handicapRank: 9 },
    { par: 4, yardage: 455, handicapRank: 1 },
    { par: 3, yardage: 164, handicapRank: 17 },
    { par: 4, yardage: 430, handicapRank: 5 },
    { par: 4, yardage: 458, handicapRank: 3 },
    { par: 4, yardage: 417, handicapRank: 7 },
    { par: 4, yardage: 346, handicapRank: 13 },
    { par: 4, yardage: 435, handicapRank: 6 },
    { par: 4, yardage: 410, handicapRank: 16 },
    { par: 5, yardage: 515, handicapRank: 14 },
    { par: 3, yardage: 211, handicapRank: 12 },
    { par: 4, yardage: 420, handicapRank: 8 },
    { par: 4, yardage: 454, handicapRank: 4 },
    { par: 3, yardage: 173, handicapRank: 18 },
    { par: 5, yardage: 582, handicapRank: 10 },
    { par: 4, yardage: 455, handicapRank: 2 },
  ],
};

const WHITE = {
  existingId: null, // new row
  name: "Eisenhower Park — White Course",
  slug: "eisenhower-park-white-course",
  yearEstablished: 1914,
  description:
    "The middle child of Nassau County's three-course Eisenhower complex — a straightforward par 72 that plays 6,881 yards from the tips. Less brutal than the Red, longer than the Blue, with two reachable par 5s on the back nine that reward a confident driver. A genuine alternative the locals know to book when the Red is tied up with a tournament.",
  holes: [
    { par: 4, yardage: 379, handicapRank: 7 },
    { par: 4, yardage: 425, handicapRank: 11 },
    { par: 5, yardage: 522, handicapRank: 1 },
    { par: 4, yardage: 400, handicapRank: 5 },
    { par: 3, yardage: 185, handicapRank: 15 },
    { par: 4, yardage: 390, handicapRank: 9 },
    { par: 5, yardage: 476, handicapRank: 13 },
    { par: 3, yardage: 160, handicapRank: 17 },
    { par: 4, yardage: 416, handicapRank: 3 },
    { par: 4, yardage: 400, handicapRank: 6 },
    { par: 4, yardage: 370, handicapRank: 14 },
    { par: 5, yardage: 546, handicapRank: 4 },
    { par: 4, yardage: 427, handicapRank: 8 },
    { par: 3, yardage: 170, handicapRank: 18 },
    { par: 4, yardage: 445, handicapRank: 2 },
    { par: 4, yardage: 424, handicapRank: 12 },
    { par: 3, yardage: 204, handicapRank: 16 },
    { par: 5, yardage: 542, handicapRank: 10 },
  ],
};

const BLUE = {
  existingId: "f678e26d-75b3-4648-b731-b8cf125de337", // repurpose
  name: "Eisenhower Park — Blue Course",
  slug: "eisenhower-park-blue-course",
  yearEstablished: 1914,
  description:
    "The most accessible of Nassau County's three Eisenhower courses — 5,773 yards of par 72 that plays tight without being brutal. Shorter overall than the Red and White, with a generous front nine and a back-nine stretch (10–15) that rewards a solid wedge game over raw distance. The right pick when you want to play 18 in under 4 hours without giving up the day.",
  holes: [
    { par: 5, yardage: 446, handicapRank: 14 },
    { par: 4, yardage: 343, handicapRank: 8 },
    { par: 4, yardage: 395, handicapRank: 2 },
    { par: 3, yardage: 163, handicapRank: 16 },
    { par: 4, yardage: 339, handicapRank: 4 },
    { par: 5, yardage: 429, handicapRank: 12 },
    { par: 4, yardage: 332, handicapRank: 10 },
    { par: 3, yardage: 103, handicapRank: 18 },
    { par: 4, yardage: 345, handicapRank: 6 },
    { par: 4, yardage: 368, handicapRank: 3 },
    { par: 5, yardage: 435, handicapRank: 7 },
    { par: 4, yardage: 327, handicapRank: 11 },
    { par: 4, yardage: 296, handicapRank: 15 },
    { par: 4, yardage: 359, handicapRank: 5 },
    { par: 3, yardage: 162, handicapRank: 13 },
    { par: 4, yardage: 369, handicapRank: 1 },
    { par: 3, yardage: 118, handicapRank: 17 },
    { par: 5, yardage: 444, handicapRank: 9 },
  ],
};

const COURSES = [RED, WHITE, BLUE];

// ── Sanity-check the embedded data before touching anything ───────
for (const c of COURSES) {
  if (c.holes.length !== 18) throw new Error(`${c.name}: expected 18 holes, got ${c.holes.length}`);
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

// ── Write ─────────────────────────────────────────────────────────
const now = new Date().toISOString();

async function upsertCourse(course) {
  const id = course.existingId ?? randomUUID();
  const row = {
    id,
    name: course.name,
    slug: course.slug,
    description: course.description,
    yearEstablished: course.yearEstablished,
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
  // Idempotent: delete existing holes, then re-insert from the
  // scorecard. Safe because we just confirmed there's zero UGC tied
  // to the existing course row (Uploads, Rounds, Saves all = 0).
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
  console.log(`  ✓ Holes seeded: 18 rows for ${course.name}`);
}

for (const c of COURSES) {
  console.log(`\n── ${c.name} ──`);
  const id = await upsertCourse(c);
  await seedHoles(id, c);
}

console.log("\nDone.");
