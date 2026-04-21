// fill-teeboxes-golfapi.mjs
// Populates TeeBox records per hole per tee color using GolfCourseAPI.com
// Safe to kill and restart — progress saved to teeboxes-progress.json
//
// Usage: node fill-teeboxes-golfapi.mjs

import { existsSync, readFileSync, writeFileSync, createWriteStream } from 'fs';

const SUPABASE_URL = 'https://awlbxzpevwidowxxvuef.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bGJ4enBldndpZG93eHh2dWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxODQ5OSwiZXhwIjoyMDg4NTk0NDk5fQ.TU53et5QL6MwLmcv1wQNwDMLtjp62xaLSrElrCpGV0I';
const GOLF_API_KEY = '6IRZMMWMW2T7G5UM7POZTKGSXQ';
const GOLF_API_BASE = 'https://api.golfcourseapi.com/v1';
const PROGRESS_FILE = 'teeboxes-progress.json';
const LOG_FILE = 'teeboxes-log.txt';
const PAGE_SIZE = 500;
const DELAY_MS = 500;

const logStream = createWriteStream(LOG_FILE, { flags: 'a' });
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logStream.write(line + '\n');
}

function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return { done: [], stats: { matched: 0, teeBoxesCreated: 0, notFound: 0, errors: 0 } };
  try { return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return { done: [], stats: { matched: 0, teeBoxesCreated: 0, notFound: 0, errors: 0 } }; }
}

function saveProgress(p) { writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2)); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Map API tee name → our TeeColor enum
function mapTeeColor(name = '') {
  const n = name.toLowerCase();
  if (n.includes('black') || n.includes('tournament') || n.includes('championship')) return 'BLACK';
  if (n.includes('blue') || n.includes('men')) return 'BLUE';
  if (n.includes('white') || n.includes('regular')) return 'WHITE';
  if (n.includes('gold') || n.includes('senior')) return 'GOLD';
  if (n.includes('red') || n.includes('women') || n.includes('lady') || n.includes('ladies')) return 'RED';
  if (n.includes('green') || n.includes('junior')) return 'GREEN';
  return null; // skip unknown colors
}

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

async function searchCourse(name) {
  const cleaned = name
    .replace(/\b(golf course|golf club|country club|golf & country club|g\.?c\.?)\b/gi, '')
    .replace(/\s+/g, ' ').trim();

  const res = await fetch(`${GOLF_API_BASE}/search?search_query=${encodeURIComponent(cleaned)}`, {
    headers: { Authorization: `Key ${GOLF_API_KEY}` },
  });
  if (res.status === 429) {
    log('  Rate limited, waiting 60s...');
    await sleep(60000);
    return searchCourse(name);
  }
  if (!res.ok) throw new Error(`GolfCourseAPI search: ${res.status}`);
  const data = await res.json();
  return data.courses || [];
}

async function main() {
  log('=== fill-teeboxes-golfapi starting ===');

  const progress = loadProgress();
  const doneSet = new Set(progress.done);
  log(`Progress: ${doneSet.size} courses already done`);

  log('Fetching all courses from DB...');
  const courses = await fetchAllCourses();
  log(`Total courses: ${courses.length}`);

  const remaining = courses.filter(c => !doneSet.has(c.id) && c.latitude && c.longitude);
  log(`To process: ${remaining.length}`);

  let i = 0;
  for (const course of remaining) {
    i++;
    const pct = ((i / remaining.length) * 100).toFixed(1);
    log(`[${i}/${remaining.length} ${pct}%] ${course.name}`);

    try {
      const results = await searchCourse(course.name);

      // Match by GPS proximity within 5km
      const MAX_DIST = 5000;
      let bestMatch = null, bestDist = Infinity;
      for (const r of results) {
        if (!r.location?.latitude || !r.location?.longitude) continue;
        const dist = distanceMeters(course.latitude, course.longitude, r.location.latitude, r.location.longitude);
        if (dist < bestDist) { bestDist = dist; bestMatch = r; }
      }

      if (!bestMatch || bestDist > MAX_DIST) {
        log(`  not found`);
        progress.stats.notFound++;
      } else {
        log(`  matched: ${bestMatch.club_name} (${Math.round(bestDist)}m)`);
        progress.stats.matched++;

        // Fetch holes from our DB
        const dbHoles = await supabaseFetch(
          `/Hole?select=id,holeNumber&courseId=eq.${course.id}&order=holeNumber.asc`
        );
        if (!Array.isArray(dbHoles) || dbHoles.length === 0) {
          log(`  no holes in DB`);
          progress.done.push(course.id);
          await sleep(DELAY_MS);
          continue;
        }
        const holeMap = {};
        dbHoles.forEach(h => { holeMap[h.holeNumber] = h.id; });

        // Process each tee set
        const allTees = [
          ...(bestMatch.tees?.male || []),
          ...(bestMatch.tees?.female || []),
        ];

        // Deduplicate by color — keep the one with most holes
        const colorMap = {};
        for (const tee of allTees) {
          const color = mapTeeColor(tee.tee_name || '');
          if (!color) continue;
          if (!colorMap[color] || (tee.holes?.length || 0) > (colorMap[color].holes?.length || 0)) {
            colorMap[color] = tee;
          }
        }

        let created = 0;
        for (const [color, tee] of Object.entries(colorMap)) {
          if (!tee.holes || tee.holes.length < 9) continue;

          // Build upsert records for each hole
          const records = [];
          for (let hNum = 0; hNum < tee.holes.length; hNum++) {
            const apiHole = tee.holes[hNum];
            const holeId = holeMap[hNum + 1];
            if (!holeId || !apiHole.yardage || apiHole.yardage <= 0) continue;

            records.push({
              courseId: course.id,
              holeId,
              color,
              yardage: apiHole.yardage,
              ...(tee.course_rating ? { rating: tee.course_rating } : {}),
              ...(tee.slope_rating ? { slope: tee.slope_rating } : {}),
            });
          }

          if (records.length === 0) continue;

          // Upsert (ignore conflicts on holeId+color unique constraint)
          await supabaseFetch(`/TeeBox`, {
            method: 'POST',
            body: JSON.stringify(records),
            headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
          });
          created += records.length;
        }

        if (created > 0) {
          log(`  created ${created} tee box records across ${Object.keys(colorMap).length} tee colors`);
          progress.stats.teeBoxesCreated += created;
        } else {
          log(`  no usable tee data`);
        }
      }
    } catch (err) {
      log(`  ERROR: ${err.message}`);
      progress.stats.errors++;
    }

    progress.done.push(course.id);
    if (i % 100 === 0) {
      saveProgress(progress);
      log(`  [checkpoint] ${progress.done.length} done`);
    }

    await sleep(DELAY_MS);
  }

  saveProgress(progress);
  log('');
  log('=== DONE ===');
  log(`Matched:          ${progress.stats.matched}`);
  log(`TeeBoxes created: ${progress.stats.teeBoxesCreated}`);
  log(`Not found:        ${progress.stats.notFound}`);
  log(`Errors:           ${progress.stats.errors}`);
}

main().catch(err => { log(`FATAL: ${err.message}`); process.exit(1); });
