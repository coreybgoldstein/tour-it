#!/usr/bin/env node

/**
 * Tour It — Bulk Course Seeder
 * 
 * Uses the Anthropic API + the course seeder skill to research and seed
 * golf courses in bulk, directly into Supabase.
 * 
 * Usage:
 *   node scripts/seed-courses-bulk.mjs --zip 33431
 *   node scripts/seed-courses-bulk.mjs --zip 33431,33432,33434
 *   node scripts/seed-courses-bulk.mjs --state FL --limit 50
 *   node scripts/seed-courses-bulk.mjs --list "Pebble Beach,Augusta National,Bethpage Black"
 * 
 * Required env vars (already in your .env):
 *   ANTHROPIC_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   INTERNAL_API_SECRET
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import dotenv from "dotenv";

dotenv.config();

// ─── Config ───────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// How many courses to process in parallel (keep low to avoid API rate limits)
const CONCURRENCY = 3;

// Delay between batches in ms
const BATCH_DELAY = 2000;

// ─── Seeder Skill Prompt ───────────────────────────────────────────────────────

const SEEDER_SYSTEM_PROMPT = `You are a content researcher and copywriter for Tour It, a golf scouting platform. 
Your job is to research real golf courses on the open web and return structured, accurate data.

You will be given a course name (or names) to research. For each course:

1. Search for core facts: official name, city, state, zip code, year opened, access type, official website.
   Always verify zip from the official website or PGA.com — third-party aggregators frequently list wrong zips.

2. Find the logo: Target the club's official crest, emblem, or medallion — NOT the wordmark.
   Search aggressively across ALL sources: official website HTML, Facebook/Instagram profile images,
   GolfNow, GolfPass, TeeOff, Golf Digest, Yelp, real estate blogs, trade publications, sponsor pages.
   - Logo must NOT be transparent (Tour It background is dark green #07100a — transparent logos are invisible)
   - URL must be a direct image file ending in .jpg, .png, .webp, or .svg
   - Do NOT use .aspx or getImage.gif?ID= URLs — they are unstable CMS URLs
   - Known blockers (return null immediately): Clubessential CMS (getImage.gif), ClubHouseOnline (login required)
   - If only a wordmark exists, use it as fallback and note it

3. Find a cover photo: Wide landscape or aerial shot showing the course — water, bunkers, fairways.
   Search everywhere: official site, Palm Beach County golf sites, real estate blogs, Golf Digest,
   GolfPass, Koolik Group, Club+Resort Business, TripAdvisor, Yelp.
   - Must be a direct static image URL (same rules as logo)
   - Avoid: clubhouse-only, people posing, watermarked stock images

4. Write a 2-3 sentence description:
   - Open with what makes the course distinct (design pedigree, setting, signature holes, reputation)
   - Include one specific fact (designer, year, notable hole, slope rating, historical detail)
   - End with the feel/experience
   - Voice: confident, specific, slightly editorial — like an enthusiastic golfer, not a PR firm
   - Avoid: "world-class", "stunning views", "something for everyone"

5. Skip courses that are currently closed for renovation.

Return ONLY a valid JSON array. No preamble, no explanation, no markdown fences. Just the raw JSON.

Each object must have exactly these fields:
{
  "courseName": "Official name",
  "city": "City",
  "state": "FL",
  "zipCode": "33433",
  "yearEstablished": 1983,
  "access": "Public" | "Semi-Private" | "Private",
  "description": "2-3 sentence description",
  "coverPhotoUrl": "https://..." or null,
  "logoUrl": "https://..." or null,
  "sourceNotes": "One line: where each asset came from, logo background confirmed solid or flagged"
}

Access definitions:
- Public: anyone can book, no membership required
- Semi-Private: members get priority but public tee times available
- Private: members and invited guests only

If a field cannot be confirmed with confidence, set it to null. Never guess or fabricate.`;

// ─── Clients ──────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { zips: [], state: null, limit: null, list: [] };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--zip" && args[i + 1]) {
      result.zips = args[i + 1].split(",").map((z) => z.trim());
    }
    if (args[i] === "--state" && args[i + 1]) {
      result.state = args[i + 1].trim();
    }
    if (args[i] === "--limit" && args[i + 1]) {
      result.limit = parseInt(args[i + 1]);
    }
    if (args[i] === "--list" && args[i + 1]) {
      result.list = args[i + 1].split(",").map((n) => n.trim());
    }
  }

  return result;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── DB Check — What's already seeded? ───────────────────────────────────────

async function getExistingCourses(zip) {
  const url = `${APP_URL}/api/internal/courses?zipCode=${zip}&secret=${INTERNAL_SECRET}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const courses = await res.json();
    return courses;
  } catch (err) {
    console.error(`  ⚠ Could not fetch existing courses for zip ${zip}: ${err.message}`);
    return [];
  }
}

function isWellSeeded(course) {
  const fields = [
    course.description,
    course.coverImageUrl,
    course.logoUrl,
    course.yearEstablished,
    course.access ?? course.courseType,
  ];
  const filled = fields.filter((f) => f !== null && f !== undefined).length;
  return filled / fields.length >= 0.8;
}

// ─── Research — Call Claude to research courses ────────────────────────────────

async function researchCourses(courseNames) {
  const userMessage =
    courseNames.length === 1
      ? `Research this golf course and return the JSON: ${courseNames[0]}`
      : `Research these golf courses and return a JSON array with one object per course:\n${courseNames.join("\n")}`;

  console.log(`  🔍 Researching: ${courseNames.join(", ")}`);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4000,
    system: SEEDER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Strip any accidental markdown fences
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    // Normalize to always be an array
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    console.error(`  ✗ Failed to parse Claude response: ${err.message}`);
    console.error(`  Raw response: ${cleaned.slice(0, 300)}...`);
    return [];
  }
}

// ─── Upsert — Write to Supabase ───────────────────────────────────────────────

async function upsertCourse(courseData) {
  const now = new Date().toISOString();
  const slug = slugify(courseData.courseName);

  // Map seeder output to DB schema
  // NOTE: If your schema doesn't have yearEstablished or access columns yet,
  // run this migration in Supabase SQL editor first:
  //   ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "yearEstablished" integer;
  //   ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "access" text;
  const record = {
    id: randomUUID(),
    name: courseData.courseName,
    slug,
    city: courseData.city || "",
    state: courseData.state || "",
    country: "US",
    zipCode: courseData.zipCode || null,
    description: courseData.description || null,
    coverImageUrl: courseData.coverPhotoUrl || null,
    logoUrl: courseData.logoUrl || null,
    yearEstablished: courseData.yearEstablished || null,
    courseType: courseData.access || null,
    isPublic: courseData.access === "Public" || courseData.access === "Semi-Private",
    isVerified: false,
    holeCount: 18,
    uploadCount: 0,
    saveCount: 0,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  // Upsert on slug — safe to re-run
  const { data, error } = await supabase
    .from("Course")
    .upsert(record, { onConflict: "slug", ignoreDuplicates: false })
    .select("id, name")
    .single();

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  return data;
}

async function seedHoles(courseId) {
  const now = new Date().toISOString();
  const holes = Array.from({ length: 18 }, (_, i) => ({
    id: randomUUID(),
    courseId,
    holeNumber: i + 1,
    par: 4,
    uploadCount: 0,
    createdAt: now,
    updatedAt: now,
  }));

  // Only insert holes if none exist yet
  const { count } = await supabase
    .from("Hole")
    .select("id", { count: "exact", head: true })
    .eq("courseId", courseId);

  if (count > 0) {
    return; // Already has holes
  }

  const { error } = await supabase.from("Hole").insert(holes);
  if (error) {
    throw new Error(`Hole insert failed: ${error.message}`);
  }
}

// ─── Process a batch of course names ─────────────────────────────────────────

async function processBatch(courseNames) {
  const results = { success: [], failed: [], skipped: [] };

  const researched = await researchCourses(courseNames);

  for (const courseData of researched) {
    if (!courseData.courseName) {
      results.failed.push({ name: "unknown", reason: "No courseName in response" });
      continue;
    }

    try {
      const course = await upsertCourse(courseData);
      await seedHoles(course.id);

      const fields = [courseData.description, courseData.coverPhotoUrl, courseData.logoUrl, courseData.yearEstablished, courseData.access];
      const nullFields = ["description", "coverPhotoUrl", "logoUrl", "yearEstablished", "access"].filter(
        (_, i) => !fields[i]
      );

      results.success.push({
        name: course.name,
        id: course.id,
        nullFields,
        sourceNotes: courseData.sourceNotes,
      });

      const status = nullFields.length === 0 ? "✅ Full" : `⚠️  Partial (missing: ${nullFields.join(", ")})`;
      console.log(`  ${status} — ${course.name}`);
      if (courseData.sourceNotes) {
        console.log(`     Notes: ${courseData.sourceNotes}`);
      }
    } catch (err) {
      console.error(`  ✗ Failed to upsert ${courseData.courseName}: ${err.message}`);
      results.failed.push({ name: courseData.courseName, reason: err.message });
    }
  }

  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🏌️  Tour It — Bulk Course Seeder");
  console.log("=====================================\n");

  const args = parseArgs();
  let courseNames = [];

  // Mode 1: Named list
  if (args.list.length > 0) {
    courseNames = args.list;
    console.log(`Mode: Named list (${courseNames.length} courses)\n`);
  }

  // Mode 2: By zip code(s) — checks DB first, skips well-seeded
  else if (args.zips.length > 0) {
    console.log(`Mode: Zip code(s) — ${args.zips.join(", ")}\n`);

    for (const zip of args.zips) {
      console.log(`Checking DB for zip ${zip}...`);
      const existing = await getExistingCourses(zip);

      if (existing.length === 0) {
        console.log(`  No courses found in DB for ${zip} — will discover and seed from scratch`);
        // For unknown zips, we ask Claude to discover what courses exist there
        courseNames.push(`All golf courses in zip code ${zip}`);
      } else {
        const needsSeeding = existing.filter((c) => !isWellSeeded(c));
        const alreadyDone = existing.filter((c) => isWellSeeded(c));

        console.log(
          `  Found ${existing.length} courses — ${alreadyDone.length} already seeded, ${needsSeeding.length} need work`
        );
        alreadyDone.forEach((c) => console.log(`  ⏭  Skipping (≥80% complete): ${c.name}`));

        courseNames.push(...needsSeeding.map((c) => c.name));
      }
    }
  }

  // Mode 3: By state (bulk discovery)
  else if (args.state) {
    const limit = args.limit || 20;
    console.log(`Mode: State — ${args.state}, limit ${limit} courses\n`);
    // Ask Claude to discover and seed top courses in the state
    courseNames.push(`Top ${limit} golf courses in ${args.state} that are popular or well-known`);
  }

  else {
    console.log("Usage:");
    console.log("  node scripts/seed-courses-bulk.mjs --zip 33431");
    console.log("  node scripts/seed-courses-bulk.mjs --zip 33431,33432,33434");
    console.log("  node scripts/seed-courses-bulk.mjs --state FL --limit 50");
    console.log('  node scripts/seed-courses-bulk.mjs --list "Pebble Beach,Augusta National"');
    process.exit(0);
  }

  if (courseNames.length === 0) {
    console.log("\n✅ All courses in the requested zips are already well-seeded. Nothing to do.");
    process.exit(0);
  }

  console.log(`\nResearching ${courseNames.length} course(s)...\n`);

  // Chunk into batches of CONCURRENCY
  const batches = [];
  for (let i = 0; i < courseNames.length; i += CONCURRENCY) {
    batches.push(courseNames.slice(i, i + CONCURRENCY));
  }

  const allResults = { success: [], failed: [], skipped: [] };

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`\nBatch ${i + 1}/${batches.length}:`);

    const batchResults = await processBatch(batch);
    allResults.success.push(...batchResults.success);
    allResults.failed.push(...batchResults.failed);
    allResults.skipped.push(...batchResults.skipped);

    if (i < batches.length - 1) {
      console.log(`  Waiting ${BATCH_DELAY / 1000}s before next batch...`);
      await sleep(BATCH_DELAY);
    }
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log("\n=====================================");
  console.log("Summary");
  console.log("=====================================");
  console.log(`✅ Seeded:  ${allResults.success.length}`);
  console.log(`✗  Failed:  ${allResults.failed.length}`);
  console.log(`⏭  Skipped: ${allResults.skipped.length}`);

  const fullData = allResults.success.filter((c) => c.nullFields.length === 0);
  const partial = allResults.success.filter((c) => c.nullFields.length > 0);

  console.log(`\n   Full data: ${fullData.length}`);
  if (partial.length > 0) {
    console.log(`   Partial (needs manual upload):`);
    partial.forEach((c) => console.log(`     - ${c.name}: missing ${c.nullFields.join(", ")}`));
  }

  if (allResults.failed.length > 0) {
    console.log(`\n   Failed courses:`);
    allResults.failed.forEach((c) => console.log(`     - ${c.name}: ${c.reason}`));
  }

  console.log("\nDone. Check Supabase → Table Editor → Course to verify.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
