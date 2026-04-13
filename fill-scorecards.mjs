// fill-scorecards.mjs
// Uses OpenStreetMap Overpass API to fetch real golf hole par and handicap data
// Focuses on courses that have actual uploads (most visible content)

const SUPABASE_URL = 'https://awlbxzpevwidowxxvuef.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bGJ4enBldndpZG93eHh2dWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxODQ5OSwiZXhwIjoyMDg4NTk0NDk5fQ.TU53et5QL6MwLmcv1wQNwDMLtjp62xaLSrElrCpGV0I';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

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
    const text = await res.text();
    throw new Error(`Supabase ${path}: ${res.status} ${text}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function queryOverpass(query) {
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  return res.json();
}

async function getHolesFromOSM(lat, lng, radiusMeters = 3000) {
  const query = `
[out:json][timeout:30];
(
  way["golf"="hole"](around:${radiusMeters},${lat},${lng});
  relation["golf"="hole"](around:${radiusMeters},${lat},${lng});
);
out tags;
`;
  const data = await queryOverpass(query);
  const elements = data.elements || [];
  const holes = [];
  for (const el of elements) {
    const tags = el.tags || {};
    const ref = parseInt(tags.ref || tags['name'] || '', 10);
    const par = parseInt(tags.par || '', 10);
    const handicap = parseInt(tags.handicap || '', 10);
    if (!isNaN(ref) && ref >= 1 && ref <= 18 && !isNaN(par) && par >= 3 && par <= 5) {
      holes.push({ holeNumber: ref, par, handicapRank: isNaN(handicap) ? null : handicap });
    }
  }
  return holes;
}

async function getCourseAccessFromOSM(lat, lng, name) {
  const query = `
[out:json][timeout:20];
(
  way["leisure"="golf_course"](around:500,${lat},${lng});
  relation["leisure"="golf_course"](around:500,${lat},${lng});
);
out tags;
`;
  const data = await queryOverpass(query);
  const elements = data.elements || [];
  for (const el of elements) {
    const tags = el.tags || {};
    const access = tags.access || '';
    // private, members_only, yes (public)
    if (access) return access;
  }
  return null;
}

async function main() {
  console.log('Fetching courses with uploads...');

  // Get courses that have uploads
  const uploads = await supabaseFetch('/Upload?select=courseId&limit=5000');
  const courseIds = [...new Set(uploads.map(u => u.courseId))];
  console.log(`Found ${courseIds.length} courses with uploads`);

  // Fetch those courses
  const courses = await supabaseFetch(
    `/Course?select=id,name,latitude,longitude,isPublic&id=in.(${courseIds.join(',')})`
  );

  let updated = 0;
  let skipped = 0;

  for (const course of courses) {
    if (!course.latitude || !course.longitude) {
      console.log(`  SKIP ${course.name} — no lat/lng`);
      skipped++;
      continue;
    }

    console.log(`\nProcessing: ${course.name} (${course.latitude}, ${course.longitude})`);

    try {
      // Get OSM holes
      let osmHoles = await getHolesFromOSM(course.latitude, course.longitude);

      // Try wider radius if not enough holes found
      if (osmHoles.length < 9) {
        console.log(`  Only ${osmHoles.length} holes found at 3km, trying 6km...`);
        await sleep(1000);
        osmHoles = await getHolesFromOSM(course.latitude, course.longitude, 6000);
      }

      console.log(`  Found ${osmHoles.length} OSM holes`);

      if (osmHoles.length < 9) {
        console.log(`  Not enough data (${osmHoles.length} holes) — skipping scorecard update`);
        skipped++;
        await sleep(2000);
        continue;
      }

      // Fetch existing DB holes for this course
      const dbHoles = await supabaseFetch(
        `/Hole?select=id,holeNumber,par,handicapRank&courseId=eq.${course.id}&order=holeNumber.asc`
      );

      // Build OSM lookup
      const osmMap = {};
      for (const h of osmHoles) osmMap[h.holeNumber] = h;

      // Update holes where we have OSM data
      let holeUpdates = 0;
      for (const dbHole of dbHoles) {
        const osm = osmMap[dbHole.holeNumber];
        if (!osm) continue;

        const parChanged = osm.par !== dbHole.par;
        const hcapChanged = osm.handicapRank !== null && osm.handicapRank !== dbHole.handicapRank;

        if (!parChanged && !hcapChanged) continue;

        const patch = {};
        if (parChanged) patch.par = osm.par;
        if (hcapChanged) patch.handicapRank = osm.handicapRank;

        await supabaseFetch(
          `/Hole?id=eq.${dbHole.id}`,
          { method: 'PATCH', body: JSON.stringify(patch) }
        );
        holeUpdates++;
        console.log(`  Hole ${dbHole.holeNumber}: par ${dbHole.par}→${osm.par}` +
          (hcapChanged ? `, hcap ${dbHole.handicapRank}→${osm.handicapRank}` : ''));
      }

      if (holeUpdates > 0) {
        console.log(`  Updated ${holeUpdates} holes`);
        updated++;
      } else {
        console.log(`  No changes needed`);
      }

      // Check public/private
      await sleep(1000);
      const access = await getCourseAccessFromOSM(course.latitude, course.longitude, course.name);
      if (access) {
        const shouldBePublic = access !== 'private' && access !== 'members_only';
        if (shouldBePublic !== course.isPublic) {
          await supabaseFetch(`/Course?id=eq.${course.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ isPublic: shouldBePublic }),
          });
          console.log(`  isPublic: ${course.isPublic} → ${shouldBePublic} (OSM access="${access}")`);
        } else {
          console.log(`  isPublic OK (OSM access="${access}")`);
        }
      }

    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
    }

    await sleep(2000); // be polite to Overpass
  }

  console.log(`\nDone. Updated ${updated} courses, skipped ${skipped}`);
}

main().catch(err => { console.error(err); process.exit(1); });
