#!/usr/bin/env node

/**
 * Scorecard seeder using GolfCourseAPI (https://api.golfcourseapi.com).
 *
 * For each course in our DB, searches the API by name → filters by state →
 * scores candidates by name + city + course-layout match → pulls the
 * longest tee's per-hole data → upserts into our Hole table.
 *
 * This is authoritative scorecard data (real published yardages + handicap
 * indices), so it overwrites any existing values by default.
 *
 * Usage:
 *   node src/scripts/seed-scorecards-from-api.mjs --ids "<id1>,<id2>"
 *   node src/scripts/seed-scorecards-from-api.mjs --missing-itinerary
 *   node src/scripts/seed-scorecards-from-api.mjs --all-itinerary    (force re-run)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const KEY = process.env.GOLF_COURSE_API_KEY;
if (!KEY) { console.error("GOLF_COURSE_API_KEY missing"); process.exit(1); }

const API_BASE = "https://api.golfcourseapi.com/v1";
const HEADERS = { Authorization: `Key ${KEY}` };

// Rate limit: free tier is ~10/min. We pace at one call every 7s with
// exponential backoff on 429.
const REQUEST_INTERVAL_MS = 7000;
let lastReqAt = 0;

async function rateLimitedFetch(url, attempt = 1) {
  const wait = Math.max(0, lastReqAt + REQUEST_INTERVAL_MS - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastReqAt = Date.now();
  const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  if (r.status === 429 && attempt <= 3) {
    const backoff = 30000 * attempt;
    console.log(`    ⏳ 429 — backing off ${backoff / 1000}s (attempt ${attempt}/3)`);
    await new Promise((res) => setTimeout(res, backoff));
    return rateLimitedFetch(url, attempt + 1);
  }
  return r;
}

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { ids: [], idsFile: null, missingItinerary: false, allItinerary: false, dryRun: false, topN: 0, force: false };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--ids" && a[i + 1]) out.ids = a[i + 1].split(",").map((s) => s.trim());
    if (a[i] === "--ids-file" && a[i + 1]) out.idsFile = a[i + 1];
    if (a[i] === "--missing-itinerary") out.missingItinerary = true;
    if (a[i] === "--all-itinerary") out.allItinerary = true;
    if (a[i] === "--top" && a[i + 1]) out.topN = parseInt(a[i + 1]);
    if (a[i] === "--force") out.force = true;
    if (a[i] === "--dry-run") out.dryRun = true;
  }
  return out;
}

async function apiSearch(q) {
  const r = await rateLimitedFetch(`${API_BASE}/search?search_query=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error(`Search ${r.status}`);
  return (await r.json()).courses ?? [];
}

async function apiGetCourse(id) {
  const r = await rateLimitedFetch(`${API_BASE}/courses/${id}`);
  if (!r.ok) throw new Error(`Get ${r.status}`);
  return (await r.json()).course;
}

// Token-overlap score (0–1) between two strings — case + punctuation insensitive
function nameScore(a, b) {
  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w && w.length > 1);
  const ta = new Set(norm(a));
  const tb = new Set(norm(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hits = 0;
  for (const t of ta) if (tb.has(t)) hits++;
  return hits / Math.max(ta.size, tb.size);
}

// Search query strips boilerplate "golf course / club / resort" suffix —
// improves recall against API's club_name conventions.
function buildSearchQuery(course) {
  return course.name.replace(/\s*-\s*.+$/, "")          // drop "Pinehurst Cc - No. 8" style
                    .replace(/\bgolf\b/i, "")
                    .replace(/\bclub\b/i, "")
                    .replace(/\bcourse\b/i, "")
                    .replace(/\bresort\b/i, "")
                    .replace(/\s+/g, " ")
                    .trim();
}

// Pulls the layout name from our course (the part after a dash if present)
function layoutHint(course) {
  const m = course.name.match(/[-—]\s*(.+)$/);
  return m ? m[1].trim() : null;
}

// Score a single hit relative to our course
function scoreHit(hit, course) {
  let score = 0;
  if (hit.location?.state === course.state) score += 30;
  else if (hit.location?.state) return -1; // wrong state — disqualify

  const hitCity = (hit.location?.city || "").toLowerCase();
  const ourCity = (course.city || "").toLowerCase();
  if (hitCity && ourCity && (hitCity === ourCity || hitCity.includes(ourCity) || ourCity.includes(hitCity))) score += 15;

  const clubMatch = nameScore(hit.club_name, course.name);
  score += clubMatch * 30;

  // If our name has a layout suffix (e.g. "Pinehurst No. 8"), require the
  // API course_name to mirror it.
  const layout = layoutHint(course);
  if (layout) {
    const courseMatch = nameScore(hit.course_name, layout);
    score += courseMatch * 25;
    if (courseMatch === 0 && hit.course_name && hit.course_name !== hit.club_name) score -= 10;
  } else {
    // No layout in our name; prefer the parent / first listing
    if (!hit.course_name || hit.course_name === hit.club_name) score += 5;
  }
  return score;
}

function pickLongestTee(course, expectedHoles) {
  const all = [...(course.tees?.male ?? []), ...(course.tees?.female ?? [])];
  if (all.length === 0) return null;
  // Prefer male tees with matching hole count; fall back to female
  const maleMatch = (course.tees?.male ?? []).filter((t) => (t.holes?.length ?? t.number_of_holes) === expectedHoles);
  const pool = maleMatch.length > 0 ? maleMatch : all.filter((t) => (t.holes?.length ?? t.number_of_holes) === expectedHoles);
  if (pool.length === 0) return null;
  // Prefer named "Black/Tournament/Tips/Championship" first
  const named = pool.find((t) => /black|tip|champ|tournament/i.test(t.tee_name || ""));
  if (named) return named;
  // Otherwise pick the longest
  return pool.sort((a, b) => (b.total_yards || 0) - (a.total_yards || 0))[0];
}

async function findApiMatch(course) {
  const q = buildSearchQuery(course);
  if (!q) return null;
  let hits;
  try { hits = await apiSearch(q); } catch (e) { console.log(`    ⚠ search err: ${e.message}`); return null; }
  if (hits.length === 0) return null;

  const scored = hits
    .map((h) => ({ hit: h, score: scoreHit(h, course) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  return scored[0];
}

async function applyScorecard(courseId, holes /* from API */, force) {
  const { data: existing } = await sb.from("Hole").select("id, holeNumber, par, yardage, handicapRank").eq("courseId", courseId);
  const byNum = Object.fromEntries((existing ?? []).map((h) => [h.holeNumber, h]));
  let updated = 0;
  for (let i = 0; i < holes.length; i++) {
    const num = i + 1;
    const dbHole = byNum[num];
    if (!dbHole) continue;
    const apiH = holes[i];
    const updates = {};
    if (apiH.par != null && (force || dbHole.par == null || dbHole.par === 4)) updates.par = apiH.par;
    if (apiH.yardage != null && (force || dbHole.yardage == null)) updates.yardage = apiH.yardage;
    if (apiH.handicap != null && (force || dbHole.handicapRank == null)) updates.handicapRank = apiH.handicap;
    if (Object.keys(updates).length === 0) continue;
    updates.updatedAt = new Date().toISOString();
    const { error } = await sb.from("Hole").update(updates).eq("id", dbHole.id);
    if (!error) updated++;
  }
  return updated;
}

async function main() {
  const args = parseArgs();
  let ids = [...args.ids];
  if (args.idsFile) {
    const fromFile = readFileSync(args.idsFile, "utf8").split(/\s+/).filter(Boolean);
    ids.push(...fromFile);
  }
  if (args.missingItinerary || args.allItinerary) {
    const { data: stops } = await sb.from("TripItineraryStop").select("courseId");
    ids.push(...(stops ?? []).map((s) => s.courseId));
  }
  if (args.topN > 0) {
    // Engagement-weighted top N. Real usage > arbitrary alphabetical.
    // uploadCount × 3 (real intel posted), saveCount × 2 (planning), viewCount × 1.
    // Filter to 9/18-hole courses only — 27h+ resorts can't match the API.
    console.log(`Loading top ${args.topN} courses by engagement…`);
    const { data: top } = await sb
      .from("Course")
      .select("id, uploadCount, saveCount, viewCount, holeCount")
      .in("holeCount", [9, 18])
      .order("uploadCount", { ascending: false })
      .order("saveCount", { ascending: false })
      .order("viewCount", { ascending: false })
      .limit(args.topN);
    ids.push(...(top ?? []).map((c) => c.id));
  }
  ids = [...new Set(ids)];
  if (ids.length === 0) { console.log("Pass --ids, --ids-file, --missing-itinerary, or --top N"); process.exit(0); }

  // Chunk the .in() query — 500 UUIDs blow past the PostgREST URL length cap
  const courses = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await sb.from("Course").select("id, name, city, state, holeCount").in("id", chunk);
    if (error) { console.error(`Course query chunk error: ${error.message}`); process.exit(1); }
    courses.push(...(data ?? []));
  }
  if (!courses.length) { console.log("No courses found"); process.exit(0); }

  console.log(`\n🏌️  GolfCourseAPI scorecard sweep — ${courses.length} courses\n`);

  const results = { matched: 0, updated: 0, totalHoles: 0, missing: [], lowYardageBefore: 0 };

  for (const c of courses) {
    process.stdout.write(`  ${c.name.padEnd(50)} → `);

    // Skip 27h+ resorts — API doesn't model those
    if (c.holeCount !== 9 && c.holeCount !== 18) {
      console.log(`skip (${c.holeCount}h, not 9/18)`);
      continue;
    }

    // Skip if already fully populated, unless force.
    // --force or --all-itinerary mean "replace existing values with API data" —
    // worth it because the API yardages are published / authoritative vs
    // the Anthropic-estimated values we filled earlier.
    const forceOverwrite = args.allItinerary || args.force;
    if (!forceOverwrite) {
      const { data: holes } = await sb.from("Hole").select("yardage").eq("courseId", c.id);
      const filled = (holes ?? []).filter((h) => h.yardage != null).length;
      if (filled === c.holeCount) {
        console.log(`skip (already 100%)`);
        continue;
      }
    }

    let match;
    try { match = await findApiMatch(c); }
    catch (e) { console.log(`error: ${e.message}`); continue; }

    if (!match) {
      console.log(`no API match`);
      results.missing.push({ id: c.id, name: c.name });
      continue;
    }

    let full;
    try { full = await apiGetCourse(match.hit.id); }
    catch (e) { console.log(`fetch err: ${e.message}`); continue; }

    const tee = pickLongestTee(full, c.holeCount);
    if (!tee || !tee.holes?.length) {
      console.log(`no tee with ${c.holeCount} holes`);
      results.missing.push({ id: c.id, name: c.name });
      continue;
    }

    if (args.dryRun) {
      console.log(`would match: ${match.hit.club_name} | ${match.hit.course_name} | tee=${tee.tee_name} (${tee.total_yards}y)`);
      continue;
    }

    const updated = await applyScorecard(c.id, tee.holes, true);
    results.matched++;
    results.updated += updated;
    results.totalHoles += tee.holes.length;
    console.log(`✅ ${match.hit.club_name}/${match.hit.course_name} · tee=${tee.tee_name} (${tee.total_yards}y) · ${updated}/${tee.holes.length} holes set`);
  }

  console.log("\n=== Summary ===");
  console.log(`Matched: ${results.matched} courses (${results.updated}/${results.totalHoles} hole rows updated)`);
  console.log(`No API match: ${results.missing.length}`);
  if (results.missing.length > 0) {
    console.log("\nNo match — these need another path (Vision OCR / community contribute):");
    results.missing.forEach((m) => console.log(`  - ${m.name}`));
  }
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
