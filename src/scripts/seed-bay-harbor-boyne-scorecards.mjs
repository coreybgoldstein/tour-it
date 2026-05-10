#!/usr/bin/env node

/**
 * Hand-keyed scorecards for the courses GolfCourseAPI doesn't have:
 *   Bay Harbor — Links, Quarry, Preserve (9-hole each)
 *   Boyne Highlands — Arthur Hills, The Heather, Donald Ross Memorial (18-hole each)
 *
 * Source: scorecards user provided directly. Brown / Championship yardage.
 *
 * For the 9-hole Bay Harbor layouts, handicap ranks are the STANDALONE
 * 1-9 stroke index (derived from the printed 'Front' indices on the
 * combined card: stroke_front = standalone × 2 − 1). When paired via
 * secondaryCourseId, the game-flow stitching reproduces the printed
 * 1-18 combined index automatically.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SCORECARDS = [
  {
    courseId: "c4c10379-9b9b-40f5-9b02-d9f5eb3d2c71",
    name: "Bay Harbor - The Links",
    holes: [
      { holeNumber: 1, par: 4, yardage: 442, handicapRank: 3 },
      { holeNumber: 2, par: 4, yardage: 437, handicapRank: 5 },
      { holeNumber: 3, par: 4, yardage: 380, handicapRank: 4 },
      { holeNumber: 4, par: 3, yardage: 178, handicapRank: 9 },
      { holeNumber: 5, par: 4, yardage: 351, handicapRank: 6 },
      { holeNumber: 6, par: 4, yardage: 418, handicapRank: 1 },
      { holeNumber: 7, par: 5, yardage: 500, handicapRank: 7 },
      { holeNumber: 8, par: 3, yardage: 225, handicapRank: 8 },
      { holeNumber: 9, par: 5, yardage: 518, handicapRank: 2 },
    ],
  },
  {
    courseId: "d9bc637f-ae62-43b3-a911-048ff13bac15",
    name: "Bay Harbor - The Quarry",
    holes: [
      { holeNumber: 1, par: 4, yardage: 368, handicapRank: 7 },
      { holeNumber: 2, par: 3, yardage: 202, handicapRank: 9 },
      { holeNumber: 3, par: 5, yardage: 561, handicapRank: 3 },
      { holeNumber: 4, par: 4, yardage: 436, handicapRank: 5 },
      { holeNumber: 5, par: 5, yardage: 495, handicapRank: 1 },
      { holeNumber: 6, par: 4, yardage: 332, handicapRank: 6 },
      { holeNumber: 7, par: 4, yardage: 406, handicapRank: 2 },
      { holeNumber: 8, par: 3, yardage: 205, handicapRank: 8 },
      { holeNumber: 9, par: 4, yardage: 391, handicapRank: 4 },
    ],
  },
  {
    courseId: "8f5495fe-ade2-4f6c-b4eb-76938aec5c9a",
    name: "Bay Harbor - The Preserve",
    holes: [
      { holeNumber: 1, par: 4, yardage: 391, handicapRank: 6 },
      { holeNumber: 2, par: 4, yardage: 341, handicapRank: 7 },
      { holeNumber: 3, par: 4, yardage: 423, handicapRank: 4 },
      { holeNumber: 4, par: 5, yardage: 577, handicapRank: 1 },
      { holeNumber: 5, par: 3, yardage: 191, handicapRank: 8 },
      { holeNumber: 6, par: 5, yardage: 493, handicapRank: 2 },
      { holeNumber: 7, par: 4, yardage: 404, handicapRank: 5 },
      { holeNumber: 8, par: 4, yardage: 372, handicapRank: 3 },
      { holeNumber: 9, par: 3, yardage: 186, handicapRank: 9 },
    ],
  },
  {
    courseId: "d41249cf-79eb-4617-ba53-4f63e1f128f2",
    name: "Arthur Hills (Boyne Highlands)",
    holes: [
      { holeNumber: 1,  par: 4, yardage: 406, handicapRank: 9 },
      { holeNumber: 2,  par: 4, yardage: 359, handicapRank: 17 },
      { holeNumber: 3,  par: 5, yardage: 541, handicapRank: 5 },
      { holeNumber: 4,  par: 4, yardage: 417, handicapRank: 7 },
      { holeNumber: 5,  par: 4, yardage: 481, handicapRank: 1 },
      { holeNumber: 6,  par: 5, yardage: 585, handicapRank: 13 },
      { holeNumber: 7,  par: 3, yardage: 172, handicapRank: 15 },
      { holeNumber: 8,  par: 4, yardage: 427, handicapRank: 3 },
      { holeNumber: 9,  par: 3, yardage: 202, handicapRank: 11 },
      { holeNumber: 10, par: 4, yardage: 354, handicapRank: 18 },
      { holeNumber: 11, par: 5, yardage: 575, handicapRank: 4 },
      { holeNumber: 12, par: 4, yardage: 397, handicapRank: 8 },
      { holeNumber: 13, par: 5, yardage: 570, handicapRank: 14 },
      { holeNumber: 14, par: 3, yardage: 186, handicapRank: 2 },
      { holeNumber: 15, par: 4, yardage: 440, handicapRank: 16 },
      { holeNumber: 16, par: 3, yardage: 203, handicapRank: 6 },
      { holeNumber: 17, par: 4, yardage: 420, handicapRank: 10 },
      { holeNumber: 18, par: 5, yardage: 577, handicapRank: 12 },
    ],
  },
  {
    courseId: "6ec71cee-6f23-49fd-932c-0c8e5073847b",
    name: "The Heather (Boyne Highlands)",
    holes: [
      { holeNumber: 1,  par: 4, yardage: 383, handicapRank: 15 },
      { holeNumber: 2,  par: 4, yardage: 397, handicapRank: 5 },
      { holeNumber: 3,  par: 4, yardage: 403, handicapRank: 13 },
      { holeNumber: 4,  par: 3, yardage: 202, handicapRank: 11 },
      { holeNumber: 5,  par: 5, yardage: 560, handicapRank: 1 },
      { holeNumber: 6,  par: 3, yardage: 161, handicapRank: 17 },
      { holeNumber: 7,  par: 4, yardage: 386, handicapRank: 7 },
      { holeNumber: 8,  par: 4, yardage: 450, handicapRank: 3 },
      { holeNumber: 9,  par: 5, yardage: 617, handicapRank: 9 },
      { holeNumber: 10, par: 4, yardage: 416, handicapRank: 6 },
      { holeNumber: 11, par: 5, yardage: 550, handicapRank: 18 },
      { holeNumber: 12, par: 3, yardage: 174, handicapRank: 16 },
      { holeNumber: 13, par: 4, yardage: 419, handicapRank: 8 },
      { holeNumber: 14, par: 4, yardage: 418, handicapRank: 10 },
      { holeNumber: 15, par: 5, yardage: 506, handicapRank: 2 },
      { holeNumber: 16, par: 3, yardage: 196, handicapRank: 14 },
      { holeNumber: 17, par: 4, yardage: 403, handicapRank: 12 },
      { holeNumber: 18, par: 4, yardage: 482, handicapRank: 4 },
    ],
  },
  {
    courseId: "ab62620e-8e8f-4512-a442-b5bc59254dfe",
    name: "Donald Ross Memorial (Boyne Highlands)",
    holes: [
      { holeNumber: 1,  par: 4, yardage: 383, handicapRank: 11 },
      { holeNumber: 2,  par: 4, yardage: 336, handicapRank: 13 },
      { holeNumber: 3,  par: 3, yardage: 196, handicapRank: 5 },
      { holeNumber: 4,  par: 4, yardage: 434, handicapRank: 9 },
      { holeNumber: 5,  par: 5, yardage: 617, handicapRank: 1 },
      { holeNumber: 6,  par: 4, yardage: 402, handicapRank: 7 },
      { holeNumber: 7,  par: 4, yardage: 336, handicapRank: 17 },
      { holeNumber: 8,  par: 3, yardage: 181, handicapRank: 15 },
      { holeNumber: 9,  par: 5, yardage: 497, handicapRank: 3 },
      { holeNumber: 10, par: 4, yardage: 435, handicapRank: 4 },
      { holeNumber: 11, par: 4, yardage: 339, handicapRank: 16 },
      { holeNumber: 12, par: 3, yardage: 159, handicapRank: 18 },
      { holeNumber: 13, par: 5, yardage: 510, handicapRank: 2 },
      { holeNumber: 14, par: 4, yardage: 435, handicapRank: 8 },
      { holeNumber: 15, par: 4, yardage: 415, handicapRank: 10 },
      { holeNumber: 16, par: 5, yardage: 568, handicapRank: 14 },
      { holeNumber: 17, par: 3, yardage: 184, handicapRank: 12 },
      { holeNumber: 18, par: 4, yardage: 438, handicapRank: 6 },
    ],
  },
];

async function main() {
  console.log("\n🏌️  Hand-keyed scorecard seed — Bay Harbor + Boyne Highlands\n");

  // Sanity-check: every rank in each scorecard appears exactly once 1..N
  for (const sc of SCORECARDS) {
    const ranks = sc.holes.map((h) => h.handicapRank).sort((a, b) => a - b);
    const expected = Array.from({ length: sc.holes.length }, (_, i) => i + 1);
    if (JSON.stringify(ranks) !== JSON.stringify(expected)) {
      console.error(`  ✗ ${sc.name}: handicap ranks not unique 1–${sc.holes.length}: ${ranks.join(", ")}`);
      process.exit(1);
    }
  }
  console.log("All scorecards passed rank-uniqueness check.\n");

  for (const sc of SCORECARDS) {
    const { data: dbHoles, error } = await sb
      .from("Hole")
      .select("id, holeNumber")
      .eq("courseId", sc.courseId)
      .order("holeNumber");
    if (error) { console.error(`  ✗ ${sc.name}: ${error.message}`); continue; }
    if (!dbHoles || dbHoles.length === 0) {
      console.error(`  ✗ ${sc.name}: no Hole rows found for course ${sc.courseId}`);
      continue;
    }
    if (dbHoles.length < sc.holes.length) {
      console.error(`  ✗ ${sc.name}: DB has ${dbHoles.length} holes but scorecard has ${sc.holes.length}`);
      continue;
    }

    const byNum = Object.fromEntries(dbHoles.map((h) => [h.holeNumber, h.id]));
    let updated = 0;
    for (const h of sc.holes) {
      const dbId = byNum[h.holeNumber];
      if (!dbId) continue;
      const { error: upErr } = await sb
        .from("Hole")
        .update({
          par: h.par,
          yardage: h.yardage,
          handicapRank: h.handicapRank,
          updatedAt: new Date().toISOString(),
        })
        .eq("id", dbId);
      if (upErr) console.error(`    h${h.holeNumber}: ${upErr.message}`);
      else updated++;
    }

    const totalYards = sc.holes.reduce((s, h) => s + h.yardage, 0);
    const totalPar = sc.holes.reduce((s, h) => s + h.par, 0);
    console.log(`  ✅ ${sc.name.padEnd(45)} ${updated}/${sc.holes.length} holes  ·  par ${totalPar}  ·  ${totalYards.toLocaleString()}y`);
  }

  console.log("\nDone.");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
