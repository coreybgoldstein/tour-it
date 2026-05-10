#!/usr/bin/env node

/**
 * Phase 1 — final-state snapshot for the report.
 * Reads phase1-inserts.json, queries final DB state for everything touched,
 * and emits markdown tables for sections 3a, 3b, 4a, 4b plus a null-image list.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { readFileSync, writeFileSync } from "fs";

dotenv.config();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const inserts = JSON.parse(readFileSync("phase1-inserts.json", "utf8"));

// All 39 ids that map to a master entry now (37 from phase1 enrich + 11 new + 2 swap-existing - 1 (kiawah dupe gone))
const ALL_MASTER_IDS = [
  // Original 37 enriched
  "b2d7acf5-7186-4edd-bcee-8def174a0d01", // Pebble Beach
  "1ff5e051-b567-4893-85d7-86e927b749e4", // Spyglass Hill
  "acb06e92-6cdc-40a0-9406-6a709e8c170e", // Spanish Bay
  "519a24de-0984-41d8-bf2c-e848220570a1", // Bandon Dunes
  "d8f27d04-64cf-4c0b-a4b3-6e16837c2af2", // Bandon Trails
  "205da5c9-2a88-472f-ac39-414751f0bcf6", // Bandon Sheep Ranch (post-fix PUBLIC)
  "c50c2fa3-7360-4510-82d2-ad91894d1a1b", // Pinehurst No. 2
  "61a4668d-7ec4-4ef0-882e-53ca3ec04d06", // Pinehurst No. 4
  "b25a736e-05a6-4892-8143-3534ecb0712e", // Pinehurst No. 8
  "e6b71e32-c66e-4fae-a80d-e13a57bc62ac", // Pine Needles
  "fb15840d-9448-4e25-a932-924faf1a4858", // Caledonia
  "a77c2698-2e6b-495e-b3ec-db48d7bb20b3", // True Blue
  "4d879f5e-9272-4dd3-be11-9c238ea7dd1f", // We-Ko-Pa
  "ef908bca-0703-431e-8fbf-b3b04be22e32", // Troon North
  "7d918cd6-20a3-4251-8577-a33a308f8fdb", // TPC Scottsdale Stadium
  "574fa1d5-59c2-4e56-a81e-05dda82ca573", // Sand Valley
  "57fd78ad-c8a9-4a83-9b67-210522988225", // Whistling Straits
  "85d5d80b-2686-4195-ad5f-fe746c42673b", // Streamsong Red (renamed)
  "3af1f0ca-7343-4300-bb54-2df13d62d8b1", // Streamsong Black
  "043c8047-07f4-47cf-9e97-252e86a2e3f8", // Wild Horse
  "0da8b1ed-ddb5-481c-bb6f-85152baa2863", // The Prairie Club
  "d036dbe6-5584-4888-9f49-0ddf50a4fca3", // Arcadia Bluffs
  "4dfe48b7-a3af-493d-a69c-b689dc46ed9b", // Bay Harbor
  "56fb44ef-db2f-424c-8f4c-06908a65edce", // Chambers Bay
  "42aba40d-e9b7-4f04-a6ab-6caf5ffca516", // Gamble Sands
  "6a698ee9-be8d-4090-b3c4-89521afb3a93", // Pumpkin Ridge
  "ceb95a05-d039-4f2d-ae01-6bdd954d00c1", // Bethpage Black
  "26876227-b58f-4247-9335-72ed4738ffa0", // Montauk Downs
  "7328fbce-0496-4881-8f74-38c071e69d82", // Cog Hill
  "02cc9821-9444-4896-99f8-13f12502104f", // Cantigny
  "ac3d93e6-5613-4341-966b-3f67309bf80a", // Harborside Port
  "f61131ff-e47c-4c33-901d-134d554b6bb8", // Charleston Municipal
  "647bbdcd-23ac-4105-9825-1eea55d2222b", // Kiawah Ocean (kept, dupe deleted)
  "0e1af11a-86ea-4a27-a231-190916ba01b0", // Fields Ranch East (post-fix PUBLIC)
  "9e17aad7-232e-41cb-b671-4d0bac0250e3", // Lions Municipal
  // Swap targets that already existed
  "d1421163-0cb3-44ef-b113-125af4c4bc34", // Bayside GC
  "e7d8259a-56f8-4e95-b113-dee13ea570a3", // Cowboys GC
  // 11 newly inserted
  ...inserts.filter((i) => i.status === "inserted").map((i) => i.courseId),
];

const { data: rows } = await supabase
  .from("Course")
  .select("id, name, city, state, courseType, isPublic, description, coverImageUrl, logoUrl, yearEstablished, websiteUrl, phone")
  .in("id", ALL_MASTER_IDS);

console.log(`\n=== Coverage snapshot — ${rows.length} of ${ALL_MASTER_IDS.length} expected rows present ===\n`);

const nullImages = { covers: [], logos: [] };
const stillPrivate = [];

for (const r of rows) {
  if (!r.coverImageUrl) nullImages.covers.push({ id: r.id, name: r.name, city: r.city, state: r.state });
  if (!r.logoUrl) nullImages.logos.push({ id: r.id, name: r.name, city: r.city, state: r.state });
  if (r.courseType === "PRIVATE") stillPrivate.push({ id: r.id, name: r.name });
}

console.log(`Null coverImageUrl: ${nullImages.covers.length} of ${rows.length}`);
console.log(`Null logoUrl: ${nullImages.logos.length} of ${rows.length}`);
console.log(`Still PRIVATE: ${stillPrivate.length}`);
stillPrivate.forEach((p) => console.log(`  - ${p.name} (${p.id})`));

// Inserts table
console.log("\n=== Newly inserted rows ===\n");
console.log("| Master entry | DB name | Course id | Replaces / fills |");
console.log("|---|---|---|---|");
for (const i of inserts) {
  if (i.status !== "inserted") continue;
  const replacing = i.masterReplacing ? `replaces ${i.masterReplacing}` : "missing master entry";
  console.log(`| ${i.name} | ${i.fields ? "(see fields)" : ""} | \`${i.courseId}\` | ${replacing} |`);
}

console.log("\n=== Skipped (already existed) ===\n");
for (const i of inserts) {
  if (i.status !== "skipped-already-exists") continue;
  console.log(`- ${i.name} → ${i.existingId}`);
}

// Verify Streamsong rename
const { data: ss } = await supabase
  .from("Course")
  .select("id, name")
  .ilike("name", "%Streamsong%")
  .order("name");
console.log("\n=== Streamsong rows ===");
ss?.forEach((s) => console.log(`  ${s.name} [${s.id}]`));

// Verify single Kiawah Ocean row
const { data: oc } = await supabase
  .from("Course")
  .select("id, name, city, state")
  .ilike("name", "%Kiawah%")
  .order("name");
console.log("\n=== Kiawah rows ===");
oc?.forEach((s) => console.log(`  ${s.name} — ${s.city}, ${s.state}  [${s.id}]`));

writeFileSync("phase1-final-state.json", JSON.stringify({ rows, nullImages, stillPrivate, streamsong: ss, kiawah: oc, inserts }, null, 2));
console.log("\n📄 phase1-final-state.json written");
