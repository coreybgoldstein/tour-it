#!/usr/bin/env node
/**
 * Tour It — Florida Course Enrichment
 *
 * Reads pre-researched course data from the 9 region JSON files in the project
 * root and UPDATEs existing Supabase records. Never inserts new rows.
 * Images are fetched externally and uploaded to Supabase Storage before the
 * URL is stored in the DB.
 *
 * Usage:
 *   node src/scripts/enrich-florida-courses.mjs
 *   node src/scripts/enrich-florida-courses.mjs --region tampa
 *   node src/scripts/enrich-florida-courses.mjs --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse args
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const regionArg = args.indexOf("--region");
const ONLY_REGION = regionArg !== -1 ? args[regionArg + 1] : null;

const REGION_FILES = {
  orlando: "research-orlando.json",
  tampa: "research-tampa.json",
  charlotte_sarasota: "research-charlotte_sarasota.json",
  broward: "research-broward.json",
  swfl: "research-swfl.json",
  palm_beach: "research-palm_beach.json",
  keys_miami: "research-keys_miami.json",
  treasure_space: "research-treasure_space.json",
  central: "research-central.json",
};

// Courseypes that should be skipped entirely (no DB record to enrich)
const SKIP_TYPES = new Set(["skip", "driving_range"]);

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function uploadImage(courseId, imageUrl, type) {
  if (!imageUrl) return null;

  const cleanUrl = imageUrl.split("?")[0];
  const rawExt = cleanUrl.split(".").pop().toLowerCase();
  const ext = /^(jpg|jpeg|png|webp|gif|svg)$/.test(rawExt) ? rawExt : "jpg";
  const storagePath = `course-images/${courseId}-${type}.${ext}`;

  try {
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) throw new Error(`Not an image: ${contentType}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 100) throw new Error(`Suspiciously small image (${buffer.length} bytes)`);

    const { error } = await supabase.storage
      .from("tour-it-photos")
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (error) throw new Error(`Storage: ${error.message}`);

    const {
      data: { publicUrl },
    } = supabase.storage.from("tour-it-photos").getPublicUrl(storagePath);

    return publicUrl;
  } catch (err) {
    console.warn(`    ⚠ Image upload failed (${type}): ${err.message}`);
    return null;
  }
}

async function enrichOne(entry, dbRecord, dryRun) {
  const updates = {};

  // City correction always applied
  if (entry.cityCorrection && dbRecord.city !== entry.cityCorrection) {
    updates.city = entry.cityCorrection;
  }

  // Enrich null DB fields only
  if (!dbRecord.description && entry.description) updates.description = entry.description;
  if (!dbRecord.yearEstablished && entry.yearEstablished) updates.yearEstablished = entry.yearEstablished;
  if (!dbRecord.access && entry.access) updates.access = entry.access;
  if (!dbRecord.zipCode && entry.zipCode) updates.zipCode = entry.zipCode;

  // isPublic — update if access is being set or corrected
  if (entry.access && dbRecord.isPublic === null) {
    updates.isPublic = entry.isPublic !== undefined ? entry.isPublic : entry.access === "Public";
  }

  // Images — fetch + upload if not already in DB
  if (!dbRecord.coverImageUrl && entry.coverImageUrl) {
    if (!dryRun) {
      const url = await uploadImage(entry.id, entry.coverImageUrl, "cover");
      if (url) updates.coverImageUrl = url;
    } else {
      updates.coverImageUrl = "(would upload from: " + entry.coverImageUrl + ")";
    }
  }
  if (!dbRecord.logoUrl && entry.logoUrl) {
    if (!dryRun) {
      const url = await uploadImage(entry.id, entry.logoUrl, "logo");
      if (url) updates.logoUrl = url;
    } else {
      updates.logoUrl = "(would upload from: " + entry.logoUrl + ")";
    }
  }

  if (Object.keys(updates).length === 0) return null;

  if (!dryRun) {
    updates.updatedAt = new Date().toISOString();
    const { error } = await supabase.from("Course").update(updates).eq("id", entry.id);
    if (error) throw new Error(error.message);
  }

  return Object.keys(updates).filter((k) => k !== "updatedAt");
}

async function main() {
  console.log(`\nTour It — Florida Course Enrichment${DRY_RUN ? " [DRY RUN]" : ""}`);
  console.log("=".repeat(50));

  // Load research data
  const allEntries = [];
  const filesToProcess = ONLY_REGION
    ? { [ONLY_REGION]: REGION_FILES[ONLY_REGION] }
    : REGION_FILES;

  for (const [region, filename] of Object.entries(filesToProcess)) {
    const filepath = path.join(ROOT, filename);
    if (!fs.existsSync(filepath)) {
      console.warn(`Missing: ${filename} — skipping ${region}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filepath, "utf8"));
    allEntries.push(...data.map((e) => ({ ...e, _region: region })));
    console.log(`Loaded ${region}: ${data.length} entries`);
  }

  const toProcess = allEntries.filter((e) => !SKIP_TYPES.has(e.courseType));
  const skippedCount = allEntries.length - toProcess.length;

  console.log(`\nTotal: ${allEntries.length} | Processing: ${toProcess.length} | Skipping: ${skippedCount}`);

  // Deduplicate by ID
  const uniqueById = new Map();
  for (const e of toProcess) {
    if (!uniqueById.has(e.id)) uniqueById.set(e.id, e);
  }
  const deduped = [...uniqueById.values()];
  if (deduped.length < toProcess.length) {
    console.log(`Deduped: ${toProcess.length - deduped.length} duplicate IDs removed`);
  }

  // Fetch current DB records in batches of 50
  const ids = deduped.map((e) => e.id);
  const dbRecords = {};
  const BATCH = 50;
  console.log(`\nFetching ${ids.length} DB records...`);
  for (let i = 0; i < ids.length; i += BATCH) {
    const { data, error } = await supabase
      .from("Course")
      .select("id, name, description, coverImageUrl, logoUrl, yearEstablished, access, zipCode, isPublic, city")
      .in("id", ids.slice(i, i + BATCH));

    if (error) {
      console.error(`DB fetch error: ${error.message}`);
      continue;
    }
    for (const r of data || []) dbRecords[r.id] = r;
  }
  console.log(`Found ${Object.keys(dbRecords).length} / ${ids.length} in DB\n`);

  // Process
  let updated = 0,
    noChange = 0,
    notFound = 0,
    failed = 0;
  const failedList = [];

  for (const entry of deduped) {
    const db = dbRecords[entry.id];
    if (!db) {
      notFound++;
      continue;
    }

    try {
      const changed = await enrichOne(entry, db, DRY_RUN);
      if (changed) {
        updated++;
        console.log(`  ✅ ${db.name}`);
        console.log(`     [${changed.join(", ")}]`);
      } else {
        noChange++;
      }
    } catch (err) {
      failed++;
      failedList.push({ name: db.name, err: err.message });
      console.error(`  ✗ ${db.name}: ${err.message}`);
    }

    // Tiny pause to avoid hammering the API / DB
    await sleep(50);
  }

  console.log("\n" + "=".repeat(50));
  console.log(`Updated:   ${updated}`);
  console.log(`No change: ${noChange}`);
  console.log(`Not in DB: ${notFound}`);
  console.log(`Failed:    ${failed}`);

  if (failedList.length > 0) {
    console.log("\nFailed courses:");
    failedList.forEach((f) => console.log(`  - ${f.name}: ${f.err}`));
  }

  console.log(DRY_RUN ? "\n[DRY RUN — no changes written]" : "\nDone.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
