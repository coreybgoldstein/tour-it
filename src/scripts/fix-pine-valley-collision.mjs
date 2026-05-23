#!/usr/bin/env node
/**
 * Fix the Pine Valley name collision from seed-three-courses.mjs.
 *
 * What happened: seed-three-courses.mjs matched "Pine Valley Golf Club"
 * by name only and found the Ohio executive course (Wadsworth, OH,
 * id c266e1d1-…) instead of the famous NJ one. It then:
 *   - filled the Ohio course's null zipCode/year/courseType/websiteUrl
 *     with NJ values
 *   - filled the Ohio course's hole yardages + handicapRanks with the
 *     NJ scorecard
 *   - overwrote any par-4 default holes with NJ pars (3 or 5)
 *
 * This script:
 *   1. Reverts every field on the Ohio row that we set, IF the current
 *      value still equals what we set (i.e. nobody else touched it
 *      after us).
 *   2. Inserts a brand-new Pine Valley NJ row in Clementon with the
 *      correct scorecard and 18 holes.
 *
 * Usage:
 *   node src/scripts/fix-pine-valley-collision.mjs            # dry-run
 *   node src/scripts/fix-pine-valley-collision.mjs --apply    # commit
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import dotenv from "dotenv";

dotenv.config();

const APPLY = process.argv.includes("--apply");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const OHIO_PINE_VALLEY_ID = "c266e1d1-bf08-43ae-a48b-04ecbe57638f";

// Exactly what seed-three-courses.mjs set on the Ohio course
const POLLUTED_COURSE_FIELDS = {
  zipCode: "08021",
  yearEstablished: 1913,
  courseType: "PRIVATE",
  websiteUrl: "https://www.pinevalleygolfclub.com/",
};

// Exactly what it wrote into the Ohio holes
const NJ_SCORECARD = [
  { hole: 1, par: 4, yardage: 421, handicapRank: 3 },
  { hole: 2, par: 4, yardage: 368, handicapRank: 9 },
  { hole: 3, par: 3, yardage: 198, handicapRank: 17 },
  { hole: 4, par: 4, yardage: 499, handicapRank: 5 },
  { hole: 5, par: 3, yardage: 238, handicapRank: 11 },
  { hole: 6, par: 4, yardage: 394, handicapRank: 13 },
  { hole: 7, par: 5, yardage: 636, handicapRank: 1 },
  { hole: 8, par: 4, yardage: 326, handicapRank: 15 },
  { hole: 9, par: 4, yardage: 458, handicapRank: 7 },
  { hole: 10, par: 3, yardage: 161, handicapRank: 18 },
  { hole: 11, par: 4, yardage: 397, handicapRank: 10 },
  { hole: 12, par: 4, yardage: 337, handicapRank: 14 },
  { hole: 13, par: 4, yardage: 486, handicapRank: 4 },
  { hole: 14, par: 3, yardage: 220, handicapRank: 16 },
  { hole: 15, par: 5, yardage: 615, handicapRank: 2 },
  { hole: 16, par: 4, yardage: 475, handicapRank: 8 },
  { hole: 17, par: 4, yardage: 345, handicapRank: 12 },
  { hole: 18, par: 4, yardage: 483, handicapRank: 6 },
];

const NJ_PINE_VALLEY = {
  name: "Pine Valley Golf Club",
  city: "Clementon",
  state: "NJ",
  zipCode: "08021",
  latitude: 39.789,
  longitude: -74.972,
  yearEstablished: 1913,
  courseType: "PRIVATE",
  holeCount: 18,
  websiteUrl: "https://www.pinevalleygolfclub.com/",
  description:
    "Pine Valley is the original sand-and-pine fever dream — George Crump cleared 22,000 tree stumps from a Camden County wasteland in the 1910s and the result still plays like a series of island fairways floating in scrub. The 7th is a 636-yard par 5 with a literal Hell's Half Acre splitting fairway from green, which tells you most of what you need to know. You leave wrung out and already plotting how to get invited back.",
};

async function revertOhio() {
  console.log(`\n▶ Revert Ohio Pine Valley (id=${OHIO_PINE_VALLEY_ID})`);
  const { data: cur } = await supabase
    .from("Course")
    .select("id, name, city, state, zipCode, yearEstablished, courseType, websiteUrl")
    .eq("id", OHIO_PINE_VALLEY_ID)
    .single();
  if (!cur) {
    console.log(`  ❌ row not found — skipping`);
    return;
  }
  console.log(`  matched: ${cur.name} (${cur.city}, ${cur.state})`);

  const patch = {};
  for (const [field, polluted] of Object.entries(POLLUTED_COURSE_FIELDS)) {
    if (cur[field] === polluted) patch[field] = null;
  }
  const fieldsToRevert = Object.keys(patch);
  console.log(`  course fields to revert to null: ${fieldsToRevert.length > 0 ? fieldsToRevert.join(", ") : "(none — nothing matches)"}`);

  if (APPLY && fieldsToRevert.length > 0) {
    patch.updatedAt = new Date().toISOString();
    const { error } = await supabase.from("Course").update(patch).eq("id", OHIO_PINE_VALLEY_ID);
    if (error) console.log(`  ❌ course update error: ${error.message}`);
    else console.log(`  ✓ course reverted`);
  } else if (!APPLY && fieldsToRevert.length > 0) {
    console.log(`  [dry-run] would set ${fieldsToRevert.join(", ")} = null`);
  }

  // Revert hole-level changes
  const { data: holes } = await supabase
    .from("Hole")
    .select("id, holeNumber, par, yardage, handicapRank")
    .eq("courseId", OHIO_PINE_VALLEY_ID)
    .order("holeNumber");
  let holesPatched = 0;
  for (const h of holes || []) {
    const card = NJ_SCORECARD.find((c) => c.hole === h.holeNumber);
    if (!card) continue;
    const patch = {};
    if (h.yardage === card.yardage) patch.yardage = null;
    if (h.handicapRank === card.handicapRank) patch.handicapRank = null;
    if (card.par !== 4 && h.par === card.par) patch.par = 4;
    if (Object.keys(patch).length === 0) continue;
    holesPatched++;
    if (APPLY) {
      patch.updatedAt = new Date().toISOString();
      const { error } = await supabase.from("Hole").update(patch).eq("id", h.id);
      if (error) console.log(`    ❌ hole ${h.holeNumber}: ${error.message}`);
    }
  }
  console.log(`  holes patched back: ${holesPatched}/18`);
}

async function insertNJ() {
  console.log(`\n▶ Insert Pine Valley NJ (Clementon, NJ)`);
  // Pre-check by name+state to avoid duplicate inserts on re-run
  const { data: existing } = await supabase
    .from("Course")
    .select("id")
    .ilike("name", NJ_PINE_VALLEY.name)
    .eq("state", NJ_PINE_VALLEY.state)
    .limit(1);
  if (existing && existing.length > 0) {
    console.log(`  ↺ already exists (id=${existing[0].id}) — skipping insert`);
    return existing[0].id;
  }

  const courseId = randomUUID();
  const now = new Date().toISOString();
  const slug = `${NJ_PINE_VALLEY.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-clementon`;
  const row = {
    id: courseId,
    slug,
    name: NJ_PINE_VALLEY.name,
    city: NJ_PINE_VALLEY.city,
    state: NJ_PINE_VALLEY.state,
    zipCode: NJ_PINE_VALLEY.zipCode,
    latitude: NJ_PINE_VALLEY.latitude,
    longitude: NJ_PINE_VALLEY.longitude,
    yearEstablished: NJ_PINE_VALLEY.yearEstablished,
    courseType: NJ_PINE_VALLEY.courseType,
    holeCount: NJ_PINE_VALLEY.holeCount,
    websiteUrl: NJ_PINE_VALLEY.websiteUrl,
    description: NJ_PINE_VALLEY.description,
    isPublic: true,
    createdAt: now,
    updatedAt: now,
  };
  console.log(`  course row → id=${courseId} slug=${slug}`);
  if (!APPLY) {
    console.log(`  [dry-run] would insert course + 18 holes from NJ scorecard`);
    return courseId;
  }
  const { error: cErr } = await supabase.from("Course").insert(row);
  if (cErr) {
    console.log(`  ❌ course insert error: ${cErr.message}`);
    return null;
  }
  console.log(`  ✓ course inserted`);

  // Insert 18 holes from NJ scorecard
  const holes = NJ_SCORECARD.map((c) => ({
    id: randomUUID(),
    courseId,
    holeNumber: c.hole,
    par: c.par,
    yardage: c.yardage,
    handicapRank: c.handicapRank,
    uploadCount: 0,
    createdAt: now,
    updatedAt: now,
  }));
  const { error: hErr } = await supabase.from("Hole").insert(holes);
  if (hErr) console.log(`  ❌ hole insert error: ${hErr.message}`);
  else console.log(`  ✓ 18 holes inserted (par ${holes.reduce((s, h) => s + h.par, 0)}, ${holes.reduce((s, h) => s + h.yardage, 0)} yds)`);

  return courseId;
}

(async () => {
  console.log(APPLY ? "APPLY MODE" : "DRY RUN (pass --apply)");
  await revertOhio();
  await insertNJ();
  console.log("\nDone.");
})();
