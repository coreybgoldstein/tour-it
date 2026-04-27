#!/usr/bin/env node
/**
 * Tour It — Logo Hunter (Google Image Search edition)
 *
 * For every course missing a logoUrl, uses Google Custom Search API to find
 * a logo image, uploads it to Supabase Storage, and writes the public URL to DB.
 *
 * Requires: GOOGLE_SEARCH_KEY and GOOGLE_CSE_ID in .env
 * Free tier: 100 searches/day — run daily to process all courses over ~5 days.
 *
 * Usage:
 *   node src/scripts/hunt-logos.mjs                  # all missing (up to daily quota)
 *   node src/scripts/hunt-logos.mjs --limit 50       # first 50 only
 *   node src/scripts/hunt-logos.mjs --region tampa   # one region
 *   node src/scripts/hunt-logos.mjs --dry-run        # find URLs, skip upload/DB
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
const GOOGLE_SEARCH_KEY = process.env.GOOGLE_SEARCH_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}
if (!GOOGLE_SEARCH_KEY || !GOOGLE_CSE_ID) {
  console.error("Missing GOOGLE_SEARCH_KEY or GOOGLE_CSE_ID");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : Infinity;
const regionIdx = args.indexOf("--region");
const ONLY_REGION = regionIdx !== -1 ? args[regionIdx + 1] : null;

const COURSE_DELAY = 500; // ms between API calls

// ── Region files ──────────────────────────────────────────────────────────────
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

const SKIP_TYPES = new Set(["skip", "driving_range"]);

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "image/*,*/*;q=0.8",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isValidImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (url.includes(".aspx")) return false;
  if (url.includes("getImage.gif")) return false;
  if (url.includes("clubessential")) return false;
  if (url.length < 12) return false;
  // Accept URLs with explicit image extensions OR known image CDN patterns
  const lower = url.toLowerCase();
  const clean = url.split("?")[0].toLowerCase();
  const hasExtension = /\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/.test(lower);
  const isCdnImage = /\/(format|quality|resize|crop)\//i.test(url) ||
    lower.includes("cloudinary.com") ||
    lower.includes("brightspotcdn.com") ||
    lower.includes("imgur.com") ||
    lower.includes("wordpress.com/") ||
    lower.includes("wp-content/uploads");
  return hasExtension || isCdnImage;
}

// ── Google Image Search ───────────────────────────────────────────────────────
async function searchGoogleImages(query) {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", GOOGLE_SEARCH_KEY);
  url.searchParams.set("cx", GOOGLE_CSE_ID);
  url.searchParams.set("q", query);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", "5");
  url.searchParams.set("imgType", "clipart");  // favors logos/crests
  url.searchParams.set("safe", "active");

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return (data.items || []).map((item) => item.link).filter(isValidImageUrl);
  } catch (err) {
    throw err;
  }
}

async function findLogo(course) {
  // Try two search queries — logo-specific first, then broader
  const queries = [
    `"${course.name}" ${course.city} golf club logo`,
    `"${course.name}" golf course logo crest`,
  ];

  for (const query of queries) {
    let results;
    try {
      results = await searchGoogleImages(query);
    } catch (err) {
      throw err; // propagate quota/auth errors
    }
    if (results.length > 0) return results[0];
    await sleep(200);
  }
  return null;
}

// ── Upload ────────────────────────────────────────────────────────────────────
async function uploadLogo(courseId, imageUrl) {
  const clean = imageUrl.split("?")[0];
  const rawExt = clean.split(".").pop().toLowerCase();
  const ext = /^(jpg|jpeg|png|webp|gif|svg)$/.test(rawExt) ? rawExt : "jpg";
  const storagePath = `course-images/${courseId}-logo.${ext}`;

  const res = await fetch(imageUrl, {
    headers: { ...FETCH_HEADERS, Referer: "https://www.google.com/" },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.startsWith("image/") && !contentType.includes("svg")) {
    throw new Error(`Not an image: ${contentType}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 200) throw new Error(`Too small (${buffer.length}b) — likely blocked`);

  const { error } = await supabase.storage
    .from("tour-it-photos")
    .upload(storagePath, buffer, { contentType: contentType || "image/jpeg", upsert: true });

  if (error) throw new Error(`Storage: ${error.message}`);

  const { data: { publicUrl } } = supabase.storage.from("tour-it-photos").getPublicUrl(storagePath);
  return publicUrl;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nTour It — Logo Hunter${DRY_RUN ? " [DRY RUN]" : ""}`);
  console.log("=".repeat(50));

  const regionEntries = {};
  const filesToLoad = ONLY_REGION ? { [ONLY_REGION]: REGION_FILES[ONLY_REGION] } : REGION_FILES;

  for (const [region, filename] of Object.entries(filesToLoad)) {
    const filepath = path.join(ROOT, filename);
    if (!fs.existsSync(filepath)) continue;
    const data = JSON.parse(fs.readFileSync(filepath, "utf8"));
    data.filter((e) => !SKIP_TYPES.has(e.courseType)).forEach((e) => { regionEntries[e.id] = region; });
  }

  const allIds = Object.keys(regionEntries);
  console.log(`Checking ${allIds.length} courses for missing logos...`);

  const dbRecords = {};
  for (let i = 0; i < allIds.length; i += 50) {
    const { data } = await supabase
      .from("Course")
      .select("id, name, city, state, logoUrl")
      .in("id", allIds.slice(i, i + 50));
    (data || []).forEach((r) => (dbRecords[r.id] = r));
  }

  const missing = Object.values(dbRecords).filter((r) => !r.logoUrl).slice(0, LIMIT);
  console.log(`Missing logos: ${missing.length}${LIMIT < Infinity ? ` (capped at ${LIMIT})` : ""}`);
  console.log(`Google quota: ~100/day (2 queries per course = ~50 courses/day)\n`);

  if (missing.length === 0) { console.log("Nothing to do."); return; }

  let found = 0, uploaded = 0, notFound = 0, failed = 0;
  const failedList = [];

  for (let i = 0; i < missing.length; i++) {
    const course = missing[i];
    process.stdout.write(`[${i + 1}/${missing.length}] ${course.name}...`);

    let logoUrl;
    try {
      logoUrl = await findLogo(course);
    } catch (err) {
      // Quota exceeded — stop cleanly
      if (err.message?.includes("quota") || err.message?.includes("429") || err.message?.includes("403")) {
        console.log(`\n\nDaily quota reached after ${i} courses. Run again tomorrow.`);
        break;
      }
      failed++;
      failedList.push({ name: course.name, err: err.message });
      console.log(` ✗ search error: ${err.message}`);
      await sleep(COURSE_DELAY);
      continue;
    }

    if (!logoUrl) {
      notFound++;
      console.log(" ✗ not found");
      await sleep(COURSE_DELAY);
      continue;
    }

    found++;
    console.log(`\n  🔍 ${logoUrl.substring(0, 90)}`);

    if (DRY_RUN) {
      console.log("     [dry-run — would upload]");
      await sleep(COURSE_DELAY);
      continue;
    }

    try {
      const publicUrl = await uploadLogo(course.id, logoUrl);
      await supabase.from("Course").update({ logoUrl: publicUrl, updatedAt: new Date().toISOString() }).eq("id", course.id);
      uploaded++;
      console.log(`  ✅ ${publicUrl.substring(0, 90)}`);
    } catch (err) {
      failed++;
      failedList.push({ name: course.name, err: err.message });
      console.error(`  ✗ upload failed: ${err.message}`);
    }

    await sleep(COURSE_DELAY);
  }

  console.log("\n" + "=".repeat(50));
  console.log(`Found:     ${found}`);
  console.log(`Uploaded:  ${uploaded}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Failed:    ${failed}`);

  if (failedList.length > 0) {
    console.log("\nFailed:");
    failedList.slice(0, 20).forEach((f) => console.log(`  - ${f.name}: ${f.err}`));
  }

  console.log(DRY_RUN ? "\n[DRY RUN — no changes written]" : "\nDone.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
