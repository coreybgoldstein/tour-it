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
import fs from "fs";

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
const RESEND_KEY = process.env.RESEND_API_KEY;
const REPORT_EMAIL = "corey@touritgolf.com";

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
  const result = { zips: [], list: [], popular: false, city: null, state: null, limit: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--zip" && args[i + 1])
      result.zips = args[i + 1].split(",").map((z) => z.trim());
    if (args[i] === "--list" && args[i + 1])
      result.list = args[i + 1].split(",").map((n) => n.trim());
    if (args[i] === "--popular") result.popular = true;
    if (args[i] === "--city" && args[i + 1]) result.city = args[i + 1];
    if (args[i] === "--state" && args[i + 1]) result.state = args[i + 1].toUpperCase();
    if (args[i] === "--limit" && args[i + 1]) result.limit = parseInt(args[i + 1]);
  }
  return result;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Email reporting ───────────────────────────────────────────────────────────

async function sendReport({ seeded, failed, missingCover, missingLogo, missingDesc, remaining, lowCredits, rows }) {
  if (!RESEND_KEY) return;

  const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const statusIcon = (ok) => ok ? "✅" : "❌";

  const rowsHtml = rows.map(r =>
    `<tr style="border-bottom:1px solid #333">
      <td style="padding:6px 12px;color:#fff">${r.name}</td>
      <td style="padding:6px 12px;color:#aaa">${r.city}, ${r.state}</td>
      <td style="padding:6px 12px;text-align:center">${r.cover ? "✅" : "❌"}</td>
      <td style="padding:6px 12px;text-align:center">${r.logo ? "✅" : "❌"}</td>
      <td style="padding:6px 12px;text-align:center">${r.desc ? "✅" : "❌"}</td>
    </tr>`
  ).join("");

  const creditWarning = lowCredits ? `
    <div style="background:#7c2d12;border:1px solid #ef4444;border-radius:8px;padding:16px;margin-bottom:24px">
      <strong style="color:#ef4444">⚠️ Anthropic API Credits Low</strong>
      <p style="color:#fca5a5;margin:8px 0 0">Course descriptions stopped generating. Add credits at
        <a href="https://console.anthropic.com/settings/billing" style="color:#f87171">console.anthropic.com/settings/billing</a>
      </p>
    </div>` : "";

  const html = `
<div style="font-family:system-ui,sans-serif;background:#07100a;color:#fff;padding:32px;max-width:700px;margin:0 auto">
  <h1 style="font-size:22px;margin:0 0 4px;color:#4da862">Tour It — Course Seeding Report</h1>
  <p style="color:#aaa;margin:0 0 24px">${date}</p>

  ${creditWarning}

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:16px;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#4da862">${seeded}</div>
      <div style="color:#aaa;font-size:13px">Seeded today</div>
    </div>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:16px;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#fff">${remaining}</div>
      <div style="color:#aaa;font-size:13px">Remaining</div>
    </div>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:16px;text-align:center">
      <div style="font-size:28px;font-weight:700;color:${failed > 0 ? "#ef4444" : "#4da862"}">${failed}</div>
      <div style="color:#aaa;font-size:13px">Failed</div>
    </div>
  </div>

  ${missingCover || missingLogo || missingDesc ? `
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:16px;margin-bottom:24px">
    <p style="margin:0 0 8px;font-weight:600">Missing data after seeding:</p>
    ${missingCover ? `<p style="margin:4px 0;color:#fbbf24">⚠️ ${missingCover} courses missing cover photo</p>` : ""}
    ${missingLogo ? `<p style="margin:4px 0;color:#fbbf24">⚠️ ${missingLogo} courses missing logo</p>` : ""}
    ${missingDesc ? `<p style="margin:4px 0;color:#fbbf24">⚠️ ${missingDesc} courses missing description</p>` : ""}
  </div>` : ""}

  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead>
      <tr style="border-bottom:1px solid #4da862">
        <th style="padding:8px 12px;text-align:left;color:#4da862">Course</th>
        <th style="padding:8px 12px;text-align:left;color:#4da862">Location</th>
        <th style="padding:8px 12px;text-align:center;color:#4da862">Cover</th>
        <th style="padding:8px 12px;text-align:center;color:#4da862">Logo</th>
        <th style="padding:8px 12px;text-align:center;color:#4da862">Desc</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Tour It Seeder <onboarding@resend.dev>",
        to: REPORT_EMAIL,
        subject: `Course Seeding Report — ${seeded} seeded, ${remaining} remaining`,
        html,
      }),
    });
    if (res.ok) console.log(`\n📧 Report sent to ${REPORT_EMAIL}`);
    else console.log(`\n⚠️ Email failed: ${await res.text()}`);
  } catch (err) {
    console.log(`\n⚠️ Email error: ${err.message}`);
  }
}

async function checkAnthropicCredits() {
  try {
    await anthropic.messages.create({
      model: "claude-haiku-4-5", max_tokens: 1,
      messages: [{ role: "user", content: "." }],
    });
    return true;
  } catch (err) {
    return !err.message?.includes("credit balance is too low");
  }
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
  const maleTees = course.tees?.male || [];
  const backTee = maleTees.find((t) => /back|blue|championship/i.test(t.tee_name)) || maleTees[0];
  return {
    par: backTee?.par_total || null,
    yardage: backTee?.total_yards || null,
    slope: backTee?.slope_rating || null,
    rating: backTee?.course_rating || null,
    holes: backTee?.number_of_holes || 18,
    teeCount: maleTees.length || null,
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

async function generateDescription(name, city, state, par, yardage, slope, rating, teeCount) {
  // Only build facts we actually have from the Golf Course API — never invent details
  const facts = [
    par ? `par ${par}` : null,
    yardage ? `${yardage.toLocaleString()} yards from the back tees` : null,
    slope ? `slope rating ${slope}` : null,
    rating ? `course rating ${rating}` : null,
    teeCount > 1 ? `${teeCount} sets of tees` : null,
    `in ${city}, ${state}`,
  ].filter(Boolean);

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: `Write a 2-sentence description for ${name} golf course using ONLY these verified facts: ${facts.join(", ")}.

STRICT RULES:
- Use ONLY the facts listed above. Do not add course history, designer names, year opened, signature holes, or any detail not provided.
- If a fact is not listed, do not mention it.
- Write in plain, informative language — like a scorecard description, not a brochure.
- Just the description, no preamble.`,
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
      description = await generateDescription(name, city, state, stats.par, stats.yardage, stats.slope, stats.rating, stats.teeCount);
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

// ── Resume tracking ───────────────────────────────────────────────────────────

const RESUME_FILE = path.resolve(__dirname, "../../popular-seed-progress.json");

function loadProgress() {
  if (!fs.existsSync(RESUME_FILE)) return { done: [] };
  try { return JSON.parse(fs.readFileSync(RESUME_FILE, "utf-8")); }
  catch { return { done: [] }; }
}

function saveProgress(done) {
  fs.writeFileSync(RESUME_FILE, JSON.stringify({ done }, null, 2));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  if (!args.list.length && !args.zips.length && !args.popular && !args.city && !args.state) {
    console.log("Usage:");
    console.log('  node src/scripts/seed-courses-v2.mjs --list "Course Name 1,Course Name 2"');
    console.log("  node src/scripts/seed-courses-v2.mjs --zip 33317,33069");
    console.log("  node src/scripts/seed-courses-v2.mjs --city Miami --state FL");
    console.log("  node src/scripts/seed-courses-v2.mjs --state FL");
    console.log("  node src/scripts/seed-courses-v2.mjs --popular           # top 1000 list, 300/day");
    console.log("  node src/scripts/seed-courses-v2.mjs --popular --limit 50");
    process.exit(0);
  }

  await db.connect();

  // Build course queue
  let queue = []; // [{id, name, city, state}] for popular/city/state modes, or just names for list/zip

  if (args.popular) {
    const listPath = path.resolve(__dirname, "../../src/data/popular-courses-us.json");
    if (!fs.existsSync(listPath)) {
      console.log("Popular list not found. Run: node src/scripts/generate-popular-list.mjs");
      await db.end(); return;
    }
    const allCourses = JSON.parse(fs.readFileSync(listPath, "utf-8"));
    const { done } = loadProgress();
    const doneSet = new Set(done);
    queue = allCourses.filter(c => !doneSet.has(c.id));
    const limit = args.limit || 300;
    queue = queue.slice(0, limit);
    console.log(`Popular mode: ${queue.length} courses to seed today (${done.length} already done)`);
  }

  if (args.city || args.state) {
    let sql = `SELECT id, name, city, state FROM "Course"
               WHERE (description IS NULL OR "coverImageUrl" IS NULL OR "logoUrl" IS NULL)`;
    const params = [];
    if (args.state) { sql += ` AND state = $${params.length + 1}`; params.push(args.state); }
    if (args.city) { sql += ` AND city ILIKE $${params.length + 1}`; params.push(`%${args.city}%`); }
    sql += ` ORDER BY name`;
    const { rows } = await db.query(sql, params);
    queue.push(...rows);
    console.log(`${args.city || ""}${args.state ? ` ${args.state}` : ""}: ${rows.length} courses need seeding`);
  }

  for (const zip of args.zips) {
    const { rows } = await db.query(
      `SELECT id, name, city, state FROM "Course" WHERE "zipCode" = $1
       AND (description IS NULL OR "coverImageUrl" IS NULL OR "logoUrl" IS NULL)
       ORDER BY name`,
      [zip]
    );
    console.log(`Zip ${zip}: ${rows.length} courses need seeding`);
    queue.push(...rows);
  }

  // Plain --list names go through the old name-search path
  const namedList = [...args.list];

  if (!queue.length && !namedList.length) {
    console.log("All courses already seeded.");
    await db.end(); return;
  }

  const total = queue.length + namedList.length;
  console.log(`\nSeeding ${total} course(s)...\n`);
  let success = 0, failed = 0;
  const newDone = [];
  const reportRows = [];

  // Process queue items (have DB id already)
  for (const course of queue) {
    try {
      const result = await processCourseById(course);
      if (result) {
        success++;
        newDone.push(course.id);
        reportRows.push({ name: course.name, city: course.city, state: course.state, ...result });
      } else failed++;
    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
      failed++;
    }
    await sleep(2000);
  }

  // Process plain name list
  for (const name of namedList) {
    try {
      const result = await processCourse(name);
      if (result) success++;
      else failed++;
    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
      failed++;
    }
    await sleep(2000);
  }

  // Save resume progress for --popular mode
  let remaining = 0;
  if (args.popular && newDone.length) {
    const { done } = loadProgress();
    const allDone = [...done, ...newDone];
    saveProgress(allDone);
    const listPath = path.resolve(__dirname, "../../src/data/popular-courses-us.json");
    const allCourses = JSON.parse(fs.readFileSync(listPath, "utf-8"));
    remaining = allCourses.length - allDone.length;
    console.log(`\nProgress saved. ${allDone.length} courses done total, ${remaining} remaining.`);
  }

  await db.end();
  console.log(`\nDone. ✅ ${success} seeded, ✗ ${failed} failed.`);

  // Send email report
  if (args.popular || args.state || args.city) {
    const lowCredits = !(await checkAnthropicCredits());
    await sendReport({
      seeded: success,
      failed,
      missingCover: reportRows.filter(r => !r.cover).length,
      missingLogo: reportRows.filter(r => !r.logo).length,
      missingDesc: reportRows.filter(r => !r.desc).length,
      remaining,
      lowCredits,
      rows: reportRows,
    });
  }
}

// ── Process a course we already have a DB record for ─────────────────────────

async function processCourseById(course) {
  console.log(`\n→ ${course.name} (${course.city}, ${course.state})`);

  // Check if already fully seeded
  const { rows } = await db.query(
    `SELECT description, "coverImageUrl", "logoUrl" FROM "Course" WHERE id = $1`,
    [course.id]
  );
  const existing = rows[0];
  if (existing?.description && existing?.coverImageUrl && existing?.logoUrl) {
    console.log(`  Already seeded — skipping`);
    return { cover: true, logo: true, desc: true };
  }

  // Try Golf Course API for stats (optional — skip if rate limited)
  let stats = { par: null, yardage: null, slope: null, holes: 18 };
  try {
    let results = await searchGolfCourseAPI(course.name);
    if (!results.length) results = await searchGolfCourseAPI(simplifySearchQuery(course.name));
    if (results.length) stats = extractCourseStats(results[0]);
  } catch { /* rate limited or network error — continue without stats */ }

  // Image search
  const { cover: rawCoverUrl, logo: rawLogoUrl } = await findImages(course.name, course.city, course.state);

  // Description
  let description = existing?.description || null;
  if (!description && process.env.ANTHROPIC_API_KEY) {
    try {
      description = await generateDescription(course.name, course.city, course.state, stats.par, stats.yardage, stats.slope, stats.rating, stats.teeCount);
    } catch { description = null; }
  }

  // Upload images
  const safeSlug = slugify(course.name).slice(0, 40);
  const [coverImageUrl, logoUrl] = await Promise.all([
    existing?.coverImageUrl ? Promise.resolve(null) : uploadImage(rawCoverUrl, `course-images/${safeSlug}-cover.jpg`),
    existing?.logoUrl ? Promise.resolve(null) : uploadImage(rawLogoUrl, `course-images/${safeSlug}-logo.png`),
  ]);

  console.log(`  Cover: ${(coverImageUrl || existing?.coverImageUrl) ? "✅" : "✗"} | Logo: ${(logoUrl || existing?.logoUrl) ? "✅" : "✗"} | Desc: ${description ? "✅" : "✗"}`);

  // Update DB
  const update = { updatedAt: new Date().toISOString() };
  if (description && !existing?.description) update.description = description;
  if (coverImageUrl && !existing?.coverImageUrl) update.coverImageUrl = coverImageUrl;
  if (logoUrl && !existing?.logoUrl) update.logoUrl = logoUrl;

  if (Object.keys(update).length > 1) {
    await db.query(
      `UPDATE "Course" SET ${Object.keys(update).map((k, i) => `"${k}" = $${i + 1}`).join(", ")} WHERE id = $${Object.keys(update).length + 1}`,
      [...Object.values(update), course.id]
    );
  }

  console.log(`  ✅ Updated (id: ${course.id})`);
  return {
    cover: !!(coverImageUrl || existing?.coverImageUrl),
    logo: !!(logoUrl || existing?.logoUrl),
    desc: !!description,
  };
}

main().catch((err) => { console.error(err); process.exit(1); });
