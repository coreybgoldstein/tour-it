#!/usr/bin/env node

/**
 * Tour It — Bulk Course Seeder v2
 *
 * IMPORTANT: This script UPDATES existing courses only. Never inserts new ones.
 * The DB already has 11,000+ courses from an external data source.
 *
 * Usage:
 *   node src/scripts/seed-courses-bulk.mjs --db-state NY,NC,FL --limit 300
 *   node src/scripts/seed-courses-bulk.mjs --db-state FL --limit 100
 *   node src/scripts/seed-courses-bulk.mjs --list "Bethpage Black,Pinehurst No. 2"
 *
 * Required env vars (already in your .env):
 *   ANTHROPIC_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import dotenv from "dotenv";

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// How many courses to research per Claude call
const CONCURRENCY = 3;
// Delay between batches in ms
const BATCH_DELAY = 2000;

// ─── System Prompt ────────────────────────────────────────────────────────────

const SEEDER_SYSTEM_PROMPT = `You are a content researcher and copywriter for Tour It, a golf scouting platform.
Your job is to research real golf courses and return structured, accurate data.

You will receive a list of courses with their IDs, names, and locations. For each course:

1. **Core facts**: Official name, city, state, zip code, year opened, access type, phone number, official website URL, number of holes (9, 18, 27, or 36).
   - Verify zip from the official website or PGA.com — third-party aggregators frequently list wrong zips.
   - Phone: format as (xxx) xxx-xxxx or leave null if not found.
   - holeCount: research the actual count — many courses are 9 holes, some are 27 or 36.

2. **GPS coordinates**: latitude and longitude. Look these up from the course's official address on Google Maps, booking platforms, or the official website. Must be accurate.

3. **Logo**: Target the club's official crest or emblem — NOT the wordmark/text logo.
   Search: official website HTML, Facebook/Instagram profile images, GolfNow, GolfPass, TeeOff, Golf Digest, Yelp, real estate blogs, trade publications.
   - Must be a direct static image URL (.jpg, .png, .webp, or .svg)
   - NOT transparent (Tour It background is dark green #07100a — transparent logos are invisible)
   - NO .aspx or getImage.gif?ID= URLs — unstable CMS URLs
   - Known blockers (return null immediately): Clubessential CMS (getImage.gif), ClubHouseOnline
   - If only a wordmark exists, return null — generic county/system logos should be null
   - Good fallback logo sources: ttusa.s3.amazonaws.com/images/gallery/_logos/, logos.bluegolf.com

4. **Cover photo**: Wide landscape or aerial shot showing fairways, water, bunkers — the course itself.
   Search everywhere: official site, Golf Digest, GolfPass, TripAdvisor, Yelp, local news, real estate blogs.
   - Must be a direct static image URL (same rules as logo)
   - Avoid: clubhouse-only shots, people posing, watermarked stock photos

5. **Description**: 2-3 sentences. Voice is editorial — written by an enthusiastic golfer who knows the course, not a marketing department.
   - LEAD with what's genuinely distinctive: design pedigree, terrain, signature challenge, historical moment, unusual routing
   - Include one concrete fact: designer name + year, slope rating, a specific hole's story, a notable tournament played there
   - End with what the experience actually feels like — the challenge, the reward, the texture of the round
   - BAD openers (never use): "Nestled...", "Situated...", "Located...", "Boasting...", "Set against..."
   - BAD phrases (never use): "world-class", "stunning views", "something for everyone", "golfers of all skill levels", "a must-play"
   - GOOD opener examples:
     * "Robert Trent Jones Sr. designed [Course] in 1959 as a showcase for his signature elevated greens..."
     * "[Course]'s par-3 14th — a blind shot over a 40-foot ravine to a green perched above the creek — has wrecked more scorecards than any other hole on Long Island."
     * "The routing winds through a former tobacco plantation, and the 400-year-old oaks lining the 9th fairway make it feel like the course has always been here."
     * "Built on a reclaimed dairy farm in 1988, [Course] plays much longer than its yardage suggests — the relentless elevation changes add a full club to nearly every approach."

Return ONLY a valid JSON array. No preamble, no explanation, no markdown fences. Just the raw JSON.

Each object must have exactly these fields (include courseId exactly as given):
{
  "courseId": "exact-id-from-input",
  "courseName": "Official name",
  "city": "City",
  "state": "NY",
  "zipCode": "11234",
  "yearEstablished": 1983,
  "access": "Public" | "Semi-Private" | "Private",
  "holeCount": 18,
  "phone": "(555) 555-5555" or null,
  "websiteUrl": "https://..." or null,
  "latitude": 40.7128 or null,
  "longitude": -74.0060 or null,
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

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { dbStates: [], limit: 100, list: [] };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--db-state" && args[i + 1]) {
      result.dbStates = args[i + 1].split(",").map((s) => s.trim().toUpperCase());
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

function extFromContentType(contentType, fallback = "jpg") {
  if (!contentType) return fallback;
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return fallback;
}

function extFromUrl(url) {
  const m = url.match(/\.(jpg|jpeg|png|webp|svg)(\?|$)/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : null;
}

// ─── DB Query — fetch unseeded courses ────────────────────────────────────────

async function getUnseededCourses(states, limit) {
  const { data, error } = await supabase
    .from("Course")
    .select("id, name, city, state, zipCode, description, coverImageUrl, logoUrl, yearEstablished, courseType, websiteUrl, phone, holeCount, latitude, longitude")
    .in("state", states)
    .is("description", null)
    .order("name")
    .limit(limit);

  if (error) throw new Error(`DB query failed: ${error.message}`);
  return data || [];
}

// ─── Research — Call Claude ────────────────────────────────────────────────────

async function researchCourses(courses) {
  const courseList = courses
    .map(
      (c, i) =>
        `${i + 1}. courseId: "${c.id}" | name: "${c.name}" | location: ${c.city}, ${c.state}${c.zipCode ? ` ${c.zipCode}` : ""}`
    )
    .join("\n");

  const userMessage = `Research these golf courses and return a JSON array with one object per course:\n\n${courseList}`;

  console.log(`  🔍 Researching: ${courses.map((c) => c.name).join(", ")}`);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: SEEDER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Extract JSON array from response — handles preamble text and markdown fences
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    // Try single object
    const objMatch = raw.match(/\{[\s\S]*\}/);
    if (!objMatch) {
      console.error(`  ✗ No JSON found in Claude response`);
      console.error(`  Raw: ${raw.slice(0, 300)}...`);
      return [];
    }
    try {
      return [JSON.parse(objMatch[0])];
    } catch {
      console.error(`  ✗ Failed to parse single object from Claude response`);
      return [];
    }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    console.error(`  ✗ Failed to parse Claude response: ${err.message}`);
    console.error(`  Raw: ${raw.slice(0, 300)}...`);
    return [];
  }
}

// ─── Image Upload to Supabase Storage ─────────────────────────────────────────

async function uploadImage(imageUrl, courseId, type) {
  if (!imageUrl) return null;

  try {
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: "https://www.google.com/",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.log(`    ⚠ Image fetch ${res.status}: ${imageUrl.slice(0, 80)}`);
      return null;
    }

    const contentType = res.headers.get("content-type") || "";
    const urlExt = extFromUrl(imageUrl);
    const ext = urlExt || extFromContentType(contentType);

    const buffer = await res.arrayBuffer();
    const path = `course-images/${courseId}-${type}.${ext}`;

    const { error } = await supabase.storage
      .from("tour-it-photos")
      .upload(path, new Uint8Array(buffer), {
        contentType: contentType || `image/${ext}`,
        upsert: true,
      });

    if (error) {
      console.log(`    ⚠ Storage upload failed: ${error.message}`);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("tour-it-photos").getPublicUrl(path);

    return publicUrl;
  } catch (err) {
    console.log(`    ⚠ Image error (${err.message}): ${imageUrl.slice(0, 80)}`);
    return null;
  }
}

// ─── Update Course (UPDATE only — never insert) ───────────────────────────────

async function updateCourse(existing, courseData) {
  const updates = {};

  if (!existing.description && courseData.description) {
    updates.description = courseData.description.trim().slice(0, 2000);
  }
  if (!existing.yearEstablished && courseData.yearEstablished) {
    const yr = Number(courseData.yearEstablished);
    if (!isNaN(yr) && yr >= 1800 && yr <= new Date().getFullYear()) {
      updates.yearEstablished = yr;
    }
  }
  if (!existing.courseType && courseData.access) {
    const typeMap = { Public: "PUBLIC", "Semi-Private": "SEMI_PRIVATE", Private: "PRIVATE" };
    const mapped = typeMap[courseData.access];
    if (mapped) {
      updates.courseType = mapped;
      updates.isPublic = courseData.access === "Public" || courseData.access === "Semi-Private";
    }
  }
  if (!existing.zipCode && courseData.zipCode) {
    updates.zipCode = String(courseData.zipCode);
  }
  if (!existing.city && courseData.city) {
    updates.city = courseData.city;
  }
  if (!existing.state && courseData.state) {
    updates.state = courseData.state;
  }
  if (!existing.websiteUrl && courseData.websiteUrl) {
    updates.websiteUrl = courseData.websiteUrl;
  }
  if (!existing.phone && courseData.phone) {
    updates.phone = courseData.phone;
  }
  // Update holeCount only if DB still has the default (18) and Claude found something different,
  // or if it was null
  if (
    (!existing.holeCount || existing.holeCount === 18) &&
    courseData.holeCount &&
    [9, 18, 27, 36].includes(Number(courseData.holeCount))
  ) {
    updates.holeCount = Number(courseData.holeCount);
  }
  if (!existing.latitude && courseData.latitude) {
    const lat = Number(courseData.latitude);
    if (!isNaN(lat) && lat >= -90 && lat <= 90) updates.latitude = lat;
  }
  if (!existing.longitude && courseData.longitude) {
    const lng = Number(courseData.longitude);
    if (!isNaN(lng) && lng >= -180 && lng <= 180) updates.longitude = lng;
  }

  // Upload images to Supabase Storage
  if (!existing.coverImageUrl && courseData.coverPhotoUrl) {
    console.log(`    📸 Uploading cover...`);
    const url = await uploadImage(courseData.coverPhotoUrl, existing.id, "cover");
    if (url) updates.coverImageUrl = url;
  }
  if (!existing.logoUrl && courseData.logoUrl) {
    console.log(`    🏷  Uploading logo...`);
    const url = await uploadImage(courseData.logoUrl, existing.id, "logo");
    if (url) updates.logoUrl = url;
  }

  if (Object.keys(updates).length === 0) {
    return { updated: false };
  }

  updates.updatedAt = new Date().toISOString();

  const { error } = await supabase.from("Course").update(updates).eq("id", existing.id);
  if (error) throw new Error(`Update failed: ${error.message}`);

  return { updated: true, fields: Object.keys(updates).filter((k) => k !== "updatedAt" && k !== "isPublic") };
}

// ─── Ensure holes exist ────────────────────────────────────────────────────────

async function ensureHoles(courseId, holeCount) {
  const { count } = await supabase
    .from("Hole")
    .select("id", { count: "exact", head: true })
    .eq("courseId", courseId);

  if (count > 0) return;

  const now = new Date().toISOString();
  const total = [9, 18, 27, 36].includes(holeCount) ? holeCount : 18;
  const holes = Array.from({ length: total }, (_, i) => ({
    id: randomUUID(),
    courseId,
    holeNumber: i + 1,
    par: 4,
    uploadCount: 0,
    createdAt: now,
    updatedAt: now,
  }));

  const { error } = await supabase.from("Hole").insert(holes);
  if (error) console.log(`    ⚠ Hole insert failed: ${error.message}`);
}

// ─── Process a batch ──────────────────────────────────────────────────────────

async function processBatch(dbCourses) {
  const results = { success: [], failed: [], skipped: [] };

  const researched = await researchCourses(dbCourses);

  // Build lookup by courseId first, fall back to name match
  const byId = {};
  for (const r of researched) {
    if (r.courseId) byId[r.courseId] = r;
  }

  for (const existing of dbCourses) {
    let courseData = byId[existing.id];
    if (!courseData) {
      courseData = researched.find(
        (r) => r.courseName?.toLowerCase() === existing.name.toLowerCase()
      );
    }
    if (!courseData) {
      results.failed.push({ name: existing.name, reason: "No match in Claude response" });
      continue;
    }

    try {
      const result = await updateCourse(existing, courseData);
      const holeCount = Number(courseData.holeCount) || existing.holeCount || 18;
      await ensureHoles(existing.id, holeCount);

      if (!result.updated) {
        results.skipped.push({ name: existing.name });
        console.log(`  ⏭  No new fields — ${existing.name}`);
      } else {
        results.success.push({ name: existing.name, fields: result.fields });
        console.log(`  ✅ Updated (${result.fields.join(", ")}) — ${existing.name}`);
        if (courseData.sourceNotes) {
          console.log(`     Notes: ${courseData.sourceNotes}`);
        }
      }
    } catch (err) {
      console.error(`  ✗ ${existing.name}: ${err.message}`);
      results.failed.push({ name: existing.name, reason: err.message });
    }
  }

  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🏌️  Tour It — Bulk Course Seeder v2");
  console.log("=====================================\n");

  const args = parseArgs();
  let dbCourses = [];

  if (args.dbStates.length > 0) {
    console.log(`Mode: DB query — states: ${args.dbStates.join(", ")}, limit: ${args.limit}\n`);
    console.log(`Querying DB for unseeded courses...`);
    dbCourses = await getUnseededCourses(args.dbStates, args.limit);
    console.log(`Found ${dbCourses.length} courses needing enrichment\n`);
  } else if (args.list.length > 0) {
    console.log(`Mode: Named list (${args.list.length} courses)\n`);
    for (const name of args.list) {
      const { data } = await supabase
        .from("Course")
        .select(
          "id, name, city, state, zipCode, description, coverImageUrl, logoUrl, yearEstablished, courseType, websiteUrl, phone, holeCount, latitude, longitude"
        )
        .ilike("name", `%${name}%`)
        .limit(1)
        .single();
      if (data) dbCourses.push(data);
      else console.log(`  ⚠ No DB match for: ${name}`);
    }
  } else {
    console.log("Usage:");
    console.log("  node src/scripts/seed-courses-bulk.mjs --db-state NY,NC,FL --limit 300");
    console.log("  node src/scripts/seed-courses-bulk.mjs --db-state FL --limit 100");
    console.log('  node src/scripts/seed-courses-bulk.mjs --list "Bethpage Black,Pinehurst No. 2"');
    process.exit(0);
  }

  if (dbCourses.length === 0) {
    console.log("No courses to process.");
    process.exit(0);
  }

  console.log(`Processing ${dbCourses.length} courses in batches of ${CONCURRENCY}...\n`);

  const batches = [];
  for (let i = 0; i < dbCourses.length; i += CONCURRENCY) {
    batches.push(dbCourses.slice(i, i + CONCURRENCY));
  }

  const allResults = { success: [], failed: [], skipped: [] };

  for (let i = 0; i < batches.length; i++) {
    console.log(`\nBatch ${i + 1}/${batches.length}:`);
    const batchResults = await processBatch(batches[i]);
    allResults.success.push(...batchResults.success);
    allResults.failed.push(...batchResults.failed);
    allResults.skipped.push(...batchResults.skipped);

    if (i < batches.length - 1) {
      console.log(`  ⏳ Waiting ${BATCH_DELAY / 1000}s...`);
      await sleep(BATCH_DELAY);
    }
  }

  console.log("\n=====================================");
  console.log("Summary");
  console.log("=====================================");
  console.log(`✅ Updated: ${allResults.success.length}`);
  console.log(`⏭  Skipped: ${allResults.skipped.length}`);
  console.log(`✗  Failed:  ${allResults.failed.length}`);

  if (allResults.failed.length > 0) {
    console.log("\nFailed courses:");
    allResults.failed.forEach((c) => console.log(`  - ${c.name}: ${c.reason}`));
  }

  console.log("\nDone. Check Supabase → Table Editor → Course to verify.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
