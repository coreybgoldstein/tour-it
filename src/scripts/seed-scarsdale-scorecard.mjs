#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const COURSE_ID = "0dac2f7d-4ca7-41f9-8b71-4e1e49f44d9c"; // Scarsdale Golf Club

// Blue tees — Rating 71.6, Slope 137
const HOLES = [
  { holeNumber: 1,  par: 4, yardage: 345, handicapRank: 11 },
  { holeNumber: 2,  par: 3, yardage: 175, handicapRank: 17 },
  { holeNumber: 3,  par: 4, yardage: 370, handicapRank:  9 },
  { holeNumber: 4,  par: 4, yardage: 400, handicapRank:  5 },
  { holeNumber: 5,  par: 3, yardage: 165, handicapRank: 15 },
  { holeNumber: 6,  par: 5, yardage: 545, handicapRank:  7 },
  { holeNumber: 7,  par: 4, yardage: 430, handicapRank:  3 },
  { holeNumber: 8,  par: 4, yardage: 465, handicapRank:  1 },
  { holeNumber: 9,  par: 4, yardage: 325, handicapRank: 13 },
  { holeNumber: 10, par: 5, yardage: 475, handicapRank: 10 },
  { holeNumber: 11, par: 3, yardage: 160, handicapRank: 18 },
  { holeNumber: 12, par: 4, yardage: 350, handicapRank:  4 },
  { holeNumber: 13, par: 4, yardage: 290, handicapRank: 14 },
  { holeNumber: 14, par: 4, yardage: 455, handicapRank:  2 },
  { holeNumber: 15, par: 3, yardage: 130, handicapRank: 16 },
  { holeNumber: 16, par: 4, yardage: 375, handicapRank:  6 },
  { holeNumber: 17, par: 4, yardage: 365, handicapRank: 12 },
  { holeNumber: 18, par: 5, yardage: 530, handicapRank:  8 },
];

async function main() {
  // Delete any existing holes so we get a clean insert
  const { error: delErr } = await sb.from("Hole").delete().eq("courseId", COURSE_ID);
  if (delErr) { console.error("Delete error:", delErr.message); process.exit(1); }

  for (const h of HOLES) {
    const now = new Date().toISOString();
    const { error } = await sb.from("Hole").insert({ id: crypto.randomUUID(), courseId: COURSE_ID, createdAt: now, updatedAt: now, ...h });
    if (error) { console.error(`H${h.holeNumber}: ${error.message}`); }
    else console.log(`✅ H${h.holeNumber} — par ${h.par}, ${h.yardage}y, hcp ${h.handicapRank}`);
  }

  // Update holeCount on the Course
  await sb.from("Course").update({ holeCount: 18 }).eq("id", COURSE_ID);
  console.log("\n✅ Done. Scarsdale Golf Club scorecard seeded.");
}

main().catch(e => { console.error(e); process.exit(1); });
