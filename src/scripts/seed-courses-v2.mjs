/**
 * Tour It — Course Seeder v2
 *
 * Pipeline per course:
 *   1. Golf Course API  → structured facts (name, address, par, yardage)
 *   2. Google Custom Search → cover photo + logo image URLs
 *   3. Claude Haiku     → 2-sentence description from facts (~$0.001/course)
 *   4. Supabase Storage → upload images
 *   5. DB upsert        → update existing record or insert new one + 18 holes
 *
 * Usage:
 *   node src/scripts/seed-courses-v2.mjs --list "Plantation Preserve,Pebble Beach"
 *   node src/scripts/seed-courses-v2.mjs --zip 33317
 *   node src/scripts/seed-courses-v2.mjs --zip 33317,33069
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import { randomUUID } from "crypto";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const { Client } = require("pg");
const Anthropic = require("@anthropic-ai/sdk");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ── Clients ──────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const db = new Client({ connectionString: process.env.DATABASE_URL });

const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

const GOLF_API_KEY = process.env.GOLF_COURSE_API_KEY;
const GOOGLE_KEY = process.env.GOOGLE_SEARCH_KEY;
const GOOGLE_CX = process.env.GOOGLE_CSE_ID;

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(name, city = "") {
  return [name, city]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { zips: [], list: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--zip" && args[i + 1])
      result.zips = args[i + 1].split(",").map((z) => z.trim());
    if (args[i] === "--list" && args[i + 1])
      result.list = args[i + 1].split(",").map((n) => n.trim());
  }
  return result;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Step 1: Golf Course API ───────────────────────────────────────────────────

async function searchGolfCourseAPI(query) {
  const url = `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Authorization: `Key ${GOLF_API_KEY}` } });
  if (!res.ok) throw new Error(`Golf API error ${res.status}`);
  const { courses } = await res.json();
  return courses || [];
}

async function getGolfCourseById(id) {
  const res = await fetch(`https://api.golfcourseapi.com/v1/courses/${id}`, {
    headers: { Authorization: `Key ${GOLF_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Golf API error ${res.status}`);
  return res.json();
}

function extractCourseStats(course) {
  // Pull par and yardage from the longest tee set (usually "BACK" or "BLUE")
  const tees = [
    ...(course.tees?.male || []),
    ...(course.tees?.female || []),
  ];
  const backTee = tees.find((t) => /back|blue|championship/i.test(t.tee_name)) || tees[0];
  return {
    par: backTee?.par_total || null,
    yardage: backTee?.total_yards || null,
    slope: backTee?.slope_rating || null,
    rating: backTee?.course_rating || null,
    holes: backTee?.number_of_holes || 18,
  };
}

// ── Step 2: Image search (Google CSE → TeeTimesUSA fallback) ─────────────────

async function googleImageSearch(query) {
  if (!GOOGLE_KEY || !GOOGLE_CX) return null;
  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_KEY}&cx=${GOOGLE_CX}&searchType=image&num=5&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    const items = data.items || [];
    for (const item of items) {
      const link = item.link || "";
      const ext = link.split("?")[0].split(".").pop()?.toLowerCase();
      if (!["jpg", "jpeg", "png", "webp"].includes(ext)) continue;
      if ((item.image?.width || 0) < 200) continue;
      return link;
    }
    return items[0]?.link || null;
  } catch {
    return null;
  }
}

// DuckDuckGo image search — no API key, returns real search results
async function ddgImageSearch(query) {
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
  try {
    // Step 1: get vqd token
    const pageRes = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
      { headers: { "User-Agent": UA } }
    );
    const html = await pageRes.text();
    const tokenMatch = html.match(/vqd=['"]?([\d-]+)['"]?/);
    if (!tokenMatch) return null;
    const vqd = tokenMatch[1];

    // Step 2: fetch image results
    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,,,&p=1`,
      { headers: { "User-Agent": UA, Referer: "https://duckduckgo.com/" } }
    );
    if (!imgRes.ok) return null;
    const data = await imgRes.json();
    const results = data.results || [];
    for (const r of results) {
      const url = r.image || "";
      const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
      if (!["jpg", "jpeg", "png", "webp"].includes(ext)) continue;
      if ((r.width || 0) < 200) continue;
      return url;
    }
    return results[0]?.image || null;
  } catch {
    return null;
  }
}

async function findImages(courseName, city, state) {
  // Try Google CSE first
  const [gCover, gLogo] = await Promise.all([
    googleImageSearch(`${courseName} ${city} golf course aerial landscape`),
    googleImageSearch(`${courseName} ${city} golf club logo crest emblem`),
  ]);
  if (gCover || gLogo) return { cover: gCover, logo: gLogo };

  // Fallback: DuckDuckGo image search (no API key needed)
  console.log(`  (Google CSE unavailable — trying DuckDuckGo)`);
  const [ddgCover, ddgLogo] = await Promise.all([
    ddgImageSearch(`${courseName} ${city} golf course aerial landscape`),
    ddgImageSearch(`${courseName} ${city} golf club logo crest emblem`),
  ]);
  return { cover: ddgCover, logo: ddgLogo };
}

// ── Step 3: Haiku description ─────────────────────────────────────────────────

async function generateDescription(name, city, state, par, yardage, slope) {
  const facts = [
    par ? `par ${par}` : null,
    yardage ? `${yardage.toLocaleString()} yards` : null,
    slope ? `slope rating ${slope}` : null,
    `located in ${city}, ${state}`,
  ]
    .filter(Boolean)
    .join(", ");

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Write a 2-sentence description for ${name}, a golf course ${facts}.
Voice: confident, specific, slightly editorial — like an enthusiastic golfer, not a PR firm.
Avoid: "world-class", "stunning views", "something for everyone".
Just the description, no preamble.`,
      },
    ],
  });

  return msg.content.find((b) => b.type === "text")?.text?.trim() || null;
}

// ── Step 4: Image upload ──────────────────────────────────────────────────────

async function uploadImage(externalUrl, storagePath) {
  if (!externalUrl) return null;
  try {
    const res = await fetch(externalUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) return null;
    const ext = externalUrl.split("?")[0].split(".").pop()?.toLowerCase();
    const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const buffer = await res.arrayBuffer();
    const { error } = await supabase.storage
      .from("tour-it-photos")
      .upload(storagePath, buffer, { contentType, upsert: true });
    if (error) return null;
    return supabase.storage.from("tour-it-photos").getPublicUrl(storagePath).data.publicUrl;
  } catch {
    return null;
  }
}

// ── Step 5: DB upsert ─────────────────────────────────────────────────────────

async function findExistingCourse(name, city, state) {
  const { rows } = await db.query(
    `SELECT id, name, city, state, description, "coverImageUrl", "logoUrl", "yearEstablished"
     FROM "Course"
     WHERE state = $1
       AND city ILIKE $2
       AND (name ILIKE $3 OR name ILIKE $4)
     LIMIT 1`,
    [state, city, `%${name}%`, name]
  );
  return rows[0] || null;
}

async function upsertCourse(existing, data) {
  const now = new Date().toISOString();

  if (existing) {
    const update = {};
    if (!existing.description && data.description) update.description = data.description;
    if (!existing.coverImageUrl && data.coverImageUrl) update.coverImageUrl = data.coverImageUrl;
    if (!existing.logoUrl && data.logoUrl) update.logoUrl = data.logoUrl;
    if (!existing.yearEstablished && data.yearEstablished) update.yearEstablished = data.yearEstablished;
    if (data.courseType) update.courseType = data.courseType;
    if (data.zipCode) update.zipCode = data.zipCode;
    update.updatedAt = now;

    await db.query(
      `UPDATE "Course" SET ${Object.keys(update).map((k, i) => `"${k}" = $${i + 1}`).join(", ")} WHERE id = $${Object.keys(update).length + 1}`,
      [...Object.values(update), existing.id]
    );
    return { id: existing.id, isNew: false };
  }

  // Insert new
  const id = randomUUID();
  const slug = slugify(data.name, data.city);
  await db.query(
    `INSERT INTO "Course" (id, name, slug, city, state, country, "zipCode", description, "coverImageUrl", "logoUrl",
      "yearEstablished", "courseType", "isPublic", "isVerified", "holeCount",
      "uploadCount", "saveCount", "viewCount", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     ON CONFLICT (slug) DO NOTHING`,
    [
      id, data.name, slug, data.city, data.state, "US", data.zipCode || null,
      data.description || null, data.coverImageUrl || null, data.logoUrl || null,
      data.yearEstablished || null, data.courseType || null,
      data.courseType !== "PRIVATE", false, data.holes || 18,
      0, 0, 0, now, now,
    ]
  );
  return { id, isNew: true };
}

async function seedHoles(courseId) {
  const { rows } = await db.query(`SELECT COUNT(*) FROM "Hole" WHERE "courseId" = $1`, [courseId]);
  if (parseInt(rows[0].count) > 0) return;
  const now = new Date().toISOString();
  const values = Array.from({ length: 18 }, (_, i) =>
    `('${randomUUID()}', '${courseId}', ${i + 1}, 4, 0, '${now}', '${now}')`
  ).join(",");
  await db.query(
    `INSERT INTO "Hole" (id, "courseId", "holeNumber", par, "uploadCount", "createdAt", "updatedAt") VALUES ${values}`
  );
}

// ── Process one course name ───────────────────────────────────────────────────

function simplifySearchQuery(name) {
  // Strip generic suffixes so "Plantation Preserve Golf Course" → "Plantation Preserve"
  return name
    .replace(/\b(golf course|golf club|country club|golf & country club|golf and country club|golf resort|resort|course|club)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function processCourse(courseName) {
  console.log(`\n→ ${courseName}`);

  // 1. Golf Course API search — try full name first, then simplified
  let results = await searchGolfCourseAPI(courseName);
  if (!results.length) {
    const simplified = simplifySearchQuery(courseName);
    if (simplified !== courseName) results = await searchGolfCourseAPI(simplified);
  }
  if (!results.length) {
    console.log(`  ✗ Not found in Golf Course API`);
    return null;
  }

  const match = results[0];
  const { city, state, address } = match.location || {};
  const zipMatch = address?.match(/\b\d{5}\b/);
  const zipCode = zipMatch ? zipMatch[0] : null;
  const stats = extractCourseStats(match);
  const name = match.club_name || match.course_name;

  console.log(`  Found: ${name} — ${city}, ${state} | par ${stats.par} | ${stats.yardage}y`);

  // 2. Image search (Google CSE with TeeTimesUSA fallback)
  const { cover: rawCoverUrl, logo: rawLogoUrl } = await findImages(name, city, state);

  // 3. Haiku description
  let description = null;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      description = await generateDescription(name, city, state, stats.par, stats.yardage, stats.slope);
    } catch {
      description = null;
    }
  }

  // 4. Upload images
  const safeSlug = slugify(name).slice(0, 40);
  const [coverImageUrl, logoUrl] = await Promise.all([
    uploadImage(rawCoverUrl, `course-images/${safeSlug}-cover.jpg`),
    uploadImage(rawLogoUrl, `course-images/${safeSlug}-logo.png`),
  ]);

  console.log(`  Cover: ${coverImageUrl ? "✅" : "✗"} | Logo: ${logoUrl ? "✅" : "✗"} | Desc: ${description ? "✅" : "✗"}`);

  // 5. DB upsert
  const existing = await findExistingCourse(name, city, state);
  const { id, isNew } = await upsertCourse(existing, {
    name, city, state, zipCode, description, coverImageUrl, logoUrl,
    holes: stats.holes,
  });

  if (isNew) {
    await seedHoles(id);
    console.log(`  ✅ Inserted (id: ${id})`);
  } else {
    console.log(`  ✅ Updated existing (id: ${id})`);
  }

  return id;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  if (!args.list.length && !args.zips.length) {
    console.log("Usage:");
    console.log('  node src/scripts/seed-courses-v2.mjs --list "Course Name 1,Course Name 2"');
    console.log("  node src/scripts/seed-courses-v2.mjs --zip 33317");
    console.log("  node src/scripts/seed-courses-v2.mjs --zip 33317,33069");
    process.exit(0);
  }

  await db.connect();

  let courseNames = [...args.list];

  // Zip mode: find unseeded courses in DB for that zip
  for (const zip of args.zips) {
    const { rows } = await db.query(
      `SELECT name FROM "Course" WHERE "zipCode" = $1
       AND (description IS NULL OR "coverImageUrl" IS NULL OR "logoUrl" IS NULL)
       ORDER BY name`,
      [zip]
    );
    console.log(`Zip ${zip}: ${rows.length} courses need seeding`);
    courseNames.push(...rows.map((r) => r.name));
  }

  if (!courseNames.length) {
    console.log("All courses already seeded.");
    await db.end();
    return;
  }

  console.log(`\nSeeding ${courseNames.length} course(s)...\n`);
  let success = 0, failed = 0;

  for (const name of courseNames) {
    try {
      const id = await processCourse(name);
      if (id) success++;
      else failed++;
    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
      failed++;
    }
    await sleep(600); // ~100 req/min, well within free tier
  }

  await db.end();
  console.log(`\nDone. ✅ ${success} seeded, ✗ ${failed} failed.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
