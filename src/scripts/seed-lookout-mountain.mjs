#!/usr/bin/env node
/**
 * Creates Lookout Mountain Golf Club (Phoenix, AZ) and seeds all data + scorecard.
 * Run: node src/scripts/seed-lookout-mountain.mjs
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = "tour-it-photos";

const COURSE = {
  name: "Lookout Mountain Golf Club",
  slug: "lookout-mountain-golf-club-phoenix",
  city: "Phoenix",
  state: "AZ",
  zipCode: "85020",
  latitude: 33.5822,
  longitude: -112.0711,
  holeCount: 18,
  yearEstablished: 1987,
  courseType: "PUBLIC",
  isPublic: true,
  uploadCount: 0,
  description:
    "Designed by Bill Johnston and Forrest Richardson inside the Phoenix Mountain Preserve, Lookout Mountain Golf Club plays to 6,515 yards (par 72) with five par-3s and elevation changes that make it one of metro Phoenix's most dynamic resort tracks. The course's signature is hole 10 — a par-4 played from the highest tee box in the Phoenix Valley — and hole 18, a 512-yard par-5 whose approach threads a 10-yard-wide desert wash corridor to an island-style green. A nine-time Golf Digest Four Star Award winner, rated 70.0/130 from the championship tees.",
  coverImageUrl: null,
  logoUrl: null,
};

const COVER_URL = "https://www.lookoutmountaingolf.com/wp-content/uploads/sites/9001/2024/04/PHXTCPR_LOMGolf_Aerial-07.jpg";
const LOGO_URL  = "https://www.lookoutmountaingolf.com/wp-content/uploads/sites/9001/2023/07/logo.png";

const HOLES = [
  { holeNumber: 1,  par: 4, yardage: 351, handicapRank: 11 },
  { holeNumber: 2,  par: 5, yardage: 475, handicapRank: 9  },
  { holeNumber: 3,  par: 3, yardage: 193, handicapRank: 15 },
  { holeNumber: 4,  par: 4, yardage: 461, handicapRank: 3  },
  { holeNumber: 5,  par: 5, yardage: 515, handicapRank: 7  },
  { holeNumber: 6,  par: 3, yardage: 238, handicapRank: 13 },
  { holeNumber: 7,  par: 5, yardage: 527, handicapRank: 1  },
  { holeNumber: 8,  par: 4, yardage: 355, handicapRank: 5  },
  { holeNumber: 9,  par: 3, yardage: 115, handicapRank: 17 },
  { holeNumber: 10, par: 4, yardage: 419, handicapRank: 4  },
  { holeNumber: 11, par: 3, yardage: 185, handicapRank: 12 },
  { holeNumber: 12, par: 4, yardage: 417, handicapRank: 2  },
  { holeNumber: 13, par: 4, yardage: 353, handicapRank: 18 },
  { holeNumber: 14, par: 4, yardage: 344, handicapRank: 8  },
  { holeNumber: 15, par: 5, yardage: 492, handicapRank: 16 },
  { holeNumber: 16, par: 3, yardage: 182, handicapRank: 6  },
  { holeNumber: 17, par: 4, yardage: 381, handicapRank: 14 },
  { holeNumber: 18, par: 5, yardage: 512, handicapRank: 10 },
];

async function fetchAndUpload(url, storagePath) {
  const headers = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36" };
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buf, { contentType, upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return publicUrl;
}

async function main() {
  // ── 1. Check / insert course ──
  const { data: existing } = await supabase
    .from("Course")
    .select("id, name")
    .eq("slug", COURSE.slug)
    .maybeSingle();

  let courseId;

  if (existing) {
    courseId = existing.id;
    console.log(`ℹ Course already exists (${courseId}) — updating data...`);
  } else {
    const now = new Date().toISOString();
    const { data: inserted, error: insertErr } = await supabase
      .from("Course")
      .insert({ ...COURSE, id: crypto.randomUUID(), createdAt: now, updatedAt: now })
      .select("id")
      .single();
    if (insertErr) { console.error("❌ Insert failed:", insertErr.message); process.exit(1); }
    courseId = inserted.id;
    console.log(`✅ Course created: ${courseId}`);
  }

  // ── 2. Cover image ──
  console.log("\n── Cover image ──");
  try {
    const coverUrl = await fetchAndUpload(COVER_URL, `course-images/${courseId}-cover.jpg`);
    await supabase.from("Course").update({ coverImageUrl: coverUrl }).eq("id", courseId);
    console.log("  ✅ Cover uploaded");
  } catch (e) {
    console.log(`  ⚠ Cover failed: ${e.message}`);
  }

  // ── 3. Logo ──
  console.log("\n── Logo ──");
  try {
    const logoUrl = await fetchAndUpload(LOGO_URL, `course-images/${courseId}-logo.png`);
    await supabase.from("Course").update({ logoUrl }).eq("id", courseId);
    console.log("  ✅ Logo uploaded");
  } catch (e) {
    console.log(`  ⚠ Logo failed: ${e.message}`);
  }

  // ── 4. Scorecard ──
  console.log("\n── Scorecard ──");
  await supabase.from("Hole").delete().eq("courseId", courseId);
  const now = new Date().toISOString();
  const holeRows = HOLES.map(h => ({
    id: crypto.randomUUID(),
    courseId,
    holeNumber: h.holeNumber,
    par: h.par,
    yardage: h.yardage,
    handicapRank: h.handicapRank,
    createdAt: now,
    updatedAt: now,
  }));
  const { error: holeErr } = await supabase.from("Hole").insert(holeRows);
  if (holeErr) {
    console.error("  ❌ Holes insert failed:", holeErr.message);
  } else {
    const totalYards = HOLES.reduce((s, h) => s + h.yardage, 0);
    const totalPar   = HOLES.reduce((s, h) => s + h.par,     0);
    console.log(`  ✅ 18 holes inserted — par ${totalPar}, ${totalYards} yards`);
  }

  // ── 5. Final record ──
  const { data: final } = await supabase
    .from("Course")
    .select("id, name, city, state, zipCode, yearEstablished, courseType, coverImageUrl, logoUrl")
    .eq("id", courseId)
    .single();
  console.log("\n── Final record ──");
  console.log(JSON.stringify(final, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
