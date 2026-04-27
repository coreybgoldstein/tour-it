#!/usr/bin/env node
/**
 * Tour It — Logo Hunter (no-cost scraper edition)
 *
 * For every course missing a logoUrl, tries multiple golf listing sites to
 * find a direct image URL, then uploads to Supabase Storage and writes the DB.
 * No Anthropic API required — pure HTTP fetching.
 *
 * Usage:
 *   node src/scripts/hunt-logos.mjs                  # all missing
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

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
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

// ms between courses to avoid rate-limiting
const COURSE_DELAY = 800;

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

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function isValidImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (url.includes(".aspx")) return false;
  if (url.includes("getImage.gif")) return false;
  if (url.includes("clubessential")) return false;
  if (url.length < 10) return false;
  const clean = url.split("?")[0].toLowerCase();
  return /\.(jpg|jpeg|png|webp|gif|svg)$/.test(clean);
}

function extractOgImage(html) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1] && isValidImageUrl(m[1])) return m[1];
  }
  return null;
}

function extractLogoFromHtml(html) {
  // Try og:image first
  const og = extractOgImage(html);
  if (og) return og;

  // Look for logo-specific img tags
  const logoPatterns = [
    /src=["']([^"']*logo[^"']*\.(png|jpg|jpeg|webp|svg)[^"']*)["']/i,
    /src=["']([^"']*crest[^"']*\.(png|jpg|jpeg|webp|svg)[^"']*)["']/i,
    /src=["']([^"']*emblem[^"']*\.(png|jpg|jpeg|webp|svg)[^"']*)["']/i,
  ];
  for (const re of logoPatterns) {
    const m = html.match(re);
    if (m?.[1] && isValidImageUrl(m[1])) return m[1];
  }
  return null;
}

async function fetchHtml(url, extraHeaders = {}) {
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, ...extraHeaders },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html") && !ct.includes("text")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function checkImageUrl(url) {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    return ct.startsWith("image/") || ct.includes("svg");
  } catch {
    return false;
  }
}

// ── Source strategies (tried in order) ───────────────────────────────────────

async function tryBluegolf(name) {
  const slug = toSlug(name);
  const url = `https://logos.bluegolf.com/${slug}/profile.png`;
  const ok = await checkImageUrl(url);
  return ok ? url : null;
}

async function tryGolfNow(name, city, state) {
  const q = encodeURIComponent(`${name} ${city} ${state}`);
  const searchUrl = `https://www.golfnow.com/tee-times/search#searchtext=${q}`;
  // GolfNow search is JS-rendered — try their static course pages instead
  const slug = toSlug(name);
  const candidates = [
    `https://www.golfnow.com/courses/${slug}`,
    `https://www.golfnow.com/courses/${slug}-golf-course`,
    `https://www.golfnow.com/courses/${slug}-country-club`,
  ];
  for (const url of candidates) {
    const html = await fetchHtml(url);
    if (!html) continue;
    const img = extractLogoFromHtml(html);
    if (img) return img;
  }
  return null;
}

async function tryGolfAdvisor(name, city) {
  const slug = toSlug(`${name} ${city}`);
  const url = `https://www.golfadvisor.com/courses/${slug}`;
  const html = await fetchHtml(url);
  if (!html) return null;
  return extractLogoFromHtml(html);
}

async function tryTeeOff(name, city) {
  const slug = toSlug(`${name} ${city}`);
  const candidates = [
    `https://www.teeoff.com/golf-courses/${slug}`,
    `https://www.teeoff.com/golf-courses/${toSlug(name)}`,
  ];
  for (const url of candidates) {
    const html = await fetchHtml(url);
    if (!html) continue;
    const img = extractLogoFromHtml(html);
    if (img) return img;
  }
  return null;
}

async function tryGolfpass(name, city) {
  const slug = toSlug(`${name} ${city}`);
  const url = `https://www.golfpass.com/travel-advisor/courses/${slug}/`;
  const html = await fetchHtml(url);
  if (!html) return null;
  return extractLogoFromHtml(html);
}

async function tryTeeTimesUSA(name) {
  // Search their site for the course
  const q = encodeURIComponent(name);
  const url = `https://www.teetimesusa.com/golf/florida/?s=${q}`;
  const html = await fetchHtml(url);
  if (!html) return null;
  // Their logo CDN: ttusa.s3.amazonaws.com/images/gallery/_logos/l{id}.jpg
  const m = html.match(/ttusa\.s3\.amazonaws\.com\/images\/gallery\/_logos\/l(\d+)\.(jpg|png)/i);
  return m ? `https://${m[0]}` : null;
}

// ── Main logo search for one course ──────────────────────────────────────────
async function findLogo(course) {
  const strategies = [
    () => tryBluegolf(course.name),
    () => tryGolfNow(course.name, course.city, course.state),
    () => tryGolfAdvisor(course.name, course.city),
    () => tryTeeOff(course.name, course.city),
    () => tryGolfpass(course.name, course.city),
    () => tryTeeTimesUSA(course.name),
  ];

  for (const strategy of strategies) {
    const url = await strategy();
    if (url && isValidImageUrl(url)) return url;
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
    headers: { ...HEADERS, Referer: "https://www.google.com/" },
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
  console.log(`Missing logos: ${missing.length}${LIMIT < Infinity ? ` (capped at ${LIMIT})` : ""}\n`);

  if (missing.length === 0) { console.log("Nothing to do."); return; }

  let found = 0, uploaded = 0, notFound = 0, failed = 0;
  const failedList = [];

  for (let i = 0; i < missing.length; i++) {
    const course = missing[i];
    process.stdout.write(`[${i + 1}/${missing.length}] ${course.name}...`);

    const logoUrl = await findLogo(course);

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
