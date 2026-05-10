#!/usr/bin/env node

/**
 * Phase 1 — Issues 2, 3, 4a INSERTs
 *
 * Targeted insert override (sign-off received) for:
 *   • 2 swaps (Bayside GC, Cowboys GC) replacing PRIVATE master-list entries
 *   • 10 missing master courses
 *   • 1 Streamsong Blue split (plus rename of existing Red+Blue row to Red)
 *
 * Uses the same Anthropic research + Supabase Storage pattern as
 * seed-courses-bulk.mjs. UPDATE-only rule explicitly overridden for these
 * specific entries — pre-flight checks each by exact name+state to guard
 * against rows that may have landed via external sync since the audit.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
import { writeFileSync } from "fs";

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CONCURRENCY = 3;
const BATCH_DELAY = 2000;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Same system prompt as seed-courses-bulk.mjs ──────────────────────────────

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

4. **Cover photo**: Wide landscape or aerial shot showing fairways, water, bunkers — the course itself.
   Search everywhere: official site, Golf Digest, GolfPass, TripAdvisor, Yelp, local news, real estate blogs.
   - Must be a direct static image URL (same rules as logo)
   - Avoid: clubhouse-only shots, people posing, watermarked stock photos

5. **Description**: 2-3 sentences. Voice is editorial — written by an enthusiastic golfer who knows the course, not a marketing department.
   - LEAD with what's genuinely distinctive
   - Include one concrete fact: designer + year, slope rating, signature hole, notable tournament
   - End with what the experience actually feels like
   - BAD openers: "Nestled...", "Situated...", "Located...", "Boasting..."
   - BAD phrases: "world-class", "stunning views", "something for everyone", "must-play"

Return ONLY a valid JSON array. No preamble, no explanation, no markdown fences. Just the raw JSON.

Each object must have exactly these fields (include courseId exactly as given — it is your input handle):
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
  "sourceNotes": "One line: where each asset came from"
}

Access definitions:
- Public: anyone can book, no membership required
- Semi-Private: members get priority but public tee times available
- Private: members and invited guests only

If a field cannot be confirmed with confidence, set it to null. Never guess or fabricate.`;

// ─── Targets ──────────────────────────────────────────────────────────────────

const NEW_COURSES = [
  // Issue 2 swaps (replace PRIVATE master entries)
  {
    handleId: "x-bayside",
    name: "Bayside Golf Club",
    city: "Brule",
    state: "NE",
    note: "Public links-style course on Lake McConaughy, the public counterpoint to Sand Hills GC. Replaces Dismal River in master list.",
    masterReplacing: "Dismal River — Red Course",
    region: "Nebraska Sandhills",
  },
  {
    handleId: "x-cowboys",
    name: "Cowboys Golf Club",
    city: "Grapevine",
    state: "TX",
    note: "Public NFL-themed course designed by Jeff Brauer. Replaces Trinity Forest in master list.",
    masterReplacing: "Trinity Forest Golf Club",
    region: "Texas",
  },

  // Issue 3 — 10 missing master entries
  {
    handleId: "x-pacific-dunes",
    name: "Pacific Dunes",
    city: "Bandon",
    state: "OR",
    note: "Tom Doak's 2001 design at Bandon Dunes Resort. Public resort access.",
    region: "Pacific Coast / Bandon",
  },
  {
    handleId: "x-old-macdonald",
    name: "Old Macdonald",
    city: "Bandon",
    state: "OR",
    note: "Tom Doak/Jim Urbina 2010 design at Bandon Dunes Resort, tribute to C.B. Macdonald.",
    region: "Pacific Coast / Bandon",
  },
  {
    handleId: "x-tpc-myrtle",
    name: "TPC Myrtle Beach",
    city: "Murrells Inlet",
    state: "SC",
    note: "Tom Fazio/Lanny Wadkins design. Public, formerly host of the Senior Tour Championship.",
    region: "Myrtle Beach",
  },
  {
    handleId: "x-barefoot-dye",
    name: "Barefoot Resort - Dye Course",
    city: "North Myrtle Beach",
    state: "SC",
    note: "Pete Dye design at Barefoot Resort, opened 2000. Public/resort.",
    region: "Myrtle Beach",
  },
  {
    handleId: "x-mammoth-dunes",
    name: "Mammoth Dunes",
    city: "Nekoosa",
    state: "WI",
    note: "David McLay Kidd design at Sand Valley Resort, 2018. Public resort.",
    region: "Wisconsin",
  },
  {
    handleId: "x-bethpage-red",
    name: "Bethpage Red Course",
    city: "Farmingdale",
    state: "NY",
    note: "One of five courses at Bethpage State Park, NY. Public, A.W. Tillinghast routing.",
    region: "Long Island",
  },
  {
    handleId: "x-kiawah-osprey",
    name: "Kiawah Island Resort - Osprey Point",
    city: "Kiawah Island",
    state: "SC",
    note: "Tom Fazio 1988 design, renovated 2014. Public resort access.",
    region: "Coastal Carolina",
  },
  {
    handleId: "x-forest-dunes-loop-black",
    name: "Forest Dunes - The Loop (Black Course)",
    city: "Roscommon",
    state: "MI",
    note: "Tom Doak reversible course (2016) — same routing as Red, played opposite direction. Public.",
    region: "Northern Michigan",
  },
  {
    handleId: "x-forest-dunes-loop-red",
    name: "Forest Dunes - The Loop (Red Course)",
    city: "Roscommon",
    state: "MI",
    note: "Tom Doak reversible course (2016) — paired with Black, opposite-direction routing. Public.",
    region: "Northern Michigan",
  },
  {
    handleId: "x-memorial-park",
    name: "Memorial Park Golf Course",
    city: "Houston",
    state: "TX",
    note: "Houston city muni redesigned by Tom Doak + Brooks Koepka 2019, hosts PGA Tour Houston Open. Public.",
    region: "Texas",
  },

  // Issue 4a — Streamsong Blue split (existing combined row gets renamed to Red below)
  {
    handleId: "x-streamsong-blue",
    name: "Streamsong Resort - Blue Course",
    city: "Bowling Green",
    state: "FL",
    note: "Tom Doak design at Streamsong, 2012. Public resort. Existing 'Red and Blue Courses' combined row will be renamed Red.",
    region: "Streamsong",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureUniqueSlug(base) {
  let candidate = base;
  let n = 1;
  while (true) {
    const { data } = await supabase.from("Course").select("id").eq("slug", candidate).limit(1);
    if (!data || data.length === 0) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

function extFromContentType(ct, fb = "jpg") {
  if (!ct) return fb;
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("svg")) return "svg";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  return fb;
}
function extFromUrl(u) {
  const m = u.match(/\.(jpg|jpeg|png|webp|svg)(\?|$)/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : null;
}
async function uploadImage(url, courseId, type) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: "https://www.google.com/",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) { console.log(`    ⚠ image ${res.status}: ${url.slice(0,80)}`); return null; }
    const ct = res.headers.get("content-type") || "";
    const ext = extFromUrl(url) || extFromContentType(ct);
    const buf = await res.arrayBuffer();
    const path = `course-images/${courseId}-${type}.${ext}`;
    const { error } = await supabase.storage.from("tour-it-photos").upload(path, new Uint8Array(buf), { contentType: ct || `image/${ext}`, upsert: true });
    if (error) { console.log(`    ⚠ upload: ${error.message}`); return null; }
    const { data } = supabase.storage.from("tour-it-photos").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) { console.log(`    ⚠ image err: ${e.message}`); return null; }
}

async function research(courses) {
  const list = courses.map((c, i) =>
    `${i + 1}. courseId: "${c.handleId}" | name: "${c.name}" | location: ${c.city}, ${c.state}${c.note ? ` | note: ${c.note}` : ""}`
  ).join("\n");

  console.log(`  🔍 Researching: ${courses.map((c) => c.name).join(", ")}`);
  const r = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: SEEDER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Research these courses and return a JSON array:\n\n${list}` }],
  });
  const raw = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) { console.error(`  ✗ no JSON in response`); return []; }
  try { return JSON.parse(m[0]); } catch (e) { console.error(`  ✗ parse: ${e.message}`); return []; }
}

const ACCESS_MAP = { Public: "PUBLIC", "Semi-Private": "SEMI_PRIVATE", Private: "PRIVATE" };

async function preflight(c) {
  const { data } = await supabase
    .from("Course")
    .select("id, name, city, state")
    .eq("state", c.state)
    .ilike("name", `%${c.name.split(" - ")[0].split(" — ")[0]}%`)
    .limit(20);
  return data || [];
}

async function insertOne(target, researchData) {
  // Pre-flight
  const existing = await preflight(target);
  const matches = existing.filter((e) =>
    e.name.toLowerCase() === researchData.courseName?.toLowerCase() ||
    e.name.toLowerCase() === target.name.toLowerCase()
  );
  if (matches.length > 0) {
    return { handleId: target.handleId, status: "skipped-already-exists", existingId: matches[0].id };
  }

  const finalName = researchData.courseName || target.name;
  const finalCity = researchData.city || target.city;
  const finalState = researchData.state || target.state;
  const slugBase = slugify(`${finalName}-${finalCity}-${finalState}`);
  const slug = await ensureUniqueSlug(slugBase);

  const id = randomUUID();
  const access = researchData.access ? ACCESS_MAP[researchData.access] : null;
  const isPublic = access === "PUBLIC" || access === "SEMI_PRIVATE";

  const yr = Number(researchData.yearEstablished);
  const yearOk = !isNaN(yr) && yr >= 1800 && yr <= new Date().getFullYear();
  const lat = researchData.latitude !== null ? Number(researchData.latitude) : null;
  const lng = researchData.longitude !== null ? Number(researchData.longitude) : null;
  const holeCount = [9, 18, 27, 36].includes(Number(researchData.holeCount)) ? Number(researchData.holeCount) : 18;

  const now = new Date().toISOString();
  const row = {
    id,
    name: finalName,
    slug,
    city: finalCity,
    state: finalState,
    country: "US",
    latitude: lat !== null && !isNaN(lat) && lat >= -90 && lat <= 90 ? lat : null,
    longitude: lng !== null && !isNaN(lng) && lng >= -180 && lng <= 180 ? lng : null,
    websiteUrl: researchData.websiteUrl || null,
    phone: researchData.phone || null,
    description: researchData.description ? researchData.description.trim().slice(0, 2000) : null,
    holeCount,
    isPublic,
    courseType: access,
    zipCode: researchData.zipCode ? String(researchData.zipCode) : null,
    yearEstablished: yearOk ? yr : null,
    isVerified: false,
    coverImageUrl: null, // set after upload below
    logoUrl: null,
    uploadCount: 0,
    saveCount: 0,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  // Image uploads
  if (researchData.coverPhotoUrl) {
    console.log(`    📸 cover for ${finalName}`);
    const url = await uploadImage(researchData.coverPhotoUrl, id, "cover");
    if (url) row.coverImageUrl = url;
  }
  if (researchData.logoUrl) {
    console.log(`    🏷  logo for ${finalName}`);
    const url = await uploadImage(researchData.logoUrl, id, "logo");
    if (url) row.logoUrl = url;
  }

  const { error: insErr } = await supabase.from("Course").insert(row);
  if (insErr) return { handleId: target.handleId, status: "error", error: insErr.message };

  // Holes
  const holes = Array.from({ length: holeCount }, (_, i) => ({
    id: randomUUID(),
    courseId: id,
    holeNumber: i + 1,
    par: 4,
    uploadCount: 0,
    createdAt: now,
    updatedAt: now,
  }));
  const { error: holeErr } = await supabase.from("Hole").insert(holes);
  if (holeErr) console.log(`    ⚠ Holes insert: ${holeErr.message}`);

  return {
    handleId: target.handleId,
    status: "inserted",
    courseId: id,
    name: finalName,
    slug,
    fields: {
      description: !!row.description,
      coverImageUrl: !!row.coverImageUrl,
      logoUrl: !!row.logoUrl,
      yearEstablished: !!row.yearEstablished,
      courseType: !!row.courseType,
      latitude: row.latitude !== null,
      longitude: row.longitude !== null,
      phone: !!row.phone,
      websiteUrl: !!row.websiteUrl,
      zipCode: !!row.zipCode,
    },
    sourceNotes: researchData.sourceNotes || null,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🏌️  Phase 1 — Insert Override (Issues 2 + 3 + 4a)");
  console.log("====================================================\n");

  const results = [];

  // Process in batches
  const batches = [];
  for (let i = 0; i < NEW_COURSES.length; i += CONCURRENCY) {
    batches.push(NEW_COURSES.slice(i, i + CONCURRENCY));
  }

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    console.log(`\nBatch ${bi + 1}/${batches.length}:`);
    const researched = await research(batch);
    const byHandle = {};
    researched.forEach((r) => { if (r.courseId) byHandle[r.courseId] = r; });

    for (const target of batch) {
      let data = byHandle[target.handleId];
      if (!data) {
        data = researched.find((r) => r.courseName?.toLowerCase() === target.name.toLowerCase());
      }
      if (!data) {
        results.push({ handleId: target.handleId, name: target.name, status: "no-research-data" });
        console.log(`  ✗ ${target.name}: no research data`);
        continue;
      }

      try {
        const res = await insertOne(target, data);
        results.push({ ...res, name: target.name, region: target.region, masterReplacing: target.masterReplacing });
        if (res.status === "inserted") {
          const filled = Object.entries(res.fields).filter(([, v]) => v).map(([k]) => k).join(", ");
          console.log(`  ✅ Inserted ${res.name} (${res.courseId})`);
          console.log(`     filled: ${filled}`);
          if (res.sourceNotes) console.log(`     notes: ${res.sourceNotes}`);
        } else if (res.status === "skipped-already-exists") {
          console.log(`  ⏭  Already exists in DB: ${target.name} → ${res.existingId}`);
        } else {
          console.log(`  ✗ ${target.name}: ${res.error || res.status}`);
        }
      } catch (e) {
        console.log(`  ✗ ${target.name}: ${e.message}`);
        results.push({ handleId: target.handleId, name: target.name, status: "exception", error: e.message });
      }
    }

    if (bi < batches.length - 1) {
      console.log(`  ⏳ ${BATCH_DELAY / 1000}s pause`);
      await new Promise((r) => setTimeout(r, BATCH_DELAY));
    }
  }

  // Issue 4a — rename existing Streamsong Red+Blue row to Red
  console.log("\n─── Issue 4a: rename existing Streamsong Red+Blue row to Red ───");
  const { error: renameErr } = await supabase
    .from("Course")
    .update({ name: "Streamsong Resort - Red Course", updatedAt: new Date().toISOString() })
    .eq("id", "85d5d80b-2686-4195-ad5f-fe746c42673b");
  if (renameErr) console.log(`  ✗ rename: ${renameErr.message}`);
  else console.log("  ✅ Renamed 85d5d80b… → 'Streamsong Resort - Red Course'");

  // Output
  writeFileSync("phase1-inserts.json", JSON.stringify(results, null, 2));

  // Summary
  console.log("\n====================================================");
  console.log("Summary");
  console.log("====================================================");
  const inserted = results.filter((r) => r.status === "inserted");
  const skipped = results.filter((r) => r.status === "skipped-already-exists");
  const failed = results.filter((r) => r.status !== "inserted" && r.status !== "skipped-already-exists");
  console.log(`✅ Inserted: ${inserted.length}`);
  console.log(`⏭  Skipped (already exists): ${skipped.length}`);
  console.log(`✗  Failed: ${failed.length}`);
  if (failed.length) {
    console.log("\nFailures:");
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.error || f.status}`));
  }
  console.log("\nDone.");
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
