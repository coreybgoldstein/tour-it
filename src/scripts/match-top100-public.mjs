#!/usr/bin/env node

/**
 * Tour It — Match Golf Digest's Top 100 Public Courses to DB
 *
 * Reads top100-public-courses.txt at the repo root, lines formatted as:
 *   "1. Course Name — City, State"
 *
 * For each, attempts multiple fuzzy match strategies against the Course table:
 *   1. Exact (lower-cased trimmed) name + state
 *   2. Name without parenthesized variant + state
 *   3. Parenthesized variant glued to the name with "-", " ", or " - " + state
 *   4. Token-overlap fallback (3+ words match, ranked by overlap)
 *
 * Picks the row with the highest overlap when multiples match. Records alternates.
 *
 * Outputs at repo root:
 *   top100-matched.json
 *   top100-unmatched.json
 *   top100-ids.txt  (one courseId per line — used by downstream scripts)
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── State map ─────────────────────────────────────────────────────────────────
const STATE_NAME_TO_CODE = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI",
  Wyoming: "WY",
};

// ── Manual overrides ──────────────────────────────────────────────────────────
// After auto-matching, these rank → courseId overrides force the correct row.
// Discovered by direct DB inspection (see inspect-top100-misses*.mjs scripts).
// "null" means: the course is NOT in the DB → leave unmatched, do not fake it.
const OVERRIDES = {
  1: "b2d7acf5-7186-4edd-bcee-8def174a0d01",     // Pebble Beach Golf Course
  2: "32c84c00-04e7-4303-af18-aafab244b837",     // Pacific Dunes
  4: "d8298463-166c-417f-9862-5771eecfd93e",     // Whistling Straits (Haven)
  6: "c50c2fa3-7360-4510-82d2-ad91894d1a1b",     // Pinehurst No. 2
  7: "ceb95a05-d039-4f2d-ae01-6bdd954d00c1",     // Bethpage Black
  8: "ecaad021-f44c-49f9-a340-df7a2b903d52",     // TPC Sawgrass (Stadium)
  9: "519a24de-0984-41d8-bf2c-e848220570a1",     // Bandon Dunes Golf Resort
  10: "a8f6f7de-421f-4693-94af-78f6efd27150",    // Erin Hills
  11: "d8f27d04-64cf-4c0b-a4b3-6e16837c2af2",    // Bandon Trails
  12: null,                                       // Lido at Sand Valley — not in DB
  14: "0101801a-6cf7-4625-b395-f429c861d301",    // Old Macdonald (Bandon)
  15: "d036dbe6-5584-4888-9f49-0ddf50a4fca3",    // Arcadia Bluffs Golf Club (Bluffs)
  18: "8e162b0e-4df0-4f3a-883a-50e7edf41834",    // Pete Dye Course (Orange County, IN — French Lick)
  21: "574fa1d5-59c2-4e56-a81e-05dda82ca573",    // Sand Valley Golf Resort
  22: "4385e725-1068-4dca-a6c7-4bb856d7f7cd",    // The Challenge at Manele (renamed from Manele Golf Course)
  25: "18e52307-1799-4883-b612-f07d09a3fd20",    // Mammoth Dunes
  27: "205da5c9-2a88-472f-ac39-414751f0bcf6",    // Bandon Sheep Ranch
  29: "1b7e173f-3c24-4e63-8508-f02dfa604811",    // Primland Golf Resort
  30: null,                                       // Pinehurst No. 10 — not in DB (opened 2024)
  31: "42aba40d-e9b7-4f04-a6ab-6caf5ffca516",    // Gamble Sands Golf Course
  32: "61a4668d-7ec4-4ef0-882e-53ca3ec04d06",    // Pinehurst No. 4
  34: "0e1af11a-86ea-4a27-a231-190916ba01b0",    // Fields Ranch East
  37: "6d5209fc-0c4c-451b-bb4a-4a0b81198c7b",    // Forest Dunes Golf Resort
  41: null,                                       // Pronghorn (Juniper Reserve) — not in DB (Nicklaus course closed/private)
  42: "9364bb6b-16b8-4d2c-bac6-8c96f88f96e4",    // The Cascades (Hot Springs)
  45: null,                                       // Sea Island Seaside — not in DB
  49: "d3937e3e-3764-49f3-a369-8150382bbf05",    // Sentry World Golf Center (=SentryWorld)
  50: null,                                       // Cabot Citrus Karoo — not in DB
  51: null,                                       // Sedge Valley — not in DB (opened 2024)
  58: "ba98b53e-224b-4901-9cf4-6c4d18a82e2b",    // The Quarry at Giants Ridge
  59: null,                                       // Wolf Creek Mesquite — not in DB
  60: "e6b71e32-c66e-4fae-a80d-e13a57bc62ac",    // Pine Needles
  62: "e2569f38-ac05-4f33-be3b-c9fb0a4d5fc4",    // TPC Stadium / PGA West Stadium
  63: "edaf7081-e825-4c34-8c8f-afd21849bf02",    // The Loop (Black)
  64: null,                                       // Nemacolin Mystic Rock — DB only has Country Club (different course)
  65: "57fd78ad-c8a9-4a83-9b67-210522988225",    // Whistling Straits Irish (Sheboygan row — disambiguates from Straits)
  66: "7bca915e-53e6-4a74-8ffd-758dac255665",    // Lawsonia Links
  67: "4458772d-ddf3-4f4e-bbee-65461f9e79b4",    // Wynn Golf Course
  68: "fecd7917-9052-4c94-acb8-432555337b4d",    // The Loop (Red)
  71: "b9d9b5b3-59e4-4ba3-ae30-552d271fffda",    // Red Sky Fazio
  73: "98bb7048-3d25-488d-8223-963d73bb50dd",    // Princeville Makai
  76: "7328fbce-0496-4881-8f74-38c071e69d82",    // Cog Hill Dubsdread
  77: "4fe6e532-78ae-41b4-b8ee-1bbb4846f26b",    // Fields Ranch West
  81: null,                                       // Payne's Valley — not in DB
  82: null,                                       // Mossy Oak — not in DB
  86: "4d7cd615-3a23-4081-84d2-501c40aae59c",    // Trump National Doral (Blue Monster is the TPC entry; the Trump-branded one is Doral)
  87: "524eb087-4fd5-4aea-a1fa-00131b127cf2",    // Red Sky Norman
  88: "5b669a70-85e8-416e-93a4-9ccfd819bbca",    // Mid Pines
  89: "314c4f27-aba0-44e4-bfcb-fb2dfbe5b523",    // The Park West Palm
  90: null,                                       // Prairie Club Pines — DB has only one Prairie Club row (matched at #36 for Dunes)
  92: "37bc91e6-3741-48dd-b7b9-aa2533578b9c",    // Blackwolf Run — DB has single row already matched at #17 (dup)
  94: "2f27785a-9603-40a1-9667-4a3eb1417d6a",    // Buffalo Ridge Springs
  95: "6b4cce70-2087-4c7b-a16f-b901e53644bd",    // TPC San Antonio Oaks
  97: "bc46c215-fda2-4afe-b7e4-78727e542bfc",    // Pfau Indiana
  98: "fdc31d26-c49c-49ae-b279-ce042eecdca5",    // Southern Pines Golf Club
  99: "4d77455e-1d1f-4bbc-8ffd-63d96330051e",    // Reynolds Great Waters
  100: "c4c10379-9b9b-40f5-9b02-d9f5eb3d2c71",   // Bay Harbor Links/Quarry — pick Links as canonical
};

// Some rank overrides reuse the same DB row as another rank — we don't want
// to seed the same course twice. These pairs are documented here so the
// downstream dedupe is auditable.
const KNOWN_DUPLICATES = {
  // 92 reuses 17 (Blackwolf Run) — only one Blackwolf row in DB
  92: 17,
};

// ── Line parser ───────────────────────────────────────────────────────────────
function parseLine(line) {
  // "1. Course Name — City, State"
  const m = line.match(/^(\d+)\.\s+(.+?)\s+[—-]\s+(.+)$/);
  if (!m) return null;
  const rank = parseInt(m[1], 10);
  const name = m[2].trim();
  const locPart = m[3].trim();
  // "Kapalua, Maui, HI" → city = "Kapalua", state code = HI (last token)
  const tokens = locPart.split(",").map((s) => s.trim()).filter(Boolean);
  let state = null;
  let stateCode = null;
  let city = null;
  if (tokens.length === 0) return null;
  // Last token is state (full name or 2-letter code)
  const lastTok = tokens[tokens.length - 1];
  if (lastTok.length === 2) {
    stateCode = lastTok.toUpperCase();
  } else {
    stateCode = STATE_NAME_TO_CODE[lastTok] || null;
  }
  state = lastTok;
  city = tokens[0];
  return { rank, name, city, state, stateCode };
}

// ── Name utilities ────────────────────────────────────────────────────────────
function normalizeName(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[.,'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s) {
  const STOP = new Set(["the", "of", "at", "&", "and", "a", "an", "in", "on", "club", "golf", "course", "resort"]);
  return new Set(
    normalizeName(s)
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w))
  );
}

function tokenizeWithCommon(s) {
  // Include "club/golf/course/resort" — useful for higher-fidelity scoring
  return new Set(
    normalizeName(s)
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1)
  );
}

function overlapScore(a, b) {
  const ta = tokenizeWithCommon(a);
  const tb = tokenizeWithCommon(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let hits = 0;
  for (const t of ta) if (tb.has(t)) hits++;
  return hits / Math.max(ta.size, tb.size);
}

function strongOverlap(a, b) {
  // Pure intersection count, ignoring common golf words
  const ta = tokenize(a);
  const tb = tokenize(b);
  let hits = 0;
  for (const t of ta) if (tb.has(t)) hits++;
  return hits;
}

function parenVariants(name) {
  // Returns { base, variants } — variants are the inner texts of any (...)
  const variants = [];
  const inner = [...name.matchAll(/\(([^)]+)\)/g)].map((m) => m[1].trim());
  variants.push(...inner);
  const base = name.replace(/\([^)]+\)/g, "").replace(/\s+/g, " ").trim();
  return { base, variants };
}

// ── Match search ──────────────────────────────────────────────────────────────
async function queryByIlike(needle, stateCode) {
  // PostgREST ILIKE on name, optional state filter
  let q = supabase.from("Course").select("id, name, city, state").ilike("name", `%${needle}%`);
  if (stateCode) q = q.eq("state", stateCode);
  const { data, error } = await q.limit(50);
  if (error) {
    console.error(`Query error for "${needle}": ${error.message}`);
    return [];
  }
  return data || [];
}

async function findMatch(entry) {
  const { name, stateCode, city } = entry;
  const { base, variants } = parenVariants(name);
  const tried = new Set();
  const candidates = [];

  // Strategy 1: exact lower-trimmed name match in state
  // (we do this via ilike then filter)
  const exactHits = await queryByIlike(base, stateCode);
  for (const c of exactHits) candidates.push(c);

  // Strategy 2: try each parenthesized variant glued to base
  for (const v of variants) {
    const tries = [
      `${base} ${v}`,
      `${base} - ${v}`,
      `${base} ${v} course`,
      `${v}`, // sometimes the DB only stores the variant name (e.g. "The Straits")
    ];
    for (const t of tries) {
      if (tried.has(t)) continue;
      tried.add(t);
      const hits = await queryByIlike(t, stateCode);
      for (const c of hits) candidates.push(c);
    }
  }

  // Strategy 3: token-anchor — grab the most distinctive 1-2 words and search
  const distinctiveWords = [...tokenize(base)].filter((w) => w.length >= 4).slice(0, 2);
  for (const w of distinctiveWords) {
    if (tried.has(w)) continue;
    tried.add(w);
    const hits = await queryByIlike(w, stateCode);
    for (const c of hits) candidates.push(c);
  }

  // Dedupe by id
  const byId = new Map();
  for (const c of candidates) byId.set(c.id, c);
  const pool = [...byId.values()];

  if (pool.length === 0) return { match: null, alternates: [] };

  // Score
  const scored = pool
    .map((c) => {
      const targetName = `${name}`; // includes parens
      const compositeOverlap = overlapScore(targetName, c.name);
      const strong = strongOverlap(targetName, c.name);
      // City matching boost (some sub-courses share names but different cities)
      const cityMatch =
        city && c.city && normalizeName(c.city).includes(normalizeName(city)) ? 0.2 : 0;
      // Variant match boost — if our name has "(X)" and the DB row contains X
      let variantBoost = 0;
      for (const v of variants) {
        if (normalizeName(c.name).includes(normalizeName(v))) variantBoost += 0.3;
      }
      // Penalty for state mismatch
      const statePenalty = stateCode && c.state && c.state !== stateCode ? -0.5 : 0;
      const score = compositeOverlap + cityMatch + variantBoost + statePenalty + (strong >= 3 ? 0.1 : 0);
      return { c, score, strong, compositeOverlap };
    })
    .filter((s) => s.strong >= 1 || s.compositeOverlap >= 0.3)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { match: null, alternates: [] };

  // Require at least one strong-word hit (otherwise we're guessing on common golf words)
  const top = scored[0];
  if (top.strong < 1 && top.compositeOverlap < 0.4) {
    return { match: null, alternates: scored.slice(0, 5).map((s) => s.c) };
  }

  return {
    match: { ...top.c, confidence: Number(top.score.toFixed(3)) },
    alternates: scored.slice(1, 5).map((s) => ({ ...s.c, confidence: Number(s.score.toFixed(3)) })),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const file = path.join(REPO_ROOT, "top100-public-courses.txt");
  const raw = readFileSync(file, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const entries = [];
  for (const l of lines) {
    const e = parseLine(l);
    if (!e) {
      console.error(`Could not parse: ${l}`);
      continue;
    }
    entries.push(e);
  }
  console.error(`Parsed ${entries.length} entries from top100 list.`);

  const matched = [];
  const unmatched = [];

  // Helper: pull single Course row by id
  async function fetchCourseById(id) {
    const { data } = await supabase.from("Course").select("id, name, city, state").eq("id", id).single();
    return data;
  }

  for (const e of entries) {
    process.stderr.write(`#${e.rank} ${e.name} (${e.state}) ... `);

    // 1. Honor explicit overrides first
    if (Object.prototype.hasOwnProperty.call(OVERRIDES, e.rank)) {
      const overrideId = OVERRIDES[e.rank];
      if (overrideId === null) {
        console.error("OVERRIDE → unmatched (course not in DB)");
        unmatched.push({ ...e, reason: "not in DB (override)" });
        continue;
      }
      const row = await fetchCourseById(overrideId);
      if (!row) {
        console.error(`OVERRIDE id ${overrideId} not found — falling back to auto`);
      } else {
        console.error(`OVERRIDE → ${row.name} [${row.city}, ${row.state}]`);
        matched.push({
          rank: e.rank,
          name: e.name,
          city: e.city,
          state: e.state,
          stateCode: e.stateCode,
          courseId: row.id,
          matchedName: row.name,
          matchedCity: row.city,
          matchedState: row.state,
          confidence: 1.0,
          source: "override",
          duplicateOf: KNOWN_DUPLICATES[e.rank] ?? null,
        });
        continue;
      }
    }

    let result;
    try {
      result = await findMatch(e);
    } catch (err) {
      console.error(`error: ${err.message}`);
      unmatched.push({ ...e, reason: err.message });
      continue;
    }
    if (!result.match) {
      console.error(`NO MATCH${result.alternates.length ? ` (alternates: ${result.alternates.map((a) => a.name).join("; ")})` : ""}`);
      unmatched.push({ ...e, reason: "no match", alternates: result.alternates });
      continue;
    }
    console.error(`✓ ${result.match.name} [${result.match.city}, ${result.match.state}] (${result.match.confidence})`);
    matched.push({
      rank: e.rank,
      name: e.name,
      city: e.city,
      state: e.state,
      stateCode: e.stateCode,
      courseId: result.match.id,
      matchedName: result.match.name,
      matchedCity: result.match.city,
      matchedState: result.match.state,
      confidence: result.match.confidence,
      source: "auto",
      alternates: result.alternates,
    });
  }

  writeFileSync(path.join(REPO_ROOT, "top100-matched.json"), JSON.stringify(matched, null, 2));
  writeFileSync(path.join(REPO_ROOT, "top100-unmatched.json"), JSON.stringify(unmatched, null, 2));
  // Dedupe IDs — some entries map to the same DB row (e.g. Blackwolf Run #17 + #92)
  const uniqIds = [...new Set(matched.map((m) => m.courseId))];
  writeFileSync(path.join(REPO_ROOT, "top100-ids.txt"), uniqIds.join("\n") + "\n");
  console.error(`Wrote ${uniqIds.length} unique courseIds to top100-ids.txt`);

  console.error("\n──── Summary ────");
  console.error(`Matched:   ${matched.length} / ${entries.length}`);
  console.error(`Unmatched: ${unmatched.length}`);
  if (unmatched.length) {
    console.error("\nUnmatched names:");
    unmatched.forEach((u) => console.error(`  #${u.rank} ${u.name} (${u.state})`));
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
