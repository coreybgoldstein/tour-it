// fill-all-courses-background.mjs
// Long-running background script — safe to kill and restart anytime.
// Fills: hole par/handicap, public/private, website URL, course logo
// Sources: OpenStreetMap Overpass API (scorecard + metadata), og:image (logo)
//
// Usage: node fill-all-courses-background.mjs
// Resume: just run again — progress is saved to fill-progress.json

import { createWriteStream, existsSync, readFileSync, writeFileSync } from 'fs';

const SUPABASE_URL = 'https://awlbxzpevwidowxxvuef.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bGJ4enBldndpZG93eHh2dWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxODQ5OSwiZXhwIjoyMDg4NTk0NDk5fQ.TU53et5QL6MwLmcv1wQNwDMLtjp62xaLSrElrCpGV0I';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const STORAGE_BUCKET = 'tour-it-photos';
const PROGRESS_FILE = 'fill-progress.json';
const LOG_FILE = 'fill-log.txt';
const PAGE_SIZE = 500;

// ── Logging ──────────────────────────────────────────────────────────────────

const logStream = createWriteStream(LOG_FILE, { flags: 'a' });
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logStream.write(line + '\n');
}

// ── Progress ──────────────────────────────────────────────────────────────────

function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return { done: [], stats: { scorecards: 0, logos: 0, access: 0, errors: 0 } };
  try { return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return { done: [], stats: { scorecards: 0, logos: 0, access: 0, errors: 0 } }; }
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

async function supabasePatch(path, body) {
  return supabaseFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
}

// Fetch with retry + exponential backoff for rate-limited APIs
async function fetchWithRetry(url, opts = {}, maxRetries = 4) {
  let delay = 5000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, opts);
      if (res.status === 429 || res.status === 504 || res.status === 502) {
        if (attempt === maxRetries) throw new Error(`HTTP ${res.status} after ${maxRetries} retries`);
        log(`    Rate limited (${res.status}), waiting ${delay / 1000}s...`);
        await sleep(delay);
        delay = Math.min(delay * 2, 120000);
        continue;
      }
      return res;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      log(`    Fetch error: ${err.message}, retrying in ${delay / 1000}s...`);
      await sleep(delay);
      delay = Math.min(delay * 2, 120000);
    }
  }
}

// ── Overpass ──────────────────────────────────────────────────────────────────

async function queryOverpass(query) {
  const res = await fetchWithRetry(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass: ${res.status}`);
  return res.json();
}

// One query gets both the course metadata and its holes
async function queryOSMForCourse(lat, lng, radius = 3000) {
  const query = `
[out:json][timeout:25];
(
  way["leisure"="golf_course"](around:500,${lat},${lng});
  relation["leisure"="golf_course"](around:500,${lat},${lng});
  way["golf"="hole"](around:${radius},${lat},${lng});
  relation["golf"="hole"](around:${radius},${lat},${lng});
);
out tags;
`;
  const data = await queryOverpass(query);
  const elements = data.elements || [];

  let courseAccess = null;
  let courseWebsite = null;
  const holes = [];

  for (const el of elements) {
    const tags = el.tags || {};

    // Course-level element
    if (tags.leisure === 'golf_course') {
      if (tags.access) courseAccess = tags.access;
      if (tags.website) courseWebsite = tags.website;
      if (tags.url) courseWebsite = courseWebsite || tags.url;
      continue;
    }

    // Hole element
    if (tags.golf === 'hole') {
      const ref = parseInt(tags.ref || '', 10);
      const par = parseInt(tags.par || '', 10);
      const handicap = parseInt(tags.handicap || '', 10);
      if (!isNaN(ref) && ref >= 1 && ref <= 18 && !isNaN(par) && par >= 3 && par <= 5) {
        holes.push({
          holeNumber: ref,
          par,
          handicapRank: isNaN(handicap) ? null : handicap,
        });
      }
    }
  }

  return { courseAccess, courseWebsite, holes };
}

// ── Logo scraping ─────────────────────────────────────────────────────────────

async function fetchOgImage(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TourItBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Try og:image first
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch) return new URL(ogMatch[1], url).toString();

    // Try twitter:image
    const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    if (twMatch) return new URL(twMatch[1], url).toString();

    return null;
  } catch {
    return null;
  }
}

async function uploadLogoToSupabase(courseId, imageUrl) {
  try {
    const imgRes = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TourItBot/1.0)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!imgRes.ok) return null;

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;

    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const buffer = await imgRes.arrayBuffer();
    if (buffer.byteLength < 500) return null; // skip tiny images

    const storagePath = `course-logos/${courseId}.${ext}`;
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`,
      {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: buffer,
      }
    );
    if (!uploadRes.ok) return null;

    return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`;
  } catch {
    return null;
  }
}

// ── Hole updating ─────────────────────────────────────────────────────────────

async function updateHoles(courseId, osmHoles) {
  if (osmHoles.length === 0) return 0;

  const existing = await supabaseFetch(
    `/Hole?select=id,holeNumber,par,handicapRank&courseId=eq.${courseId}`
  );
  if (!Array.isArray(existing)) return 0;

  const holeMap = {};
  existing.forEach(h => { holeMap[h.holeNumber] = h; });

  const osmMap = {};
  osmHoles.forEach(h => { osmMap[h.holeNumber] = h; });

  let updated = 0;
  for (const [num, osm] of Object.entries(osmMap)) {
    const db = holeMap[num];
    if (!db) continue; // don't create holes from OSM — only update existing

    const patch = {};
    if (osm.par !== db.par) patch.par = osm.par;
    if (osm.handicapRank !== null && osm.handicapRank !== db.handicapRank) {
      patch.handicapRank = osm.handicapRank;
    }
    if (Object.keys(patch).length === 0) continue;

    await supabasePatch(`/Hole?id=eq.${db.id}`, patch);
    updated++;
  }
  return updated;
}

// ── All courses ───────────────────────────────────────────────────────────────

async function fetchAllCourses() {
  const courses = [];
  let offset = 0;
  while (true) {
    const page = await supabaseFetch(
      `/Course?select=id,name,city,state,latitude,longitude,isPublic,websiteUrl,logoUrl&order=id.asc&limit=${PAGE_SIZE}&offset=${offset}`
    );
    if (!Array.isArray(page) || page.length === 0) break;
    courses.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return courses;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log('=== fill-all-courses-background starting ===');

  const progress = loadProgress();
  const doneSet = new Set(progress.done);
  log(`Progress file: ${doneSet.size} courses already processed`);

  log('Fetching all courses from DB...');
  const courses = await fetchAllCourses();
  log(`Total courses: ${courses.length}`);

  const remaining = courses.filter(c => !doneSet.has(c.id) && c.latitude && c.longitude);
  const noLatLng = courses.filter(c => !doneSet.has(c.id) && (!c.latitude || !c.longitude)).length;
  log(`To process: ${remaining.length} | Skipping (no lat/lng): ${noLatLng} | Already done: ${doneSet.size}`);

  let i = 0;
  for (const course of remaining) {
    i++;
    const pct = ((i / remaining.length) * 100).toFixed(1);
    log(`[${i}/${remaining.length} ${pct}%] ${course.name} (${course.city}, ${course.state})`);

    try {
      const { courseAccess, courseWebsite, holes } = await queryOSMForCourse(
        course.latitude, course.longitude
      );

      const coursePatch = {};

      // ── Public/private ──
      if (courseAccess) {
        const shouldBePublic = courseAccess !== 'private' && courseAccess !== 'members_only';
        if (shouldBePublic !== course.isPublic) {
          coursePatch.isPublic = shouldBePublic;
          log(`  access: ${course.isPublic ? 'public' : 'private'} → ${shouldBePublic ? 'public' : 'private'} (OSM: ${courseAccess})`);
          progress.stats.access++;
        }
      }

      // ── Website URL ──
      const websiteUrl = courseWebsite || null;
      if (websiteUrl && !course.websiteUrl) {
        coursePatch.websiteUrl = websiteUrl;
        log(`  website: ${websiteUrl}`);
      }

      // ── Scorecard ──
      if (holes.length >= 9) {
        const updated = await updateHoles(course.id, holes);
        if (updated > 0) {
          log(`  scorecard: updated ${updated} holes from OSM (${holes.length} found)`);
          progress.stats.scorecards++;
        }
      } else if (holes.length > 0) {
        log(`  scorecard: only ${holes.length} OSM holes found, skipping`);
      }

      // ── Logo ──
      if (!course.logoUrl) {
        const siteUrl = websiteUrl || course.websiteUrl;
        if (siteUrl) {
          const ogImage = await fetchOgImage(siteUrl);
          if (ogImage) {
            const logoUrl = await uploadLogoToSupabase(course.id, ogImage);
            if (logoUrl) {
              coursePatch.logoUrl = logoUrl;
              log(`  logo: uploaded from ${siteUrl}`);
              progress.stats.logos++;
            }
          }
        }
      }

      // ── Apply course-level patch ──
      if (Object.keys(coursePatch).length > 0) {
        await supabasePatch(`/Course?id=eq.${course.id}`, coursePatch);
      }

    } catch (err) {
      log(`  ERROR: ${err.message}`);
      progress.stats.errors++;
    }

    // Mark done and save progress every 10 courses
    progress.done.push(course.id);
    if (i % 10 === 0) {
      saveProgress(progress);
      log(`  [checkpoint] saved progress (${progress.done.length} total done)`);
    }

    // Rate limit: 3s between courses, longer after every 50 to be polite
    if (i % 50 === 0) {
      log(`  [pause] 15s cooldown after ${i} courses...`);
      await sleep(15000);
    } else {
      await sleep(3000);
    }
  }

  // Final save
  saveProgress(progress);

  log('');
  log('=== DONE ===');
  log(`Scorecards updated: ${progress.stats.scorecards}`);
  log(`Logos added:        ${progress.stats.logos}`);
  log(`Access corrected:   ${progress.stats.access}`);
  log(`Errors:             ${progress.stats.errors}`);
  log(`Total processed:    ${progress.done.length}`);
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
