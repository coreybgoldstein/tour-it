// fill-courses-golfapi.mjs
// Fills hole par, handicap, and yardage for all courses using GolfCourseAPI.com
// Safe to kill and restart — progress saved to golfapi-progress.json
//
// Usage: node fill-courses-golfapi.mjs

import { existsSync, readFileSync, writeFileSync, createWriteStream } from 'fs';

const SUPABASE_URL = 'https://awlbxzpevwidowxxvuef.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bGJ4enBldndpZG93eHh2dWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxODQ5OSwiZXhwIjoyMDg4NTk0NDk5fQ.TU53et5QL6MwLmcv1wQNwDMLtjp62xaLSrElrCpGV0I';
const GOLF_API_KEY = '6IRZMMWMW2T7G5UM7POZTKGSXQ';
const GOLF_API_BASE = 'https://api.golfcourseapi.com/v1';
const PROGRESS_FILE = 'golfapi-progress.json';
const LOG_FILE = 'golfapi-log.txt';
const PAGE_SIZE = 500;
const DELAY_MS = 500; // 0.5s between requests = ~2/sec, well within 10k/day

// ── Logging ───────────────────────────────────────────────────────────────────

const logStream = createWriteStream(LOG_FILE, { flags: 'a' });
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logStream.write(line + '\n');
}

// ── Progress ──────────────────────────────────────────────────────────────────

function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return { done: [], stats: { matched: 0, holesUpdated: 0, notFound: 0, errors: 0 } };
  try { return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return { done: [], stats: { matched: 0, holesUpdated: 0, notFound: 0, errors: 0 } }; }
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Haversine distance in meters
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Supabase ──────────────────────────────────────────────────────────────────

async function supabaseFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase ${path}: ${res.status} ${t.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

async function fetchAllCourses() {
  const courses = [];
  let offset = 0;
  while (true) {
    const page = await supabaseFetch(
      `/Course?select=id,name,city,state,latitude,longitude&order=id.asc&limit=${PAGE_SIZE}&offset=${offset}`
    );
    if (!Array.isArray(page) || page.length === 0) break;
    courses.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return courses;
}

// ── GolfCourseAPI ─────────────────────────────────────────────────────────────

async function searchCourse(name) {
  // Strip common suffixes that hurt search accuracy
  const cleaned = name
    .replace(/\b(golf course|golf club|country club|golf & country club|g\.?c\.?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const res = await fetch(`${GOLF_API_BASE}/search?search_query=${encodeURIComponent(cleaned)}`, {
    headers: { Authorization: `Key ${GOLF_API_KEY}` },
  });

  if (res.status === 429) {
    log('  Rate limited by GolfCourseAPI, waiting 60s...');
    await sleep(60000);
    return searchCourse(name); // retry
  }
  if (!res.ok) throw new Error(`GolfCourseAPI search: ${res.status}`);
  const data = await res.json();
  return data.courses || [];
}

// Pick best matching tee set: prefer male, pick the one with most complete holes
function getBestTee(tees) {
  const sets = [...(tees?.male || []), ...(tees?.female || [])];
  if (sets.length === 0) return null;
  // Sort by number of holes descending, then pick first male if tied
  const male = tees?.male || [];
  const female = tees?.female || [];
  const sorted = [...male, ...female].sort((a, b) => (b.holes?.length || 0) - (a.holes?.length || 0));
  return sorted[0] || null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log('=== fill-courses-golfapi starting ===');

  const progress = loadProgress();
  const doneSet = new Set(progress.done);
  log(`Progress: ${doneSet.size} courses already done`);

  log('Fetching all courses from DB...');
  const courses = await fetchAllCourses();
  log(`Total courses: ${courses.length}`);

  const remaining = courses.filter(c => !doneSet.has(c.id) && c.latitude && c.longitude);
  const noCoords = courses.filter(c => !doneSet.has(c.id) && (!c.latitude || !c.longitude)).length;
  log(`To process: ${remaining.length} | No coords (skip): ${noCoords} | Already done: ${doneSet.size}`);

  let i = 0;
  for (const course of remaining) {
    i++;
    const pct = ((i / remaining.length) * 100).toFixed(1);
    log(`[${i}/${remaining.length} ${pct}%] ${course.name} (${course.city}, ${course.state})`);

    try {
      const results = await searchCourse(course.name);

      // Find best match by proximity (must be within 5km)
      const MAX_DIST = 5000;
      let bestMatch = null;
      let bestDist = Infinity;
      for (const r of results) {
        if (!r.location?.latitude || !r.location?.longitude) continue;
        const dist = distanceMeters(course.latitude, course.longitude, r.location.latitude, r.location.longitude);
        if (dist < bestDist) { bestDist = dist; bestMatch = r; }
      }

      if (!bestMatch || bestDist > MAX_DIST) {
        log(`  not found (${results.length} results, closest ${bestDist < Infinity ? Math.round(bestDist) + 'm away' : 'no coords'})`);
        progress.stats.notFound++;
      } else {
        log(`  matched: ${bestMatch.club_name} (${Math.round(bestDist)}m away)`);
        progress.stats.matched++;

        // Fill missing city/state from API match
        const coursePatch = {};
        if (!course.city?.trim() && bestMatch.location?.city) coursePatch.city = bestMatch.location.city;
        if (!course.state?.trim() && bestMatch.location?.state) coursePatch.state = bestMatch.location.state;
        if (Object.keys(coursePatch).length > 0) {
          await supabaseFetch(`/Course?id=eq.${course.id}`, { method: 'PATCH', body: JSON.stringify(coursePatch) });
          log(`  filled: ${Object.entries(coursePatch).map(([k, v]) => `${k}="${v}"`).join(', ')}`);
        }

        const tee = getBestTee(bestMatch.tees);
        if (!tee || !tee.holes || tee.holes.length < 9) {
          log(`  no usable hole data`);
        } else {
          // Fetch existing holes from our DB
          const existing = await supabaseFetch(
            `/Hole?select=id,holeNumber,par,handicapRank,yardage&courseId=eq.${course.id}`
          );
          if (!Array.isArray(existing) || existing.length === 0) {
            log(`  no holes in DB, skipping`);
          } else {
            const dbMap = {};
            existing.forEach(h => { dbMap[h.holeNumber] = h; });

            let updated = 0;
            for (let hNum = 0; hNum < tee.holes.length; hNum++) {
              const apiHole = tee.holes[hNum];
              const dbHole = dbMap[hNum + 1];
              if (!dbHole) continue;

              const patch = {};
              if (apiHole.par >= 3 && apiHole.par <= 5 && apiHole.par !== dbHole.par) patch.par = apiHole.par;
              if (apiHole.handicap >= 1 && apiHole.handicap <= 18 && apiHole.handicap !== dbHole.handicapRank) patch.handicapRank = apiHole.handicap;
              if (apiHole.yardage > 0 && apiHole.yardage !== dbHole.yardage) patch.yardage = apiHole.yardage;

              if (Object.keys(patch).length > 0) {
                await supabaseFetch(`/Hole?id=eq.${dbHole.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify(patch),
                });
                updated++;
              }
            }

            if (updated > 0) {
              log(`  updated ${updated}/${tee.holes.length} holes (par + handicap + yardage)`);
              progress.stats.holesUpdated += updated;
            } else {
              log(`  holes already up to date`);
            }
          }
        }
      }
    } catch (err) {
      log(`  ERROR: ${err.message}`);
      progress.stats.errors++;
    }

    progress.done.push(course.id);
    if (i % 100 === 0) {
      saveProgress(progress);
      log(`  [checkpoint] ${progress.done.length} total done`);
    }

    await sleep(DELAY_MS);
  }

  saveProgress(progress);
  log('');
  log('=== DONE ===');
  log(`Matched:       ${progress.stats.matched}`);
  log(`Holes updated: ${progress.stats.holesUpdated}`);
  log(`Not found:     ${progress.stats.notFound}`);
  log(`Errors:        ${progress.stats.errors}`);
  log(`Total done:    ${progress.done.length}`);
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
