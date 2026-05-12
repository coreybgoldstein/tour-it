// Seed Quaker Ridge Golf Club (Scarsdale, NY) scorecard data.
// Source: official scorecard screenshots provided 2026-05-12.
// Strategy: Hole table has a single `par` and `yardage` field (no per-tee
// breakdown), so we store Par + Blue tees (common everyday/member yardage,
// 6456 total) as the canonical Hole rows. Black tees (championship, 7023)
// can be wired in later if we add per-tee variations to the schema.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const QUAKER_RIDGE_ID = "444a627b-95dc-4351-a779-8bb5186fddfa"; // Scarsdale, NY

// [par, blueYards] per hole 1..18
const SCORECARD = [
  [5, 510], [4, 405], [4, 424], [4, 408], [3, 151], [4, 434], [4, 416], [4, 335], [3, 143],
  [3, 186], [4, 372], [4, 403], [3, 209], [5, 517], [4, 375], [4, 414], [4, 344], [4, 410],
];

async function run() {
  const { data: existing, error } = await sb
    .from("Hole")
    .select("id, holeNumber, par, yardage")
    .eq("courseId", QUAKER_RIDGE_ID)
    .order("holeNumber");
  if (error) throw error;
  if (!existing || existing.length === 0) {
    console.error("No Hole rows found for Quaker Ridge — aborting (we don't insert).");
    process.exit(1);
  }

  console.log(`Found ${existing.length} hole rows; updating par + yardage…`);

  for (let i = 0; i < SCORECARD.length; i++) {
    const holeNumber = i + 1;
    const [par, yardage] = SCORECARD[i];
    const row = existing.find(r => r.holeNumber === holeNumber);
    if (!row) {
      console.warn(`  Hole ${holeNumber}: missing row, skipping`);
      continue;
    }
    const { error: uErr } = await sb
      .from("Hole")
      .update({ par, yardage, updatedAt: new Date().toISOString() })
      .eq("id", row.id);
    if (uErr) {
      console.error(`  Hole ${holeNumber}: ${uErr.message}`);
    } else {
      console.log(`  Hole ${holeNumber}: par ${par}, ${yardage}y`);
    }
  }

  // Sanity check totals
  const outPar = SCORECARD.slice(0, 9).reduce((s, [p]) => s + p, 0);
  const inPar = SCORECARD.slice(9).reduce((s, [p]) => s + p, 0);
  const outYards = SCORECARD.slice(0, 9).reduce((s, [, y]) => s + y, 0);
  const inYards = SCORECARD.slice(9).reduce((s, [, y]) => s + y, 0);
  console.log(`\nOut: par ${outPar}, ${outYards}y · In: par ${inPar}, ${inYards}y · Total par ${outPar + inPar}, ${outYards + inYards}y`);
}

run().catch(e => { console.error(e); process.exit(1); });
