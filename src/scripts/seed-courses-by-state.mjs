#!/usr/bin/env node
/**
 * Tour It — AI Course Enrichment by State
 *
 * Queries existing DB courses in specified states that are missing data,
 * researches them via Claude, uploads images to Supabase Storage, and
 * UPDATEs the existing records. Never inserts new rows.
 *
 * Usage:
 *   node src/scripts/seed-courses-by-state.mjs --states NY,NC,FL
 *   node src/scripts/seed-courses-by-state.mjs --states NY,NC,FL --per-state 100
 *   node src/scripts/seed-courses-by-state.mjs --states FL --per-state 50 --dry-run
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANTHROPIC_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing required env vars: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Args ─────────────────────────────────────────────────────────────────────

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : null;
  };
  return {
    states:   (get("--states") || "NY,NC,FL").split(",").map(s => s.trim().toUpperCase()),
    perState: parseInt(get("--per-state") || "100"),
    batchSize: parseInt(get("--batch-size") || "3"),
    dryRun:   argv.includes("--dry-run"),
    delayMs:  parseInt(get("--delay") || "2000"),
  };
}

// ─── Claude research prompt ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a content researcher for Tour It, a golf scouting platform.
You will be given a list of golf course records (each has an id, name, city, state).
Research each one and return enrichment data.

For each course:
1. Write a 2–3 sentence description. Open with what makes it distinct (designer, setting, rep).
   Include one specific fact (slope, year opened, notable hole). End with the feel/experience.
   Voice: confident, specific, slightly editorial. NOT "world-class" or "stunning views".

2. Find the year established (when the course opened, not the club founded).

3. Classify access:
   - "Public" — anyone can book, no membership required
   - "Semi-Private" — members get priority, public tee times available
   - "Private" — members and invited guests only

4. Find a logo URL: club crest or emblem (NOT a wordmark if avoidable).
   Must be a direct image file (.jpg, .png, .webp, .svg). No .aspx or getImage.gif URLs.
   Must NOT be transparent (dark background app). Set null if unsure.

5. Find a cover photo URL: wide landscape or aerial of the course (fairways, bunkers, water).
   Same URL rules. Avoid clubhouse-only or people posing. Set null if unsure.

Return ONLY a valid JSON array — no markdown, no explanation. One object per course:
{
  "id": "(echo back the same id given to you — do not change)",
  "description": "string or null",
  "yearEstablished": 1985 or null,
  "access": "Public"|"Semi-Private"|"Private" or null,
  "logoUrl": "https://..." or null,
  "coverPhotoUrl": "https://..." or null,
  "notes": "one-line source notes"
}

If a field cannot be confirmed with confidence, set it to null. Never fabricate.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isWellSeeded(c) {
  const score = [c.description, c.coverImageUrl, c.logoUrl, c.yearEstablished, c.courseType || c.access].filter(Boolean).length;
  return score >= 4;
}

async function uploadImage(courseId, imageUrl, type) {
  if (!imageUrl) return null;

  const cleanUrl = imageUrl.split("?")[0];
  const rawExt   = cleanUrl.split(".").pop().toLowerCase();
  const ext      = /^(jpg|jpeg|png|webp|gif|svg)$/.test(rawExt) ? rawExt : "jpg";
  const storagePath = `course-images/${courseId}-${type}.${ext}`;

  try {
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) throw new Error(`Not an image: ${contentType}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1000) throw new Error(`Suspiciously small (${buffer.length} bytes)`);

    const { error } = await supabase.storage
      .from("tour-it-photos")
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (error) throw new Error(`Storage: ${error.message}`);

    const { data: { publicUrl } } = supabase.storage.from("tour-it-photos").getPublicUrl(storagePath);
    return publicUrl;
  } catch (err) {
    console.warn(`      ⚠ ${type} upload failed: ${err.message}`);
    return null;
  }
}

// ─── Research via Claude ───────────────────────────────────────────────────────

async function researchBatch(courses) {
  const prompt = courses.map(c => `id: ${c.id}\nname: ${c.name}\ncity: ${c.city}, ${c.state}`).join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Research these golf courses:\n\n${prompt}` }],
  });

  const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("");
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    console.error(`  ✗ JSON parse failed: ${err.message}`);
    console.error(`  Raw: ${cleaned.slice(0, 400)}`);
    return [];
  }
}

// ─── Enrich one course ────────────────────────────────────────────────────────

async function enrichCourse(dbRecord, research, dryRun) {
  const updates = {};

  if (!dbRecord.description   && research.description)    updates.description    = research.description;
  if (!dbRecord.yearEstablished && research.yearEstablished) updates.yearEstablished = research.yearEstablished;
  if (!dbRecord.courseType    && research.access) {
    const accessMap = { "Public": "PUBLIC", "Private": "PRIVATE", "Semi-Private": "SEMI_PRIVATE" };
    const mapped = accessMap[research.access];
    if (mapped) updates.courseType = mapped;
  }
  if (research.access && dbRecord.isPublic === null) {
    updates.isPublic = research.access !== "Private";
  }

  // Images: fetch external URL → upload to Storage → store Supabase URL
  if (!dbRecord.coverImageUrl && research.coverPhotoUrl) {
    const url = dryRun ? `(would upload: ${research.coverPhotoUrl})` : await uploadImage(dbRecord.id, research.coverPhotoUrl, "cover");
    if (url) updates.coverImageUrl = url;
  }
  if (!dbRecord.logoUrl && research.logoUrl) {
    const url = dryRun ? `(would upload: ${research.logoUrl})` : await uploadImage(dbRecord.id, research.logoUrl, "logo");
    if (url) updates.logoUrl = url;
  }

  if (Object.keys(updates).length === 0) return { updated: false, fields: [] };

  if (!dryRun) {
    updates.updatedAt = new Date().toISOString();
    const { error } = await supabase.from("Course").update(updates).eq("id", dbRecord.id);
    if (error) throw new Error(error.message);
  }

  return { updated: true, fields: Object.keys(updates).filter(k => k !== "updatedAt") };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { states, perState, batchSize, dryRun, delayMs } = parseArgs();

  console.log(`\n🏌️  Tour It — AI Course Enrichment by State${dryRun ? " [DRY RUN]" : ""}`);
  console.log("=".repeat(55));
  console.log(`States: ${states.join(", ")} | Per-state limit: ${perState} | Batch: ${batchSize}\n`);

  // ─── 1. Fetch unseeded courses from DB ──────────────────────────────────────
  const allCourses = [];

  for (const state of states) {
    const { data, error } = await supabase
      .from("Course")
      .select("id, name, city, state, zipCode, description, coverImageUrl, logoUrl, yearEstablished, courseType, isPublic")
      .eq("state", state)
      .order("name")
      .limit(perState * 3); // fetch 3× limit so we have room to filter

    if (error) { console.error(`Failed to fetch ${state}: ${error.message}`); continue; }

    const unseeded = data.filter(c => !isWellSeeded(c)).slice(0, perState);
    console.log(`${state}: ${data.length} total, ${unseeded.length} selected for enrichment`);
    allCourses.push(...unseeded);
  }

  if (allCourses.length === 0) {
    console.log("\nAll courses already well-seeded. Nothing to do.");
    process.exit(0);
  }

  console.log(`\nTotal to enrich: ${allCourses.length}`);

  // ─── 2. Process in batches ──────────────────────────────────────────────────
  const totals = { updated: 0, skipped: 0, failed: 0 };
  const partials = [];

  for (let i = 0; i < allCourses.length; i += batchSize) {
    const batch = allCourses.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(allCourses.length / batchSize);

    process.stdout.write(`\nBatch ${batchNum}/${totalBatches}: ${batch.map(c => c.name).join(", ")}\n`);

    let researched;
    try {
      researched = await researchBatch(batch);
    } catch (err) {
      console.error(`  ✗ Claude error: ${err.message}`);
      totals.failed += batch.length;
      continue;
    }

    // Map research results back to DB records by id
    const researchById = new Map(researched.map(r => [r.id, r]));

    for (const dbRecord of batch) {
      const research = researchById.get(dbRecord.id);
      if (!research) {
        console.log(`  ⏭  No research returned for: ${dbRecord.name}`);
        totals.skipped++;
        continue;
      }

      try {
        const { updated, fields } = await enrichCourse(dbRecord, research, dryRun);

        if (!updated) {
          console.log(`  ⏭  Nothing to update: ${dbRecord.name}`);
          totals.skipped++;
        } else {
          const missingAfter = ["description", "coverImageUrl", "logoUrl", "yearEstablished", "courseType"]
            .filter(f => !dbRecord[f] && !fields.includes(f === "courseType" ? "courseType" : f));

          if (missingAfter.length > 0) {
            console.log(`  ⚠️  Partial — ${dbRecord.name} (still missing: ${missingAfter.join(", ")})`);
            partials.push({ name: dbRecord.name, missing: missingAfter });
          } else {
            console.log(`  ✅ Full — ${dbRecord.name}`);
          }
          if (research.notes) console.log(`     Notes: ${research.notes}`);
          totals.updated++;
        }
      } catch (err) {
        console.error(`  ✗ Failed ${dbRecord.name}: ${err.message}`);
        totals.failed++;
      }
    }

    if (i + batchSize < allCourses.length) {
      process.stdout.write(`  Waiting ${delayMs / 1000}s…\n`);
      await sleep(delayMs);
    }
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(55));
  console.log("Summary");
  console.log("=".repeat(55));
  console.log(`✅ Updated: ${totals.updated}`);
  console.log(`⏭  Skipped: ${totals.skipped}`);
  console.log(`✗  Failed:  ${totals.failed}`);

  if (partials.length > 0) {
    console.log(`\nPartials (still need manual work):`);
    partials.forEach(c => console.log(`  - ${c.name}: missing ${c.missing.join(", ")}`));
  }

  console.log("\nDone. Verify in Supabase → Table Editor → Course.\n");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
