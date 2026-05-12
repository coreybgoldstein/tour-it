#!/usr/bin/env node

/**
 * Tour It — Insert Top 100 Public missing courses
 *
 * The Top 100 Public matching pipeline (see match-top100-public.mjs) found 87
 * of 100 ranked courses already in the DB. The 13 below were either too new
 * or otherwise missing. Per founder sign-off, this script INSERTs them so they
 * can be enriched by the existing pipeline:
 *
 *   1. node src/scripts/insert-top100-missing.mjs              (this script)
 *   2. node src/scripts/seed-courses-bulk.mjs        --ids-file top100-inserted-ids.txt
 *   3. node src/scripts/seed-scorecards-from-api.mjs --ids-file top100-inserted-ids.txt
 *   4. node src/scripts/scrape-course-assets.mjs     --ids-file top100-inserted-ids.txt
 *   5. node src/scripts/fill-placeholder-logos.mjs   --ids-file top100-inserted-ids.txt
 *
 * Inserts the minimum fields needed for the downstream scripts to find a row
 * (name, slug, city, state, holeCount, isPublic, courseType, timestamps) plus
 * 18 placeholder Hole rows (par 4 default — real scorecards come in step 3).
 *
 * Skip-if-exists: pre-flights each row by exact (lowercase) name + state
 * match to avoid double-inserting if the upstream sync has since added one.
 *
 * Writes the new course IDs to top100-inserted-ids.txt at repo root.
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Targets ──────────────────────────────────────────────────────────────────
// All 13 are public/resort-bookable per the Golf Digest source list. Two are
// resort-only (no walk-on tee times for the general public without staying):
//   • Payne's Valley — Big Cedar Lodge resort
//   • Sea Island Seaside — Cloister/Lodge resort guests
// Both still take outside play, so courseType=PUBLIC is correct for filters;
// noted below for the report.

const NEW_COURSES = [
  {
    rank: 12,
    name: "The Lido at Sand Valley",
    city: "Nekoosa",
    state: "WI",
    holeCount: 18,
    courseType: "PUBLIC",
    note: "Tom Doak 2023 re-creation of the C.B. Macdonald Lido. Public resort.",
  },
  {
    rank: 24,
    name: "Landmand Golf Club",
    city: "Homer",
    state: "NE",
    holeCount: 18,
    courseType: "PUBLIC",
    note: "King-Collins 2022 design overlooking Missouri River loess hills.",
  },
  {
    rank: 30,
    name: "Pinehurst Resort - No. 10",
    city: "Pinehurst",
    state: "NC",
    holeCount: 18,
    courseType: "PUBLIC",
    note: "Tom Doak 2024 design on the Pit Golf Links site.",
  },
  {
    rank: 41,
    name: "Pronghorn Club at Juniper Reserve - Nicklaus Course",
    city: "Bend",
    state: "OR",
    holeCount: 18,
    courseType: "PUBLIC",
    note: "Jack Nicklaus 2007 design at Juniper Reserve (rebranded from Pronghorn). Public resort.",
  },
  {
    rank: 45,
    name: "Sea Island Golf Club - Seaside Course",
    city: "St. Simons Island",
    state: "GA",
    holeCount: 18,
    courseType: "PUBLIC",
    note: "Colt & Alison 1929, Tom Fazio renovation. Hosts PGA Tour RSM Classic. Resort/semi-public.",
  },
  {
    rank: 50,
    name: "Cabot Citrus Farms - Karoo",
    city: "Brooksville",
    state: "FL",
    holeCount: 18,
    courseType: "PUBLIC",
    note: "Kyle Franz / Mike Nuzzo 2024 redesign of former World Woods Pine Barrens.",
  },
  {
    rank: 51,
    name: "Sedge Valley at Sand Valley",
    city: "Nekoosa",
    state: "WI",
    holeCount: 18,
    courseType: "PUBLIC",
    note: "Tom Doak 2024 design, sub-6300 yard heathland-style. Public resort.",
  },
  {
    rank: 57,
    name: "Wilderness Club",
    city: "Eureka",
    state: "MT",
    holeCount: 18,
    courseType: "PUBLIC",
    note: "Nick Faldo 2007 design near Glacier National Park.",
  },
  {
    rank: 59,
    name: "Wolf Creek Golf Club",
    city: "Mesquite",
    state: "NV",
    holeCount: 18,
    courseType: "PUBLIC",
    note: "Dennis Rider 2000 design carved through Mojave canyons.",
  },
  {
    rank: 64,
    name: "Nemacolin - Mystic Rock",
    city: "Farmington",
    state: "PA",
    holeCount: 18,
    courseType: "PUBLIC",
    note: "Pete Dye 1995 design at Nemacolin Woodlands Resort. Hosted PGA Tour 84 Lumber Classic.",
  },
  {
    rank: 81,
    name: "Payne's Valley at Big Cedar Lodge",
    city: "Hollister",
    state: "MO",
    holeCount: 18,
    courseType: "PUBLIC",
    note: "Tiger Woods/TGR Design's first public course, 2020. Big Cedar Lodge resort. (Famous 19th bonus hole; we store as 18.)",
  },
  {
    rank: 82,
    name: "Mossy Oak Golf Club",
    city: "West Point",
    state: "MS",
    holeCount: 18,
    courseType: "PUBLIC",
    note: "Gil Hanse 2016 design, sister property to Old Waverly.",
  },
  {
    rank: 90,
    name: "The Prairie Club - Pines Course",
    city: "Valentine",
    state: "NE",
    holeCount: 18,
    courseType: "PUBLIC",
    note: "Graham Marsh 2010 design in Sandhills overlooking Snake River canyon.",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureUniqueSlug(base) {
  let candidate = base;
  let n = 1;
  while (true) {
    const { data } = await supabase.from("Course").select("id").eq("slug", candidate).limit(1);
    if (!data || data.length === 0) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

async function preflight(target) {
  // Check by exact (case-insensitive) name + state — if anything close already
  // exists, surface it and skip rather than double-insert.
  const { data } = await supabase
    .from("Course")
    .select("id, name, city, state")
    .eq("state", target.state)
    .ilike("name", target.name)
    .limit(5);
  return data || [];
}

async function insertOne(target) {
  const existing = await preflight(target);
  if (existing.length > 0) {
    return {
      rank: target.rank,
      name: target.name,
      status: "skipped-already-exists",
      existingId: existing[0].id,
      existingName: existing[0].name,
    };
  }

  const slugBase = slugify(`${target.name}-${target.city}-${target.state}`);
  const slug = await ensureUniqueSlug(slugBase);
  const id = randomUUID();
  const now = new Date().toISOString();
  const isPublic = target.courseType === "PUBLIC" || target.courseType === "SEMI_PRIVATE";

  const row = {
    id,
    name: target.name,
    slug,
    city: target.city,
    state: target.state,
    country: "US",
    holeCount: target.holeCount,
    isPublic,
    courseType: target.courseType,
    isVerified: false,
    uploadCount: 0,
    saveCount: 0,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const { error: insErr } = await supabase.from("Course").insert(row);
  if (insErr) {
    return { rank: target.rank, name: target.name, status: "error", error: insErr.message };
  }

  // Placeholder holes — par 4 default, scorecard fill happens in step 3.
  const holes = Array.from({ length: target.holeCount }, (_, i) => ({
    id: randomUUID(),
    courseId: id,
    holeNumber: i + 1,
    par: 4,
    uploadCount: 0,
    createdAt: now,
    updatedAt: now,
  }));
  const { error: holeErr } = await supabase.from("Hole").insert(holes);
  if (holeErr) {
    console.log(`    ⚠ Hole insert: ${holeErr.message}`);
  }

  return {
    rank: target.rank,
    name: target.name,
    status: "inserted",
    courseId: id,
    slug,
    holeCount: target.holeCount,
    note: target.note,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🏌️  Tour It — Insert Top 100 Public missing (13 courses)");
  console.log("==========================================================\n");

  const results = [];
  for (const target of NEW_COURSES) {
    process.stdout.write(`  #${String(target.rank).padStart(2, " ")}  ${target.name.padEnd(55, " ")} `);
    try {
      const r = await insertOne(target);
      results.push(r);
      if (r.status === "inserted") {
        console.log(`✅ ${r.courseId}`);
      } else if (r.status === "skipped-already-exists") {
        console.log(`⏭  skipped → ${r.existingId} ("${r.existingName}")`);
      } else {
        console.log(`✗ ${r.error || r.status}`);
      }
    } catch (e) {
      console.log(`✗ ${e.message}`);
      results.push({ rank: target.rank, name: target.name, status: "exception", error: e.message });
    }
  }

  // Output IDs file
  const insertedIds = results.filter((r) => r.status === "inserted").map((r) => r.courseId);
  const idsFile = path.resolve(REPO_ROOT, "top100-inserted-ids.txt");
  writeFileSync(idsFile, insertedIds.join("\n") + "\n");
  console.log(`\nWrote ${insertedIds.length} IDs → ${idsFile}`);

  // JSON report
  const reportFile = path.resolve(REPO_ROOT, "top100-inserted-report.json");
  writeFileSync(reportFile, JSON.stringify(results, null, 2));

  // Summary
  console.log("\n==========================================================");
  console.log("Summary");
  console.log("==========================================================");
  const ok = results.filter((r) => r.status === "inserted");
  const skip = results.filter((r) => r.status === "skipped-already-exists");
  const fail = results.filter((r) => r.status !== "inserted" && r.status !== "skipped-already-exists");
  console.log(`✅ Inserted: ${ok.length}`);
  console.log(`⏭  Skipped (already exists): ${skip.length}`);
  console.log(`✗  Failed: ${fail.length}`);
  if (fail.length) {
    console.log("\nFailures:");
    fail.forEach((f) => console.log(`  - #${f.rank} ${f.name}: ${f.error || f.status}`));
  }
  if (skip.length) {
    console.log("\nSkipped (already in DB):");
    skip.forEach((s) => console.log(`  - #${s.rank} ${s.name} → ${s.existingId}`));
  }
  console.log("\nNext steps:");
  console.log("  node src/scripts/seed-courses-bulk.mjs        --ids-file top100-inserted-ids.txt");
  console.log("  node src/scripts/seed-scorecards-from-api.mjs --ids-file top100-inserted-ids.txt");
  console.log("  node src/scripts/scrape-course-assets.mjs     --ids-file top100-inserted-ids.txt");
  console.log("  node src/scripts/fill-placeholder-logos.mjs   --ids-file top100-inserted-ids.txt");
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
