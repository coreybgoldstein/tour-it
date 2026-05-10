#!/usr/bin/env node

/**
 * Tour It — Phase 1 Audit
 *
 * Audits the 46 trip-itinerary master courses against the Course table.
 * UPDATE-only project rule applies: this script never inserts. It just reports.
 *
 * Output:
 *   phase1-audit.json — machine-readable for the enrichment step
 *   Console — human-readable summary
 *
 * Usage:
 *   node src/scripts/phase1-audit.mjs
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { writeFileSync } from "fs";
import { join } from "path";

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Master list ──────────────────────────────────────────────────────────────
// Each entry: { display, patterns (ilike, OR-joined), state, cityHint?, region }
// Patterns are tried in order; first one that yields ≥1 hit wins.

const MASTER = [
  // Pacific Coast / Bandon
  { display: "Pebble Beach Golf Links",         patterns: ["Pebble Beach"],            state: "CA", region: "Pacific Coast / Bandon" },
  { display: "Spyglass Hill Golf Course",       patterns: ["Spyglass"],                state: "CA", region: "Pacific Coast / Bandon" },
  { display: "The Links at Spanish Bay",        patterns: ["Spanish Bay"],             state: "CA", region: "Pacific Coast / Bandon" },
  { display: "Bandon Dunes",                    patterns: ["Bandon Dunes"],            state: "OR", region: "Pacific Coast / Bandon" },
  { display: "Pacific Dunes",                   patterns: ["Pacific Dunes"],           state: "OR", region: "Pacific Coast / Bandon" },
  { display: "Old Macdonald",                   patterns: ["Old Macdonald", "Old Mac"], state: "OR", region: "Pacific Coast / Bandon" },
  { display: "Bandon Trails",                   patterns: ["Bandon Trails"],           state: "OR", region: "Pacific Coast / Bandon" },
  { display: "Sheep Ranch",                     patterns: ["Sheep Ranch"],             state: "OR", region: "Pacific Coast / Bandon" },

  // Pinehurst Area
  { display: "Pinehurst No. 2",                 patterns: ["Pinehurst No. 2", "Pinehurst No 2", "Pinehurst #2"], state: "NC", region: "Pinehurst Area" },
  { display: "Pinehurst No. 4",                 patterns: ["Pinehurst No. 4", "Pinehurst No 4", "Pinehurst #4"], state: "NC", region: "Pinehurst Area" },
  { display: "Pinehurst No. 8",                 patterns: ["Pinehurst No. 8", "Pinehurst No 8", "Pinehurst #8"], state: "NC", region: "Pinehurst Area" },
  { display: "Pine Needles Lodge & Golf Club",  patterns: ["Pine Needles"],            state: "NC", region: "Pinehurst Area" },

  // Myrtle Beach
  { display: "Caledonia Golf & Fish Club",      patterns: ["Caledonia"],               state: "SC", region: "Myrtle Beach" },
  { display: "True Blue Golf Club",             patterns: ["True Blue"],               state: "SC", region: "Myrtle Beach" },
  { display: "TPC Myrtle Beach",                patterns: ["TPC Myrtle"],              state: "SC", region: "Myrtle Beach" },
  { display: "Barefoot Resort — Dye Course",    patterns: ["Barefoot%Dye", "Dye Course"], state: "SC", cityHint: "Myrtle", region: "Myrtle Beach" },

  // Arizona
  { display: "We-Ko-Pa — Saguaro Course",       patterns: ["We-Ko-Pa Saguaro", "Saguaro", "We-Ko-Pa"], state: "AZ", region: "Arizona" },
  { display: "Troon North — Monument Course",   patterns: ["Troon North Monument", "Troon North"],     state: "AZ", region: "Arizona" },
  { display: "TPC Scottsdale — Stadium Course", patterns: ["TPC Scottsdale Stadium", "TPC Scottsdale"],state: "AZ", region: "Arizona" },

  // Wisconsin
  { display: "Sand Valley",                     patterns: ["Sand Valley"],             state: "WI", region: "Wisconsin" },
  { display: "Mammoth Dunes",                   patterns: ["Mammoth Dunes"],           state: "WI", region: "Wisconsin" },
  { display: "Whistling Straits — Straits Course", patterns: ["Whistling Straits"],    state: "WI", region: "Wisconsin" },

  // Florida — Streamsong
  { display: "Streamsong Red",                  patterns: ["Streamsong Red"],          state: "FL", region: "Streamsong" },
  { display: "Streamsong Blue",                 patterns: ["Streamsong Blue"],         state: "FL", region: "Streamsong" },
  { display: "Streamsong Black",                patterns: ["Streamsong Black"],        state: "FL", region: "Streamsong" },

  // Nebraska Sandhills
  { display: "Wild Horse Golf Club",            patterns: ["Wild Horse"],              state: "NE", region: "Nebraska Sandhills" },
  { display: "The Prairie Club — Dunes Course", patterns: ["Prairie Club Dunes", "Prairie Club"], state: "NE", region: "Nebraska Sandhills" },
  { display: "Dismal River — Red Course",       patterns: ["Dismal River Red", "Dismal River"],   state: "NE", region: "Nebraska Sandhills" },

  // Northern Michigan
  { display: "Arcadia Bluffs — Bluffs Course",  patterns: ["Arcadia Bluffs"],          state: "MI", region: "Northern Michigan" },
  { display: "Forest Dunes — The Loop (Black)", patterns: ["Loop Black", "The Loop Black", "Forest Dunes Loop"], state: "MI", region: "Northern Michigan" },
  { display: "Forest Dunes — The Loop (Red)",   patterns: ["Loop Red", "The Loop Red"], state: "MI", region: "Northern Michigan" },
  { display: "Bay Harbor Golf Club (Boyne)",    patterns: ["Bay Harbor"],              state: "MI", region: "Northern Michigan" },

  // Pacific Northwest
  { display: "Chambers Bay",                    patterns: ["Chambers Bay"],            state: "WA", region: "Pacific Northwest" },
  { display: "Gamble Sands",                    patterns: ["Gamble Sands"],            state: "WA", region: "Pacific Northwest" },
  { display: "Pumpkin Ridge — Ghost Creek",     patterns: ["Pumpkin Ridge Ghost", "Ghost Creek", "Pumpkin Ridge"], state: "OR", region: "Pacific Northwest" },

  // Long Island
  { display: "Bethpage Black",                  patterns: ["Bethpage Black"],          state: "NY", region: "Long Island" },
  { display: "Bethpage Red",                    patterns: ["Bethpage Red"],            state: "NY", region: "Long Island" },
  { display: "Montauk Downs",                   patterns: ["Montauk Downs"],           state: "NY", region: "Long Island" },

  // Chicago
  { display: "Cog Hill — Dubsdread (No. 4)",    patterns: ["Cog Hill Dubsdread", "Dubsdread", "Cog Hill"], state: "IL", region: "Chicago" },
  { display: "Cantigny Golf",                   patterns: ["Cantigny"],                state: "IL", region: "Chicago" },
  { display: "Harborside International — Port Course", patterns: ["Harborside%Port", "Harborside International"], state: "IL", region: "Chicago" },

  // Coastal Carolina
  { display: "Charleston Municipal Golf Course",     patterns: ["Charleston Municipal"], state: "SC", region: "Coastal Carolina" },
  { display: "Kiawah Island — Osprey Point",         patterns: ["Kiawah%Osprey", "Osprey Point"], state: "SC", region: "Coastal Carolina" },
  { display: "Kiawah Island — The Ocean Course",     patterns: ["Kiawah%Ocean", "Ocean Course"],  state: "SC", region: "Coastal Carolina" },

  // Texas
  { display: "PGA Frisco — Fields Ranch East",  patterns: ["PGA Frisco%Fields", "Fields Ranch East", "Fields Ranch"], state: "TX", region: "Texas" },
  { display: "Trinity Forest Golf Club",        patterns: ["Trinity Forest"],          state: "TX", region: "Texas" },
  { display: "Lions Municipal Golf Course",     patterns: ["Lions Municipal"],         state: "TX", cityHint: "Austin",  region: "Texas" },
  { display: "Memorial Park Golf Course",       patterns: ["Memorial Park"],           state: "TX", cityHint: "Houston", region: "Texas" },
];

// ─── Search ───────────────────────────────────────────────────────────────────

const ENRICHMENT_FIELDS = [
  "description",
  "coverImageUrl",
  "logoUrl",
  "yearEstablished",
  "courseType",
  "zipCode",
  "latitude",
  "longitude",
  "websiteUrl",
  "phone",
];

async function searchCourse(entry) {
  for (const pattern of entry.patterns) {
    let q = supabase
      .from("Course")
      .select(
        "id, name, city, state, zipCode, description, coverImageUrl, logoUrl, yearEstablished, courseType, websiteUrl, phone, holeCount, latitude, longitude, isPublic"
      )
      .ilike("name", `%${pattern}%`)
      .eq("state", entry.state)
      .limit(20);

    const { data, error } = await q;
    if (error) {
      console.error(`  ✗ Query error for ${entry.display}: ${error.message}`);
      continue;
    }
    if (!data || data.length === 0) continue;

    let best = data;
    if (entry.cityHint) {
      const filtered = data.filter((c) =>
        c.city.toLowerCase().includes(entry.cityHint.toLowerCase())
      );
      if (filtered.length > 0) best = filtered;
    }

    if (best.length === 1) return { match: best[0], pattern, ambiguous: false };
    return { match: best[0], pattern, ambiguous: true, candidates: best };
  }
  return null;
}

function nullFields(course) {
  const nulls = [];
  for (const f of ENRICHMENT_FIELDS) {
    const v = course[f];
    if (v === null || v === undefined || v === "") nulls.push(f);
  }
  return nulls;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🏌️  Tour It — Phase 1 Audit");
  console.log("=====================================\n");

  const audit = {
    runAt: new Date().toISOString(),
    masterCount: MASTER.length,
    found: [],
    missing: [],
    ambiguous: [],
    privateFlags: [],
  };

  for (const entry of MASTER) {
    process.stdout.write(`  ${entry.display.padEnd(50)} `);
    const res = await searchCourse(entry);

    if (!res) {
      console.log("❌ NOT FOUND");
      audit.missing.push({
        display: entry.display,
        state: entry.state,
        region: entry.region,
        triedPatterns: entry.patterns,
      });
      continue;
    }

    const { match, pattern, ambiguous, candidates } = res;
    const nulls = nullFields(match);

    if (ambiguous) {
      audit.ambiguous.push({
        display: entry.display,
        chosen: { id: match.id, name: match.name, city: match.city },
        candidates: candidates.map((c) => ({ id: c.id, name: c.name, city: c.city })),
      });
    }

    if (match.courseType === "PRIVATE") {
      audit.privateFlags.push({
        display: entry.display,
        id: match.id,
        name: match.name,
        city: match.city,
      });
    }

    audit.found.push({
      display: entry.display,
      region: entry.region,
      id: match.id,
      name: match.name,
      city: match.city,
      state: match.state,
      courseType: match.courseType,
      isPublic: match.isPublic,
      nullFields: nulls,
      matchPattern: pattern,
      ambiguous,
    });

    const tag = nulls.length === 0 ? "✅ complete" : `⚠️  ${nulls.length} null`;
    const amb = ambiguous ? ` (ambig:${candidates.length})` : "";
    console.log(`${tag}${amb} — ${match.name}`);
  }

  // Summary
  console.log("\n=====================================");
  console.log("Audit Summary");
  console.log("=====================================");
  console.log(`Master list:   ${MASTER.length}`);
  console.log(`Found in DB:   ${audit.found.length}`);
  console.log(`Missing:       ${audit.missing.length}`);
  console.log(`Ambiguous:     ${audit.ambiguous.length}`);
  console.log(`Private flag:  ${audit.privateFlags.length}`);

  const fullySeeded = audit.found.filter((c) => c.nullFields.length === 0).length;
  const needsEnrichment = audit.found.filter((c) => c.nullFields.length > 0).length;
  console.log(`\nFully seeded (no nulls): ${fullySeeded}`);
  console.log(`Needs enrichment:        ${needsEnrichment}`);

  if (audit.missing.length > 0) {
    console.log("\nMissing from DB:");
    audit.missing.forEach((m) => console.log(`  - ${m.display} (${m.state})`));
  }

  if (audit.privateFlags.length > 0) {
    console.log("\nFlagged as PRIVATE (review for swap):");
    audit.privateFlags.forEach((p) => console.log(`  - ${p.display} → ${p.name}, ${p.city}`));
  }

  const outPath = join(process.cwd(), "phase1-audit.json");
  writeFileSync(outPath, JSON.stringify(audit, null, 2));
  console.log(`\n📄 Wrote ${outPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
