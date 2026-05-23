#!/usr/bin/env node

/**
 * Tour It — Seed three brand-new / hard-to-find courses
 *
 * Targets: Pine Valley Golf Club (Clementon NJ), Trout National – The
 * Reserve (Millville NJ), and Rodeo Dunes (Roggen CO).
 *
 * Behavior:
 *   - Each course is matched by case-insensitive name. If a row exists,
 *     we UPDATE in fill-nulls-only mode (never clobber data the bulk
 *     seeder already set). If not, we INSERT a fresh row WITH consent
 *     from the user — overrides the standing "UPDATE only" rule for
 *     these three because they're brand-new builds the external data
 *     source doesn't have yet.
 *   - 18 Hole rows are inserted for every course (par 4 default). For
 *     Pine Valley specifically the scorecard is filled in (par,
 *     yardage, handicapRank from the back tees).
 *   - Logo + cover images are downloaded from the source URL and
 *     uploaded to Supabase Storage at
 *     tour-it-photos/course-images/{courseId}-{type}.{ext}. The DB
 *     stores the Supabase public URL only — never an external URL.
 *
 * Usage:
 *   node src/scripts/seed-three-courses.mjs            # dry-run, no DB writes
 *   node src/scripts/seed-three-courses.mjs --apply    # apply changes
 *
 * Required env (from .env): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Course data ─────────────────────────────────────────────────────────────

const COURSES = [
  {
    name: "Pine Valley Golf Club",
    city: "Clementon",
    state: "NJ",
    zipCode: "08021",
    latitude: 39.789,
    longitude: -74.972,
    yearEstablished: 1913,
    courseType: "PRIVATE",
    holeCount: 18,
    websiteUrl: "https://www.pinevalleygolfclub.com/",
    description:
      "Pine Valley is the original sand-and-pine fever dream — George Crump cleared 22,000 tree stumps from a Camden County wasteland in the 1910s and the result still plays like a series of island fairways floating in scrub. The 7th is a 636-yard par 5 with a literal Hell's Half Acre splitting fairway from green, which tells you most of what you need to know. You leave wrung out and already plotting how to get invited back.",
    logoUrl: null,
    coverImageUrl: null,
    scorecard: [
      { hole: 1, par: 4, yardage: 421, handicapRank: 3 },
      { hole: 2, par: 4, yardage: 368, handicapRank: 9 },
      { hole: 3, par: 3, yardage: 198, handicapRank: 17 },
      { hole: 4, par: 4, yardage: 499, handicapRank: 5 },
      { hole: 5, par: 3, yardage: 238, handicapRank: 11 },
      { hole: 6, par: 4, yardage: 394, handicapRank: 13 },
      { hole: 7, par: 5, yardage: 636, handicapRank: 1 },
      { hole: 8, par: 4, yardage: 326, handicapRank: 15 },
      { hole: 9, par: 4, yardage: 458, handicapRank: 7 },
      { hole: 10, par: 3, yardage: 161, handicapRank: 18 },
      { hole: 11, par: 4, yardage: 397, handicapRank: 10 },
      { hole: 12, par: 4, yardage: 337, handicapRank: 14 },
      { hole: 13, par: 4, yardage: 486, handicapRank: 4 },
      { hole: 14, par: 3, yardage: 220, handicapRank: 16 },
      { hole: 15, par: 5, yardage: 615, handicapRank: 2 },
      { hole: 16, par: 4, yardage: 475, handicapRank: 8 },
      { hole: 17, par: 4, yardage: 345, handicapRank: 12 },
      { hole: 18, par: 4, yardage: 483, handicapRank: 6 },
    ],
  },
  {
    name: "Trout National - The Reserve",
    city: "Millville",
    state: "NJ",
    zipCode: "08332",
    latitude: 39.4055,
    longitude: -74.9782,
    yearEstablished: 2026,
    courseType: "PRIVATE",
    holeCount: 18,
    websiteUrl: "https://www.troutnational-thereserve.com/",
    description:
      "Mike Trout grew up fifteen minutes away in Millville and convinced Tiger Woods to route this on 280 acres of decommissioned silica sand mine — which means the sandy waste areas weren't imported, they were already there. Plays a tipped-out 7,455 from the back with four par 5s, four par 3s, and water in play on five holes, plus a floodlit par-3 short course called The Bullpen for after dinner. It feels less like New Jersey and more like a Sandhills course someone teleported east.",
    logoUrl:
      "https://cdn.prod.website-files.com/6691584e3b2d46c4587ab9e0/6691584e3b2d46c4587ab9e6_trout%20logo_vert.svg",
    coverImageUrl:
      "https://cdn.prod.website-files.com/6691584e3b2d46c4587ab9e0/67d4aaeb439d45486cad76fa_DJI_0725-copy.jpg",
    scorecard: null, // private, hole-by-hole not public yet
  },
  {
    name: "Rodeo Dunes",
    city: "Roggen",
    state: "CO",
    zipCode: "80652",
    latitude: 40.1854,
    longitude: -104.3764,
    yearEstablished: 2026,
    courseType: "PUBLIC",
    holeCount: 18,
    websiteUrl: "https://www.rodeodunes.com/",
    description:
      "Dream Golf's eastern-Colorado answer to Bandon and Sand Valley sits on 4,000 acres of 90-foot sand dunes 45 minutes from DIA, and Coore & Crenshaw cut the fairways down through the dunes rather than laying them across the top — which gives the whole thing a raw, Irish-links texture. The first course measures 6,948 from the back tees as a walking-only par 72 with four par 5s and four par 3s, with room to stretch past 7,200 when needed. You play under a sky that feels like it goes another hundred miles past the Front Range.",
    logoUrl:
      "https://images.squarespace-cdn.com/content/v1/63deb1dbd3ba8f71b9f725d3/c967022a-6f37-4e3b-8e56-22916f97e472/RD-Logo-White-FullLogo.png",
    coverImageUrl:
      "https://images.squarespace-cdn.com/content/v1/63deb1dbd3ba8f71b9f725d3/e266684a-44cd-4043-b0b0-d1f2b05054c6/Aerial-Sunrise-Photos---Rodeo-Dunes---Marsh-2025--73.jpg",
    scorecard: null,
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extFromUrl(url) {
  const m = url.split("?")[0].match(/\.(jpg|jpeg|png|webp|svg)$/i);
  return m ? m[1].toLowerCase() : "jpg";
}

async function downloadAndUpload(sourceUrl, courseId, type) {
  if (!sourceUrl) return null;
  const ext = extFromUrl(sourceUrl);
  const path = `course-images/${courseId}-${type}.${ext}`;
  if (!APPLY) {
    console.log(`    [dry-run] would download ${sourceUrl} → ${path}`);
    return `(dry-run-placeholder)/${path}`;
  }
  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TourIt/1.0)" },
    });
    if (!res.ok) {
      console.log(`    download failed (${res.status}) ${sourceUrl}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const mime =
      ext === "svg"
        ? "image/svg+xml"
        : ext === "png"
        ? "image/png"
        : ext === "webp"
        ? "image/webp"
        : "image/jpeg";
    const { error } = await supabase.storage
      .from("tour-it-photos")
      .upload(path, buf, { contentType: mime, upsert: true });
    if (error) {
      console.log(`    upload failed: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from("tour-it-photos").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.log(`    image error: ${e.message}`);
    return null;
  }
}

async function findExistingCourse(name) {
  const { data, error } = await supabase
    .from("Course")
    .select("id, name, city, state, zipCode, description, logoUrl, coverImageUrl, yearEstablished, courseType, latitude, longitude, websiteUrl")
    .ilike("name", name)
    .limit(2);
  if (error) {
    console.log(`  lookup error: ${error.message}`);
    return null;
  }
  return data && data.length > 0 ? data[0] : null;
}

async function seedHoles(courseId, holeCount, scorecard) {
  // Check whether holes already exist for this course
  const { data: existingHoles } = await supabase
    .from("Hole")
    .select("id, holeNumber, par, yardage, handicapRank")
    .eq("courseId", courseId);
  const existingByNum = new Map((existingHoles || []).map((h) => [h.holeNumber, h]));

  const now = new Date().toISOString();
  const toInsert = [];
  const toUpdate = [];
  for (let n = 1; n <= holeCount; n++) {
    const card = scorecard?.find((c) => c.hole === n);
    const existing = existingByNum.get(n);
    if (!existing) {
      toInsert.push({
        id: randomUUID(),
        courseId,
        holeNumber: n,
        par: card?.par ?? 4,
        yardage: card?.yardage ?? null,
        handicapRank: card?.handicapRank ?? null,
        uploadCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    } else if (card) {
      // Fill-nulls-only: only set scorecard values where existing is null
      const patch = {};
      if (existing.yardage == null && card.yardage != null) patch.yardage = card.yardage;
      if (existing.handicapRank == null && card.handicapRank != null) patch.handicapRank = card.handicapRank;
      // Par is non-null in schema; only overwrite if the existing default of 4
      // is wrong AND the scorecard has a real value (avoid clobbering user edits)
      if (existing.par === 4 && card.par !== 4) patch.par = card.par;
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = now;
        toUpdate.push({ id: existing.id, patch });
      }
    }
  }
  console.log(`  holes: insert=${toInsert.length}  update=${toUpdate.length}  existing=${existingByNum.size}`);
  if (!APPLY) return;
  if (toInsert.length > 0) {
    const { error } = await supabase.from("Hole").insert(toInsert);
    if (error) console.log(`    hole insert error: ${error.message}`);
  }
  for (const { id, patch } of toUpdate) {
    const { error } = await supabase.from("Hole").update(patch).eq("id", id);
    if (error) console.log(`    hole update error (${id}): ${error.message}`);
  }
}

async function seedCourse(course) {
  console.log(`\n▶ ${course.name}`);
  const existing = await findExistingCourse(course.name);
  const courseId = existing?.id ?? randomUUID();
  const isInsert = !existing;
  console.log(`  ${isInsert ? "INSERT (no existing match)" : `UPDATE (found id=${courseId})`}`);

  // Upload images (no-op if URL is null)
  const logoUrl = await downloadAndUpload(course.logoUrl, courseId, "logo");
  const coverImageUrl = await downloadAndUpload(course.coverImageUrl, courseId, "cover");

  const now = new Date().toISOString();

  if (isInsert) {
    const row = {
      id: courseId,
      slug: `${slugify(course.name)}-${slugify(course.city)}`,
      name: course.name,
      city: course.city,
      state: course.state,
      zipCode: course.zipCode,
      latitude: course.latitude,
      longitude: course.longitude,
      yearEstablished: course.yearEstablished,
      courseType: course.courseType,
      holeCount: course.holeCount,
      websiteUrl: course.websiteUrl,
      description: course.description,
      logoUrl,
      coverImageUrl,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    };
    console.log(`  course row →`, { id: row.id, slug: row.slug, name: row.name, city: row.city, state: row.state });
    if (APPLY) {
      const { error } = await supabase.from("Course").insert(row);
      if (error) {
        console.log(`  ❌ insert error: ${error.message}`);
        return;
      }
      console.log(`  ✓ inserted`);
    } else {
      console.log(`  [dry-run] would insert`);
    }
  } else {
    // UPDATE — fill nulls only, never clobber existing data
    const patch = { updatedAt: now };
    if (existing.description == null && course.description) patch.description = course.description;
    if (existing.logoUrl == null && logoUrl) patch.logoUrl = logoUrl;
    if (existing.coverImageUrl == null && coverImageUrl) patch.coverImageUrl = coverImageUrl;
    if (existing.yearEstablished == null && course.yearEstablished) patch.yearEstablished = course.yearEstablished;
    if (existing.courseType == null && course.courseType) patch.courseType = course.courseType;
    if (existing.zipCode == null && course.zipCode) patch.zipCode = course.zipCode;
    if (existing.latitude == null && course.latitude) patch.latitude = course.latitude;
    if (existing.longitude == null && course.longitude) patch.longitude = course.longitude;
    if (existing.websiteUrl == null && course.websiteUrl) patch.websiteUrl = course.websiteUrl;
    const willChange = Object.keys(patch).filter((k) => k !== "updatedAt");
    console.log(`  fields to fill (existing was null):`, willChange.length > 0 ? willChange : "(none)");
    if (APPLY && willChange.length > 0) {
      const { error } = await supabase.from("Course").update(patch).eq("id", courseId);
      if (error) {
        console.log(`  ❌ update error: ${error.message}`);
        return;
      }
      console.log(`  ✓ updated`);
    } else if (!APPLY && willChange.length > 0) {
      console.log(`  [dry-run] would update fields:`, willChange);
    }
  }

  await seedHoles(courseId, course.holeCount, course.scorecard);
}

// ─── Run ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log(APPLY ? "APPLY MODE — changes will be written" : "DRY RUN — no DB writes (pass --apply to commit)");
  for (const course of COURSES) {
    try {
      await seedCourse(course);
    } catch (e) {
      console.log(`  ❌ unexpected error: ${e.message}`);
    }
  }
  console.log("\nDone.");
})();
