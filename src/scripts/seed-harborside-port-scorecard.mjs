#!/usr/bin/env node
// One-off: seed Harborside International Golf Center (Port) scorecard
// Tournament tee yardages, par, and handicap rank for all 18 holes.

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const HOLES = [
  { holeNumber: 1,  par: 5, yardage: 554, handicapRank: 1  },
  { holeNumber: 2,  par: 4, yardage: 398, handicapRank: 9  },
  { holeNumber: 3,  par: 4, yardage: 330, handicapRank: 13 },
  { holeNumber: 4,  par: 3, yardage: 156, handicapRank: 17 },
  { holeNumber: 5,  par: 5, yardage: 521, handicapRank: 5  },
  { holeNumber: 6,  par: 4, yardage: 442, handicapRank: 7  },
  { holeNumber: 7,  par: 4, yardage: 387, handicapRank: 11 },
  { holeNumber: 8,  par: 3, yardage: 209, handicapRank: 15 },
  { holeNumber: 9,  par: 4, yardage: 466, handicapRank: 3  },
  { holeNumber: 10, par: 4, yardage: 416, handicapRank: 10 },
  { holeNumber: 11, par: 4, yardage: 411, handicapRank: 12 },
  { holeNumber: 12, par: 5, yardage: 560, handicapRank: 2  },
  { holeNumber: 13, par: 3, yardage: 225, handicapRank: 16 },
  { holeNumber: 14, par: 4, yardage: 474, handicapRank: 8  },
  { holeNumber: 15, par: 4, yardage: 364, handicapRank: 14 },
  { holeNumber: 16, par: 4, yardage: 425, handicapRank: 4  },
  { holeNumber: 17, par: 3, yardage: 174, handicapRank: 18 },
  { holeNumber: 18, par: 5, yardage: 592, handicapRank: 6  },
];

async function main() {
  // Find the course — try several name variants
  const { data: courses } = await supabase
    .from("Course")
    .select("id, name, city, state")
    .ilike("name", "%harborside%port%");

  let course = courses?.[0];

  if (!course) {
    const { data: fallback } = await supabase
      .from("Course")
      .select("id, name, city, state")
      .ilike("name", "%harborside%")
      .ilike("name", "%port%");
    course = fallback?.[0];
  }

  if (!course) {
    // Broader search
    const { data: broad } = await supabase
      .from("Course")
      .select("id, name, city, state")
      .ilike("name", "%harborside%");
    if (broad?.length) {
      console.log("Found these Harborside courses — pick the right one:");
      broad.forEach(c => console.log(`  ${c.id} — ${c.name}, ${c.city}, ${c.state}`));
    } else {
      console.error("No Harborside course found in DB.");
    }
    process.exit(1);
  }

  console.log(`Course: ${course.name} (${course.id})`);

  // Fetch existing holes
  const { data: existingHoles } = await supabase
    .from("Hole")
    .select("id, holeNumber")
    .eq("courseId", course.id)
    .order("holeNumber");

  const now = new Date().toISOString();

  if (!existingHoles?.length) {
    console.log("No holes found — inserting 18 holes...");
    const { error: insertErr } = await supabase.from("Hole").insert(
      HOLES.map(h => ({
        id: crypto.randomUUID(),
        courseId: course.id,
        holeNumber: h.holeNumber,
        par: h.par,
        yardage: h.yardage,
        handicapRank: h.handicapRank,
        uploadCount: 0,
        createdAt: now,
        updatedAt: now,
      }))
    );
    if (insertErr) { console.error("Insert failed:", insertErr.message); process.exit(1); }
    console.log("✅ All 18 holes created with scorecard data.");
    process.exit(0);
  }

  console.log(`Found ${existingHoles.length} holes — updating...`);

  const holeById = Object.fromEntries(existingHoles.map(h => [h.holeNumber, h.id]));

  let updated = 0;
  for (const h of HOLES) {
    const holeId = holeById[h.holeNumber];
    if (!holeId) {
      console.warn(`  ⚠ Hole ${h.holeNumber} not found in DB`);
      continue;
    }
    const { error } = await supabase
      .from("Hole")
      .update({ par: h.par, yardage: h.yardage, handicapRank: h.handicapRank, updatedAt: now })
      .eq("id", holeId);
    if (error) {
      console.error(`  ✗ Hole ${h.holeNumber}: ${error.message}`);
    } else {
      console.log(`  ✅ Hole ${h.holeNumber} — Par ${h.par}, ${h.yardage} yds, HCP ${h.handicapRank}`);
      updated++;
    }
  }

  console.log(`\nDone — ${updated}/18 holes updated.`);
}

main().catch(err => { console.error(err); process.exit(1); });
