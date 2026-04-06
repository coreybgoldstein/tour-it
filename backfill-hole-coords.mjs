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
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
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
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

function supabaseGet(path) {
  return fetchJson(`${SUPABASE_URL}/rest/v1/${path}`, {
    apikey: API_KEY,
    Authorization: `Bearer ${API_KEY}`,
  });
}

function patchHole(id, patch) {
  return new Promise((resolve, reject) => {
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
  });
}

async function getTeeNodes(lat, lng, radiusM = 1200) {
  const query = `
[out:json][timeout:25];
(
  node[golf=tee](around:${radiusM},${lat},${lng});
  way[golf=tee](around:${radiusM},${lat},${lng});
);
out center;
`;
  let attempts = 0;
  while (attempts < 3) {
    try {
      const resp = await postOverpass(query);
      if (resp.status === 200 && resp.body?.elements) return resp.body.elements;
      attempts++;
      await sleep(3000);
    } catch (e) {
      attempts++;
      await sleep(3000);
    }
  }
  return [];
}

function centroid(el) {
  if (el.type === 'node') return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

async function main() {
  // Fetch all courses with coords
  let coursesResp = await supabaseGet(
    `Course?select=id,name,latitude,longitude&latitude=not.is.null&longitude=not.is.null&order=name.asc&limit=1000`
  );
  let courses = coursesResp.body;
  if (!Array.isArray(courses)) { console.error('Bad response', courses); process.exit(1); }

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

    // Query OSM for tee nodes near this course
    const teeNodes = await getTeeNodes(course.latitude, course.longitude);
    await sleep(1100); // rate limit Overpass

    if (teeNodes.length === 0) {
      console.log(`  No OSM tee data found`);
      totalNoData++;
      continue;
    }

    // Build map: hole number -> tee coords
    // OSM ref tag is usually the hole number ("1", "2", etc.)
    const teeByHole = {};
    for (const el of teeNodes) {
      const ref = el.tags?.ref || el.tags?.hole;
      if (!ref) continue;
      const num = parseInt(ref, 10);
      if (isNaN(num) || num < 1 || num > 18) continue;
      const coords = centroid(el);
      if (!coords) continue;
      // Keep first match per hole number
      if (!teeByHole[num]) teeByHole[num] = coords;
    }

    const foundNums = Object.keys(teeByHole).length;
    console.log(`  Found ${teeNodes.length} tee nodes → ${foundNums} numbered holes in OSM`);

    if (foundNums === 0) {
      console.log(`  Tee nodes have no ref/hole number tags, skipping`);
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

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
