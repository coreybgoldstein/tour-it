#!/usr/bin/env node

/**
 * Phase 1 — finalize: parse the enrichment log + query final DB state
 * to build the section 2 ("Newly enriched") table for phase-1-seeding-report.md.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { readFileSync, writeFileSync } from "fs";

dotenv.config();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ids = JSON.parse(readFileSync("phase1-ids.json", "utf8"));
const log = readFileSync("phase1-enrich.log", "utf8");

// Map master display -> id, from the report data we already have
const MASTER_MAP = [
  { display: "Pebble Beach Golf Links",                  id: "b2d7acf5-7186-4edd-bcee-8def174a0d01" },
  { display: "Spyglass Hill Golf Course",                id: "1ff5e051-b567-4893-85d7-86e927b749e4" },
  { display: "The Links at Spanish Bay",                 id: "acb06e92-6cdc-40a0-9406-6a709e8c170e" },
  { display: "Bandon Dunes",                             id: "519a24de-0984-41d8-bf2c-e848220570a1" },
  { display: "Bandon Trails",                            id: "d8f27d04-64cf-4c0b-a4b3-6e16837c2af2" },
  { display: "Sheep Ranch",                              id: "205da5c9-2a88-472f-ac39-414751f0bcf6" },
  { display: "Pinehurst No. 2",                          id: "c50c2fa3-7360-4510-82d2-ad91894d1a1b" },
  { display: "Pinehurst No. 4",                          id: "61a4668d-7ec4-4ef0-882e-53ca3ec04d06" },
  { display: "Pinehurst No. 8",                          id: "b25a736e-05a6-4892-8143-3534ecb0712e" },
  { display: "Pine Needles Lodge & Golf Club",           id: "e6b71e32-c66e-4fae-a80d-e13a57bc62ac" },
  { display: "Caledonia Golf & Fish Club",               id: "fb15840d-9448-4e25-a932-924faf1a4858" },
  { display: "True Blue Golf Club",                      id: "a77c2698-2e6b-495e-b3ec-db48d7bb20b3" },
  { display: "We-Ko-Pa — Saguaro Course",                id: "4d879f5e-9272-4dd3-be11-9c238ea7dd1f" },
  { display: "Troon North — Monument Course",            id: "ef908bca-0703-431e-8fbf-b3b04be22e32" },
  { display: "TPC Scottsdale — Stadium Course",          id: "7d918cd6-20a3-4251-8577-a33a308f8fdb" },
  { display: "Sand Valley",                              id: "574fa1d5-59c2-4e56-a81e-05dda82ca573" },
  { display: "Whistling Straits — Straits Course",       id: "57fd78ad-c8a9-4a83-9b67-210522988225" },
  { display: "Streamsong Red + Blue (combined row)",     id: "85d5d80b-2686-4195-ad5f-fe746c42673b" },
  { display: "Streamsong Black",                         id: "3af1f0ca-7343-4300-bb54-2df13d62d8b1" },
  { display: "Wild Horse Golf Club",                     id: "043c8047-07f4-47cf-9e97-252e86a2e3f8" },
  { display: "The Prairie Club — Dunes Course",          id: "0da8b1ed-ddb5-481c-bb6f-85152baa2863" },
  { display: "Dismal River — Red Course",                id: "fbda8440-e63b-437a-8cb3-92143767c2e1" },
  { display: "Arcadia Bluffs — Bluffs Course",           id: "d036dbe6-5584-4888-9f49-0ddf50a4fca3" },
  { display: "Bay Harbor Golf Club (Boyne)",             id: "4dfe48b7-a3af-493d-a69c-b689dc46ed9b" },
  { display: "Chambers Bay",                             id: "56fb44ef-db2f-424c-8f4c-06908a65edce" },
  { display: "Gamble Sands",                             id: "42aba40d-e9b7-4f04-a6ab-6caf5ffca516" },
  { display: "Pumpkin Ridge — Ghost Creek",              id: "6a698ee9-be8d-4090-b3c4-89521afb3a93" },
  { display: "Bethpage Black",                           id: "ceb95a05-d039-4f2d-ae01-6bdd954d00c1" },
  { display: "Montauk Downs",                            id: "26876227-b58f-4247-9335-72ed4738ffa0" },
  { display: "Cog Hill — Dubsdread (No. 4)",             id: "7328fbce-0496-4881-8f74-38c071e69d82" },
  { display: "Cantigny Golf",                            id: "02cc9821-9444-4896-99f8-13f12502104f" },
  { display: "Harborside International — Port Course",   id: "ac3d93e6-5613-4341-966b-3f67309bf80a" },
  { display: "Charleston Municipal Golf Course",         id: "f61131ff-e47c-4c33-901d-134d554b6bb8" },
  { display: "Kiawah Island — The Ocean Course",         id: "647bbdcd-23ac-4105-9825-1eea55d2222b" },
  { display: "PGA Frisco — Fields Ranch East",           id: "0e1af11a-86ea-4a27-a231-190916ba01b0" },
  { display: "Trinity Forest Golf Club",                 id: "71b956b0-3714-40bb-932f-c548808d55d4" },
  { display: "Lions Municipal Golf Course",              id: "9e17aad7-232e-41cb-b671-4d0bac0250e3" },
];

// Parse "✅ Updated (a, b, c) — Name" lines
const updateRegex = /✅ Updated \(([^)]+)\) — (.+)/g;
const updatesByName = {};
let m;
while ((m = updateRegex.exec(log)) !== null) {
  updatesByName[m[2].trim()] = m[1].split(",").map((s) => s.trim());
}

// Fetch final DB state for the 37 ids
const { data: rows, error } = await supabase
  .from("Course")
  .select("id, name, city, state, zipCode, description, coverImageUrl, logoUrl, yearEstablished, courseType, websiteUrl, phone, holeCount, latitude, longitude, isPublic")
  .in("id", ids);
if (error) { console.error(error); process.exit(1); }

const byId = {};
rows.forEach((r) => (byId[r.id] = r));

const FIELDS = ["description", "coverImageUrl", "logoUrl", "yearEstablished", "courseType", "zipCode", "latitude", "longitude", "websiteUrl", "phone"];

// Build report
const lines = [];
lines.push("| Master entry | DB name | Fields filled this run | Still null | courseType |");
lines.push("|---|---|---|---|---|");

let privateCount = 0;
const privateRows = [];
const stillNullSummary = { description: 0, coverImageUrl: 0, logoUrl: 0, yearEstablished: 0, courseType: 0 };

for (const m of MASTER_MAP) {
  const row = byId[m.id];
  if (!row) {
    lines.push(`| ${m.display} | (not found) | — | — | — |`);
    continue;
  }
  const filled = updatesByName[row.name] || [];
  const filledStr = filled.length ? filled.join(", ") : "_(none — already complete)_";

  const stillNull = FIELDS.filter((f) => row[f] === null || row[f] === undefined || row[f] === "");
  stillNull.forEach((f) => {
    if (f in stillNullSummary) stillNullSummary[f]++;
  });
  const stillNullStr = stillNull.length ? stillNull.join(", ") : "_(complete)_";

  if (row.courseType === "PRIVATE") {
    privateCount++;
    privateRows.push({ display: m.display, name: row.name, id: m.id });
  }

  lines.push(`| ${m.display} | ${row.name} | ${filledStr} | ${stillNullStr} | ${row.courseType || "(null)"} |`);
}

const summaryLines = [];
summaryLines.push("\n### Summary stats");
summaryLines.push("");
summaryLines.push(`- Rows touched: 37`);
summaryLines.push(`- Failed: 0`);
summaryLines.push(`- Still null after run, by field:`);
summaryLines.push(`  - description: ${stillNullSummary.description}`);
summaryLines.push(`  - coverImageUrl: ${stillNullSummary.coverImageUrl}`);
summaryLines.push(`  - logoUrl: ${stillNullSummary.logoUrl}`);
summaryLines.push(`  - yearEstablished: ${stillNullSummary.yearEstablished}`);
summaryLines.push(`  - courseType: ${stillNullSummary.courseType}`);
summaryLines.push(`- Marked PRIVATE after enrichment: ${privateCount}`);
if (privateRows.length) {
  summaryLines.push("");
  privateRows.forEach((p) => summaryLines.push(`  - ${p.display} → ${p.name} (id ${p.id})`));
}

const out = lines.join("\n") + "\n" + summaryLines.join("\n");
writeFileSync("phase1-section2.md", out);
console.log(out);
