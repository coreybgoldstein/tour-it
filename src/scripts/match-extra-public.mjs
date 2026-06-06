#!/usr/bin/env node

/**
 * Tour It — Build & match the 101+ extension of the national public ranking.
 *
 * The Golf Digest "Best Public/Resort You Can Play" Top 100 (already tagged via
 * top100-matched.json) doesn't extend past 100, so this merges TWO other
 * verified public-access Top 100s — Golfweek's Best 2025 and GOLF Magazine's
 * 2024-25 "Top 100 Courses You Can Play" — and keeps the genuine top publics
 * that aren't already in our set, ranked 101+ by consensus standing.
 *
 * Merge ordering: a course on BOTH lists (consensus) outranks a course on one;
 * within a tier, lower average rank wins.
 *
 * Pipeline (READ-ONLY — writes only JSON for inspection, no DB mutations):
 *   1. Union the two lists (keyed by normalized name).
 *   2. Fuzzy-match each to a Course row (same strategy as match-top100-public).
 *   3. Drop anything whose matched courseId is already in top100-matched.json
 *      (dedupe by id — robust against name drift) or that isn't in the DB.
 *   4. Assign sequential nationalRank from 101 in merge order.
 *   5. Write top101-200-matched.json + print a report.
 *
 * Run: node src/scripts/match-extra-public.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Source lists ────────────────────────────────────────────────────────────
// [name, city|null, stateCode, rank]
const GOLFWEEK = [
  ["Pebble Beach Golf Links", "Pebble Beach", "CA", 1],
  ["Pacific Dunes", "Bandon", "OR", 2],
  ["Pinehurst No. 2", "Pinehurst", "NC", 3],
  ["Whistling Straits (Straits)", "Mosel", "WI", 4],
  ["Bandon Trails", "Bandon", "OR", 5],
  ["Old Macdonald", "Bandon", "OR", 6],
  ["Bandon Dunes", "Bandon", "OR", 7],
  ["Bethpage Black", "Farmingdale", "NY", 8],
  ["Shadow Creek", "North Las Vegas", "NV", 9],
  ["Kiawah Island (Ocean)", "Kiawah Island", "SC", 10],
  ["Pasatiempo", "Santa Cruz", "CA", 11],
  ["Sand Valley (Lido)", "Nekoosa", "WI", 12],
  ["Spyglass Hill", "Pebble Beach", "CA", 13],
  ["TPC Sawgrass (Players Stadium)", "Ponte Vedra Beach", "FL", 14],
  ["Sheep Ranch", "Bandon", "OR", 15],
  ["Manele", "Lanai", "HI", 16],
  ["Chambers Bay", "University Place", "WA", 17],
  ["Landmand", "Homer", "NE", 18],
  ["Streamsong (Red)", "Bowling Green", "FL", 19],
  ["Sand Valley", "Nekoosa", "WI", 20],
  ["Mammoth Dunes", "Nekoosa", "WI", 20],
  ["Kapalua (Plantation)", "Maui", "HI", 22],
  ["Pinehurst No. 10", "Pinehurst", "NC", 23],
  ["Gamble Sands", "Brewster", "WA", 24],
  ["Sedge Valley", "Nekoosa", "WI", 25],
  ["Streamsong (Blue)", "Bowling Green", "FL", 26],
  ["Erin Hills", "Erin", "WI", 27],
  ["Lawsonia (Links)", "Green Lake", "WI", 28],
  ["Harbour Town Golf Links", "Hilton Head Island", "SC", 29],
  ["Sea Island (Seaside)", "St. Simons Island", "GA", 30],
  ["Streamsong (Black)", "Bowling Green", "FL", 31],
  ["Arcadia Bluffs (Bluffs)", "Arcadia", "MI", 32],
  ["Karsten Creek", "Stillwater", "OK", 33],
  ["Black Desert", "Ivins", "UT", 34],
  ["Pinehurst No. 4", "Pinehurst", "NC", 35],
  ["Fallen Oak", "Saucier", "MS", 35],
  ["Omni Homestead (Cascades)", "Hot Springs", "VA", 37],
  ["Sweetens Cove", "South Pittsburg", "TN", 38],
  ["The Park West Palm", "West Palm Beach", "FL", 38],
  ["Primland (Highland)", "Meadows of Dan", "VA", 40],
  ["Princeville (Makai)", "Princeville", "HI", 41],
  ["Prairie Club (Dunes)", "Valentine", "NE", 42],
  ["Wild Horse", "Gothenburg", "NE", 43],
  ["Torrey Pines (South)", "San Diego", "CA", 44],
  ["Mystic Creek", "El Dorado", "AR", 44],
  ["Greywalls (Marquette)", "Marquette", "MI", 46],
  ["Mossy Oak", "West Point", "MS", 47],
  ["Giants Ridge (Quarry)", "Biwabik", "MN", 47],
  ["Lajitas (Black Jack's Crossing)", "Lajitas", "TX", 49],
  ["Forest Dunes (The Loop)", "Roscommon", "MI", 50],
  ["Paa-Ko Ridge", "Sandia Park", "NM", 51],
  ["Blackwolf Run (River)", "Kohler", "WI", 52],
  ["Rustic Canyon", "Moorpark", "CA", 52],
  ["Yocha Dehe (Cache Creek)", "Brooks", "CA", 52],
  ["Wine Valley", "Walla Walla", "WA", 55],
  ["Mid Pines", "Southern Pines", "NC", 56],
  ["Cabot Citrus Farms (Karoo)", "Brooksville", "FL", 57],
  ["Ozarks National", "Hollister", "MO", 58],
  ["Sand Hollow (Championship)", "Hurricane", "UT", 58],
  ["French Lick (Pete Dye)", "French Lick", "IN", 60],
  ["Mauna Kea", "Kohala Coast", "HI", 61],
  ["Pine Needles", "Southern Pines", "NC", 62],
  ["The Greenbrier (Old White)", "White Sulphur Springs", "WV", 63],
  ["Silvies Valley Ranch (Hankins)", "Seneca", "OR", 64],
  ["Links at Spanish Bay", "Pebble Beach", "CA", 65],
  ["The Dunes Golf & Beach Club", "Myrtle Beach", "SC", 65],
  ["Firestone (South)", "Akron", "OH", 67],
  ["Fields Ranch East", "Frisco", "TX", 67],
  ["Buffalo Ridge", "Hollister", "MO", 69],
  ["Caledonia Golf & Fish Club", "Pawleys Island", "SC", 70],
  ["Golden Horseshoe (Gold)", "Williamsburg", "VA", 70],
  ["Keswick (Full Cry)", "Keswick", "VA", 72],
  ["Links of North Dakota", "Ray", "ND", 72],
  ["Minot Country Club", "Minot", "ND", 72],
  ["Tobacco Road", "Sanford", "NC", 75],
  ["Cascata", "Boulder City", "NV", 76],
  ["Crosswater", "Sunriver", "OR", 77],
  ["Forest Dunes (Weiskopf)", "Roscommon", "MI", 78],
  ["Rams Hill", "Borrego Springs", "CA", 78],
  ["CordeValle", "San Martin", "CA", 78],
  ["Bay Hill", "Orlando", "FL", 81],
  ["Prairie Club (Pines)", "Valentine", "NE", 81],
  ["Pumpkin Ridge (Ghost Creek)", "North Plains", "OR", 81],
  ["Arcadia Bluffs (South)", "Arcadia", "MI", 84],
  ["Hawktree", "Bismarck", "ND", 84],
  ["Four Seasons Hualalai", "Kailua-Kona", "HI", 84],
  ["Whistling Straits (Irish)", "Mosel", "WI", 87],
  ["Old Waverly", "West Point", "MS", 87],
  ["Silvies Valley Ranch (Craddock)", "Seneca", "OR", 87],
  ["Leatherstocking", "Cooperstown", "NY", 87],
  ["Hideout", "Monticello", "UT", 87],
  ["We-Ko-Pa (Saguaro)", "Fort McDowell", "AZ", 92],
  ["Payne's Valley", "Hollister", "MO", 92],
  ["Reynolds Lake Oconee (Great Waters)", "Greensboro", "GA", 92],
  ["Deacon's Lodge", "Brainerd", "MN", 92],
  ["Omni Bedford Springs (Old)", "Bedford", "PA", 96],
  ["Cog Hill (Dubsdread)", "Lemont", "IL", 96],
  ["Cape Cod National", "Brewster", "MA", 96],
  ["Omni Barton Creek (Fazio Canyons)", "Austin", "TX", 99],
  ["Belvedere", "Charlevoix", "MI", 99],
  ["The Broadmoor (East)", "Colorado Springs", "CO", 99],
  ["Madden's (Classic)", "Brainerd", "MN", 99],
];

const GOLFMAG = [
  ["Pebble Beach", null, "CA", 1],
  ["Pinehurst No. 2", null, "NC", 2],
  ["Pacific Dunes", null, "OR", 3],
  ["The Lido", null, "WI", 4],
  ["Bethpage Black", null, "NY", 5],
  ["Kiawah Island (Ocean)", null, "SC", 6],
  ["Bandon Trails", null, "OR", 7],
  ["TPC Sawgrass (Players Stadium)", null, "FL", 8],
  ["Bandon Dunes", null, "OR", 9],
  ["Whistling Straits", null, "WI", 10],
  ["Pasatiempo", null, "CA", 11],
  ["Harbour Town Golf Links", null, "SC", 12],
  ["Old Macdonald", null, "OR", 13],
  ["Shadow Creek", null, "NV", 14],
  ["Pinehurst No. 10", null, "NC", 15],
  ["Lawsonia (Links)", null, "WI", 16],
  ["Streamsong (Red)", null, "FL", 17],
  ["Gamble Sands", null, "WA", 18],
  ["Streamsong (Blue)", null, "FL", 19],
  ["Sand Valley", null, "WI", 20],
  ["Erin Hills", null, "WI", 21],
  ["Sedge Valley", null, "WI", 22],
  ["Spyglass Hill", null, "CA", 23],
  ["Sheep Ranch", null, "OR", 24],
  ["Pinehurst No. 4", null, "NC", 25],
  ["Mammoth Dunes", null, "WI", 26],
  ["Tobacco Road", null, "NC", 27],
  ["Prairie Club (Dunes)", null, "NE", 28],
  ["Blackwolf Run (River)", null, "WI", 29],
  ["Forest Dunes (The Loop)", null, "MI", 30],
  ["Chambers Bay", null, "WA", 31],
  ["Cabot Citrus Farms (Karoo)", null, "FL", 32],
  ["Kapalua (Plantation)", null, "HI", 33],
  ["Mid Pines", null, "NC", 34],
  ["Omni Homestead (Cascades)", null, "VA", 35],
  ["The Park West Palm", null, "FL", 36],
  ["Streamsong (Black)", null, "FL", 37],
  ["Southern Pines", null, "NC", 38],
  ["Pine Needles", null, "NC", 39],
  ["Belvedere", null, "MI", 40],
  ["Sea Island (Seaside)", null, "GA", 41],
  ["French Lick (Ross)", null, "IN", 42],
  ["Torrey Pines (South)", null, "CA", 43],
  ["Wild Horse", null, "NE", 44],
  ["Rustic Canyon", null, "CA", 45],
  ["Landmand", null, "NE", 46],
  ["Manele", null, "HI", 47],
  ["Tot Hill Farm", null, "NC", 48],
  ["Mauna Kea", null, "HI", 49],
  ["Arcadia Bluffs (South)", null, "MI", 50],
  ["American Dunes", null, "MI", 51],
  ["The Greenbrier (Old White)", null, "WV", 52],
  ["Firestone (South)", null, "OH", 53],
  ["Sand Hollow", null, "UT", 54],
  ["Ozarks National", null, "MO", 55],
  ["PGA West (Pete Dye Stadium)", null, "CA", 56],
  ["Arcadia Bluffs (Bluffs)", null, "MI", 57],
  ["Palmetto Bluff (May River)", null, "SC", 58],
  ["Silvies Valley Ranch", null, "OR", 59],
  ["The Dunes Golf & Beach Club", null, "SC", 60],
  ["We-Ko-Pa (Saguaro)", null, "AZ", 61],
  ["Greywalls (Marquette)", null, "MI", 62],
  ["Cape Arundel", null, "ME", 63],
  ["Forest Dunes (Weiskopf)", null, "MI", 64],
  ["Bethpage Red", null, "NY", 65],
  ["TPC Harding Park", null, "CA", 66],
  ["Fields Ranch East", null, "TX", 67],
  ["Wilderness Club", null, "MT", 68],
  ["Innisbrook (Copperhead)", null, "FL", 69],
  ["George Wright", null, "MA", 70],
  ["Bay Hill", null, "FL", 71],
  ["Pronghorn (Fazio)", null, "OR", 72],
  ["Taconic", null, "MA", 73],
  ["Karsten Creek", null, "OK", 74],
  ["Mossy Oak", null, "MS", 75],
  ["Caledonia Golf & Fish Club", null, "SC", 76],
  ["Trump National Doral (Blue Monster)", null, "FL", 77],
  ["PGA West (Mountain)", null, "CA", 78],
  ["Black Mesa", null, "NM", 79],
  ["Payne's Valley", null, "MO", 80],
  ["SentryWorld", null, "WI", 81],
  ["Pinehurst No. 8", null, "NC", 82],
  ["CordeValle", null, "CA", 83],
  ["French Lick (Dye)", null, "IN", 84],
  ["Warren Course (Notre Dame)", null, "IN", 85],
  ["Cascata", null, "NV", 86],
  ["Primland (Highland)", null, "VA", 87],
  ["Memorial Park", null, "TX", 88],
  ["Omni La Costa (North)", null, "CA", 89],
  ["Pfau Course (Indiana University)", null, "IN", 90],
  ["Paa-Ko Ridge", null, "NM", 91],
  ["Stoatin Brae", null, "MI", 92],
  ["Rams Hill", null, "CA", 93],
  ["Keswick (Full Cry)", null, "VA", 94],
  ["Pronghorn (Nicklaus)", null, "OR", 95],
  ["Reynolds Lake Oconee (Great Waters)", null, "GA", 96],
  ["The Broadmoor (East)", null, "CO", 97],
  ["RTJ Grand National (Links)", null, "AL", 98],
  ["McLemore (Highlands)", null, "GA", 99],
  ["Wine Valley", null, "WA", 100],
];

// ── Name utilities (ported from match-top100-public.mjs) ────────────────────
function normalizeName(s) {
  return (s || "").toLowerCase().replace(/[.,'"]/g, "").replace(/\s+/g, " ").trim();
}
function tokenize(s) {
  const STOP = new Set(["the", "of", "at", "&", "and", "a", "an", "in", "on", "club", "golf", "course", "resort"]);
  return new Set(normalizeName(s).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)));
}
function tokenizeWithCommon(s) {
  return new Set(normalizeName(s).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 1));
}
function overlapScore(a, b) {
  const ta = tokenizeWithCommon(a), tb = tokenizeWithCommon(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let hits = 0; for (const t of ta) if (tb.has(t)) hits++;
  return hits / Math.max(ta.size, tb.size);
}
function strongOverlap(a, b) {
  const ta = tokenize(a), tb = tokenize(b);
  let hits = 0; for (const t of ta) if (tb.has(t)) hits++;
  return hits;
}
function parenVariants(name) {
  const variants = [...name.matchAll(/\(([^)]+)\)/g)].map((m) => m[1].trim());
  const base = name.replace(/\([^)]+\)/g, "").replace(/\s+/g, " ").trim();
  return { base, variants };
}
async function queryByIlike(needle, stateCode) {
  let q = supabase.from("Course").select("id, name, city, state, isPublic").ilike("name", `%${needle}%`);
  if (stateCode) q = q.eq("state", stateCode);
  const { data, error } = await q.limit(50);
  if (error) { console.error(`Query error "${needle}": ${error.message}`); return []; }
  return data || [];
}
async function findMatch(entry) {
  const { name, stateCode, city } = entry;
  const { base, variants } = parenVariants(name);
  const tried = new Set();
  const candidates = [];
  for (const c of await queryByIlike(base, stateCode)) candidates.push(c);
  for (const v of variants) {
    for (const t of [`${base} ${v}`, `${base} - ${v}`, `${base} ${v} course`, `${v}`]) {
      if (tried.has(t)) continue; tried.add(t);
      for (const c of await queryByIlike(t, stateCode)) candidates.push(c);
    }
  }
  for (const w of [...tokenize(base)].filter((w) => w.length >= 4).slice(0, 2)) {
    if (tried.has(w)) continue; tried.add(w);
    for (const c of await queryByIlike(w, stateCode)) candidates.push(c);
  }
  const byId = new Map();
  for (const c of candidates) byId.set(c.id, c);
  const pool = [...byId.values()];
  if (pool.length === 0) return { match: null, alternates: [] };
  const scored = pool.map((c) => {
    const compositeOverlap = overlapScore(name, c.name);
    const strong = strongOverlap(name, c.name);
    const cityMatch = city && c.city && normalizeName(c.city).includes(normalizeName(city)) ? 0.2 : 0;
    let variantBoost = 0;
    for (const v of variants) if (normalizeName(c.name).includes(normalizeName(v))) variantBoost += 0.3;
    const statePenalty = stateCode && c.state && c.state !== stateCode ? -0.5 : 0;
    const score = compositeOverlap + cityMatch + variantBoost + statePenalty + (strong >= 3 ? 0.1 : 0);
    return { c, score, strong, compositeOverlap };
  }).filter((s) => s.strong >= 1 || s.compositeOverlap >= 0.3).sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { match: null, alternates: [] };
  const top = scored[0];
  if (top.strong < 1 && top.compositeOverlap < 0.4) return { match: null, alternates: scored.slice(0, 5).map((s) => s.c) };
  return {
    match: { ...top.c, confidence: Number(top.score.toFixed(3)) },
    alternates: scored.slice(1, 4).map((s) => ({ ...s.c, confidence: Number(s.score.toFixed(3)) })),
  };
}

// ── Merge the two lists ─────────────────────────────────────────────────────
function mergeKey(name) {
  // Drop parens so "Whistling Straits (Straits)" and "Whistling Straits" collapse.
  const { base, variants } = parenVariants(name);
  return normalizeName(base + " " + variants.join(" "));
}

function buildUnion() {
  const map = new Map();
  const add = (list, key) => {
    for (const [name, city, state, rank] of list) {
      const k = mergeKey(name);
      const cur = map.get(k) || { name, city: null, state, gw: null, gm: null };
      // Prefer the variant-richer name and any known city.
      if (name.length > cur.name.length) cur.name = name;
      if (city && !cur.city) cur.city = city;
      cur[key] = cur[key] === null ? rank : Math.min(cur[key], rank);
      map.set(k, cur);
    }
  };
  add(GOLFWEEK, "gw");
  add(GOLFMAG, "gm");
  return [...map.values()];
}

function mergeScore(e) {
  // Consensus (on both lists) sorts ahead of single-list; then average rank.
  const onBoth = e.gw !== null && e.gm !== null;
  const ranks = [e.gw, e.gm].filter((r) => r !== null);
  const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
  return (onBoth ? 0 : 1000) + avg;
}

// Fuzzy matches that grabbed the WRONG course (verified by DB probe). The real
// course is either already tagged in the top100 set, or genuinely not in the DB
// — so per the "skip if no DB match" rule we reject these rather than fake them.
const REJECT_MATCHED = [
  "Dye's Valley",      // Players Stadium already tagged; Dye's Valley is a separate lesser course
  "GLC Links",         // Lawsonia already tagged under its own row
  "Choctaw",           // Karsten Creek not in DB
  "Thunderbird",       // Firestone already tagged
  "Donald Ross Golf",  // French Lick Ross course not in DB
  "The Ridge",         // Buffalo Ridge already tagged
  "Pronghorn",         // only the closed/private Nicklaus row exists
  "Chalk Mountain",    // PGA West Mountain not in DB as a public row
  "Stonewall",         // Omni Bedford Springs not in DB
];
function isRejected(matchedName) {
  return REJECT_MATCHED.some((r) => (matchedName || "").includes(r));
}

async function main() {
  const existing = JSON.parse(readFileSync(path.join(REPO_ROOT, "top100-matched.json"), "utf8"));
  const existingIds = new Set(existing.map((m) => m.courseId).filter(Boolean));

  const union = buildUnion().sort((a, b) => mergeScore(a) - mergeScore(b));
  console.error(`Union of Golfweek + GOLF Mag (deduped by name): ${union.length}\n`);

  const matched = [];
  const dropped = []; // already in top100 set
  const unmatched = [];
  const seenNewIds = new Set();

  for (const e of union) {
    const res = await findMatch({ name: e.name, stateCode: e.state, city: e.city });
    if (!res.match) {
      unmatched.push({ name: e.name, state: e.state, gw: e.gw, gm: e.gm, alternates: (res.alternates || []).map((a) => a.name) });
      continue;
    }
    const id = res.match.id;
    if (isRejected(res.match.name)) { dropped.push({ name: e.name, matchedName: res.match.name, reason: "rejected-bad-match" }); continue; }
    if (existingIds.has(id)) { dropped.push({ name: e.name, matchedName: res.match.name }); continue; }
    if (seenNewIds.has(id)) { dropped.push({ name: e.name, matchedName: res.match.name, reason: "dup-within-new" }); continue; }
    seenNewIds.add(id);
    matched.push({
      name: e.name, city: e.city, state: e.state,
      gwRank: e.gw, gmRank: e.gm, mergeScore: Number(mergeScore(e).toFixed(1)),
      courseId: id, matchedName: res.match.name, matchedCity: res.match.city, matchedState: res.match.state,
      isPublic: res.match.isPublic, confidence: res.match.confidence,
      alternates: (res.alternates || []).map((a) => ({ id: a.id, name: a.name })),
    });
  }

  // Assign sequential national ranks from 101.
  matched.forEach((m, i) => { m.rank = 101 + i; });

  writeFileSync(path.join(REPO_ROOT, "top101-200-matched.json"), JSON.stringify(matched, null, 2));
  writeFileSync(path.join(REPO_ROOT, "top101-200-unmatched.json"), JSON.stringify(unmatched, null, 2));

  console.error(`=== NEW (rank 101+) — matched & not already tagged: ${matched.length} ===`);
  for (const m of matched) {
    const flag = m.isPublic === false ? " \x1b[31m[PRIVATE?]\x1b[0m" : "";
    console.error(`  #${m.rank} ${m.name.padEnd(38)} -> ${m.matchedName} [${m.matchedCity}, ${m.matchedState}] (${m.confidence})${flag}`);
  }
  console.error(`\nDropped (already in top100 set or dup): ${dropped.length}`);
  console.error(`Unmatched (not in DB): ${unmatched.length}`);
  for (const u of unmatched) console.error(`  - ${u.name} (${u.state})${u.alternates.length ? "  alts: " + u.alternates.join("; ") : ""}`);
  console.error(`\nWrote top101-200-matched.json (${matched.length}) + top101-200-unmatched.json (${unmatched.length}).`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
