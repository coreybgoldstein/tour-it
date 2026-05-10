#!/usr/bin/env node

/**
 * Phase 1 — broader probe for the 16 "missing" courses.
 * Tries fuzzier patterns + drops state filter to surface variants.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// For each missing, broader patterns + city/state hints
const PROBES = [
  { display: "The Links at Spanish Bay",        patterns: ["Spanish Bay"],                     state: null,  cityHint: null },
  { display: "Pacific Dunes",                   patterns: ["Pacific Dunes", "Bandon Pacific"], state: null,  cityHint: "Bandon" },
  { display: "Old Macdonald",                   patterns: ["Old Macdonald", "Old Mac", "Bandon Old"], state: null, cityHint: "Bandon" },
  { display: "Pinehurst No. 8",                 patterns: ["Pinehurst No", "Pinehurst #", "Pinehurst 8"], state: "NC", cityHint: "Pinehurst" },
  { display: "True Blue Golf Club",             patterns: ["True Blue"],                       state: null,  cityHint: null },
  { display: "TPC Myrtle Beach",                patterns: ["TPC Myrtle", "TPC at Myrtle"],     state: null,  cityHint: "Myrtle" },
  { display: "Barefoot Resort — Dye Course",    patterns: ["Barefoot", "Dye Club"],            state: "SC",  cityHint: null },
  { display: "Mammoth Dunes",                   patterns: ["Mammoth", "Sand Valley Mammoth"],  state: null,  cityHint: null },
  { display: "Streamsong Red",                  patterns: ["Streamsong"],                      state: "FL",  cityHint: null },
  { display: "Streamsong Blue",                 patterns: ["Streamsong"],                      state: "FL",  cityHint: null },
  { display: "Streamsong Black",                patterns: ["Streamsong"],                      state: "FL",  cityHint: null },
  { display: "Forest Dunes — The Loop (Black)", patterns: ["Forest Dunes", "The Loop", "Loop Course"], state: "MI", cityHint: null },
  { display: "Forest Dunes — The Loop (Red)",   patterns: ["Forest Dunes", "The Loop", "Loop Course"], state: "MI", cityHint: null },
  { display: "Bethpage Red",                    patterns: ["Bethpage"],                        state: "NY",  cityHint: null },
  { display: "Kiawah Island — Osprey Point",    patterns: ["Osprey Point", "Kiawah"],          state: "SC",  cityHint: "Kiawah" },
  { display: "Memorial Park Golf Course",       patterns: ["Memorial Park"],                   state: "TX",  cityHint: "Houston" },
];

async function probe(entry) {
  const allHits = new Map(); // dedupe by id
  for (const p of entry.patterns) {
    let q = supabase
      .from("Course")
      .select("id, name, city, state, courseType")
      .ilike("name", `%${p}%`)
      .limit(20);
    if (entry.state) q = q.eq("state", entry.state);
    const { data, error } = await q;
    if (error || !data) continue;
    for (const r of data) {
      if (entry.cityHint && !r.city?.toLowerCase().includes(entry.cityHint.toLowerCase())) continue;
      allHits.set(r.id, { ...r, viaPattern: p });
    }
  }
  return Array.from(allHits.values());
}

async function main() {
  for (const entry of PROBES) {
    console.log(`\n${entry.display}`);
    console.log("─".repeat(entry.display.length));
    const hits = await probe(entry);
    if (hits.length === 0) {
      console.log("  (no candidates)");
      continue;
    }
    hits.forEach((h) => {
      console.log(`  • ${h.name} — ${h.city}, ${h.state}${h.courseType ? ` (${h.courseType})` : ""} [via "${h.viaPattern}"] id=${h.id}`);
    });
  }
}

main();
