/**
 * backfill-hole-coords.mjs
 *
 * For each course with lat/lng, queries OpenStreetMap Overpass API for
 * golf=tee nodes within 1km. Matches tees to holes by the OSM `ref` tag
 * (hole number) and patches Hole.teeLat / Hole.teeLng in Supabase.
 *
 * Usage: node backfill-hole-coords.mjs
 * Optional: node backfill-hole-coords.mjs "Course Name" (single course)
 */

import https from 'https';
import http from 'http';

const SUPABASE_URL = 'https://awlbxzpevwidowxxvuef.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bGJ4enBldndpZG93eHh2dWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxODQ5OSwiZXhwIjoyMDg4NTk0NDk5fQ.TU53et5QL6MwLmcv1wQNwDMLtjp62xaLSrElrCpGV0I';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const filterName = process.argv[2] || null;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(new Error('Timeout')); });
  });
}

function postOverpass(query) {
  return new Promise((resolve, reject) => {
    const body = 'data=' + encodeURIComponent(query);
    const options = {
      hostname: 'overpass-api.de',
      path: '/api/interpreter',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'TourItGolfApp/1.0',
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

async function withRetry(fn, label, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      const isLast = i === attempts - 1;
      if (isLast) throw e;
      const wait = 3000 * (i + 1);
      console.log(`  [retry ${i + 1}] ${label} — ${e.message}, waiting ${wait / 1000}s`);
      await sleep(wait);
    }
  }
}

function supabaseGet(path) {
  return withRetry(
    () => fetchJson(`${SUPABASE_URL}/rest/v1/${path}`, {
      apikey: API_KEY,
      Authorization: `Bearer ${API_KEY}`,
    }),
    `GET ${path.split('?')[0]}`
  );
}

function patchHole(id, patch) {
  return withRetry(() => new Promise((resolve, reject) => {
    const body = JSON.stringify(patch);
    const url = new URL(`${SUPABASE_URL}/rest/v1/Hole?id=eq.${id}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  }), `PATCH Hole ${id}`);
}

// Query golf=hole relations/ways — these reliably have ref=<hole number> tags
// and contain tee nodes with actual coordinates.
// Falls back to golf=tee nodes with ref/hole tags.
async function getHoleData(lat, lng, radiusM = 1500) {
  const query = `
[out:json][timeout:30];
(
  relation[golf=hole](around:${radiusM},${lat},${lng});
  way[golf=hole](around:${radiusM},${lat},${lng});
  node[golf=tee][ref](around:${radiusM},${lat},${lng});
  node[golf=tee][hole](around:${radiusM},${lat},${lng});
);
out geom;
`;
  let attempts = 0;
  while (attempts < 3) {
    try {
      const resp = await postOverpass(query);
      if (resp.status === 200 && resp.body?.elements) return resp.body.elements;
      attempts++;
      await sleep(4000);
    } catch (e) {
      attempts++;
      await sleep(4000);
    }
  }
  return [];
}

// Extract tee coordinate from a golf=hole relation/way element.
// Prefers nodes tagged golf=tee; falls back to first node of geometry.
function teeCoordFromHoleElement(el) {
  if (!el.members && !el.geometry && !el.nodes) return null;

  // Relation: look for member nodes tagged golf=tee
  if (el.type === 'relation' && el.members) {
    const teeMembers = el.members.filter(m => m.type === 'node' && m.role === 'tee');
    if (teeMembers.length > 0 && teeMembers[0].lat) {
      return { lat: teeMembers[0].lat, lng: teeMembers[0].lon };
    }
    // Fallback: first node member with geometry
    const firstNode = el.members.find(m => m.type === 'node' && m.lat);
    if (firstNode) return { lat: firstNode.lat, lng: firstNode.lon };
  }

  // Way: use first point of geometry (tee is typically at start)
  if (el.type === 'way' && el.geometry && el.geometry.length > 0) {
    return { lat: el.geometry[0].lat, lng: el.geometry[0].lon };
  }

  return null;
}

async function fetchAllCourses() {
  const pageSize = 1000;
  let offset = 0;
  let all = [];
  while (true) {
    const resp = await supabaseGet(
      `Course?select=id,name,latitude,longitude&latitude=not.is.null&longitude=not.is.null&order=name.asc&limit=${pageSize}&offset=${offset}`
    );
    const page = resp.body;
    if (!Array.isArray(page) || page.length === 0) break;
    all = all.concat(page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function main() {
  let courses = await fetchAllCourses();
  if (!courses.length) { console.error('No courses fetched'); process.exit(1); }

  if (filterName) {
    courses = courses.filter(c => c.name.toLowerCase().includes(filterName.toLowerCase()));
    console.log(`Filtered to ${courses.length} courses matching "${filterName}"`);
  }

  console.log(`Processing ${courses.length} courses...\n`);

  let totalFilled = 0;
  let totalSkipped = 0;
  let totalNoData = 0;

  for (let ci = 0; ci < courses.length; ci++) {
    const course = courses[ci];
    console.log(`[${ci + 1}/${courses.length}] ${course.name}`);

    // Fetch holes for this course
    const holesResp = await supabaseGet(
      `Hole?courseId=eq.${course.id}&select=id,holeNumber,teeLat,teeLng&order=holeNumber.asc`
    );
    const holes = holesResp.body;
    if (!Array.isArray(holes) || holes.length === 0) {
      console.log('  No holes found, skipping');
      totalSkipped++;
      continue;
    }

    const alreadyFilled = holes.filter(h => h.teeLat && h.teeLng).length;
    if (alreadyFilled === holes.length) {
      console.log(`  All ${holes.length} holes already have coords, skipping`);
      totalSkipped++;
      continue;
    }

    // Query OSM for golf hole data near this course
    const elements = await getHoleData(course.latitude, course.longitude);
    await sleep(1200); // rate limit Overpass

    if (elements.length === 0) {
      console.log(`  No OSM data found`);
      totalNoData++;
      continue;
    }

    // Build map: hole number -> tee coords
    const teeByHole = {};

    for (const el of elements) {
      // golf=hole relations/ways — most reliable source
      if (el.tags?.golf === 'hole') {
        const ref = el.tags?.ref || el.tags?.hole;
        if (!ref) continue;
        const num = parseInt(ref, 10);
        if (isNaN(num) || num < 1 || num > 18) continue;
        const coords = teeCoordFromHoleElement(el);
        if (!coords) continue;
        if (!teeByHole[num]) teeByHole[num] = coords;
      }
      // golf=tee nodes with explicit ref or hole tag
      else if (el.tags?.golf === 'tee' && el.type === 'node') {
        const ref = el.tags?.ref || el.tags?.hole;
        if (!ref) continue;
        const num = parseInt(ref, 10);
        if (isNaN(num) || num < 1 || num > 18) continue;
        if (!teeByHole[num]) teeByHole[num] = { lat: el.lat, lng: el.lon };
      }
    }

    const foundNums = Object.keys(teeByHole).length;
    console.log(`  Found ${elements.length} elements → ${foundNums} numbered holes`);

    if (foundNums === 0) {
      console.log(`  No hole numbers found in OSM data`);
      totalNoData++;
      continue;
    }

    // Patch holes that have OSM data and don't have coords yet
    let filled = 0;
    for (const hole of holes) {
      if (hole.teeLat && hole.teeLng) continue; // already set
      const coords = teeByHole[hole.holeNumber];
      if (!coords) continue;
      try {
        const res = await patchHole(hole.id, { teeLat: coords.lat, teeLng: coords.lng });
        if (res.status >= 200 && res.status < 300) {
          filled++;
          totalFilled++;
          console.log(`    Hole ${hole.holeNumber}: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
        }
      } catch (e) {
        console.log(`    Hole ${hole.holeNumber}: patch error — ${e.message}`);
      }
    }

    console.log(`  → Filled ${filled}/${holes.length - alreadyFilled} missing holes`);
  }

  console.log('\n=== DONE ===');
  console.log(`Holes filled:    ${totalFilled}`);
  console.log(`Courses skipped: ${totalSkipped}`);
  console.log(`No OSM data:     ${totalNoData}`);
}

async function run() {
  let attempts = 0;
  while (true) {
    try {
      await main();
      break; // finished cleanly
    } catch (err) {
      attempts++;
      console.error(`\nCrash #${attempts}:`, err.message);
      if (attempts >= 10) { console.error('Too many crashes, giving up.'); process.exit(1); }
      const wait = Math.min(30000, 5000 * attempts);
      console.log(`Restarting in ${wait / 1000}s...\n`);
      await sleep(wait);
    }
  }
}

run();
