import https from 'https';
import http from 'http';

const SUPABASE_URL = 'https://awlbxzpevwidowxxvuef.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bGJ4enBldndpZG93eHh2dWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxODQ5OSwiZXhwIjoyMDg4NTk0NDk5fQ.TU53et5QL6MwLmcv1wQNwDMLtjp62xaLSrElrCpGV0I';

const STATE_ABBREV = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY'
};

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function patchCourse(id, patch) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(patch);
    const url = new URL(`${SUPABASE_URL}/rest/v1/Course?id=eq.${id}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        'apikey': API_KEY,
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isGarbageHole(name) {
  if (!name) return false;
  const n = name.toUpperCase().trim();
  // Contains keywords
  if (/FAIRWAY|TEE BOX|BUNKER|HAZARD|SAND/.test(n)) return true;
  if (/TEE RED|TEE WHITE/.test(n)) return true;
  // Ends with GREEN or TEE
  if (/\bGREEN$/.test(n)) return true;
  if (/\bTEE$/.test(n)) return true;
  // Starts with # or number followed by ST/ND/RD/TH
  if (/^#/.test(n)) return true;
  if (/^\d+(ST|ND|RD|TH)\b/.test(n)) return true;
  return false;
}

async function main() {
  console.log('Fetching courses with blank city...');

  const resp = await fetchJson(
    `${SUPABASE_URL}/rest/v1/Course?city=eq.&select=id,name,city,state,latitude,longitude&limit=1000&order=name.asc`,
    { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` }
  );

  if (!Array.isArray(resp.body)) {
    console.error('Unexpected response:', resp.status, JSON.stringify(resp.body).slice(0, 200));
    process.exit(1);
  }

  const allCourses = resp.body;
  console.log(`Total records fetched: ${allCourses.length}`);

  // Filter out garbage hole entries
  const courses = allCourses.filter(c => !isGarbageHole(c.name));
  const skipped = allCourses.length - courses.length;
  console.log(`After filtering garbage holes: ${courses.length} real courses (${skipped} skipped)`);

  let filled = 0;
  let failed = 0;
  let noCoords = 0;
  let alreadyHasCity = 0;

  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];
    const pct = Math.round(((i + 1) / courses.length) * 100);

    // Double-check city is still blank (shouldn't matter but be safe)
    if (course.city && course.city.trim() !== '') {
      alreadyHasCity++;
      continue;
    }

    if (!course.latitude || !course.longitude) {
      console.log(`[${i+1}/${courses.length}] ${course.name} — NO COORDS, skipping`);
      noCoords++;
      continue;
    }

    // Reverse geocode
    let geoData = null;
    let attempts = 0;
    while (attempts < 3) {
      try {
        const geoResp = await fetchJson(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${course.latitude}&lon=${course.longitude}`,
          { 'User-Agent': 'TourItGolfApp/1.0' }
        );
        if (geoResp.status === 200 && geoResp.body && geoResp.body.address) {
          geoData = geoResp.body;
          break;
        } else {
          console.log(`  Geocode attempt ${attempts+1} failed: status ${geoResp.status}`);
          attempts++;
          if (attempts < 3) await sleep(2000);
        }
      } catch (e) {
        console.log(`  Geocode attempt ${attempts+1} error: ${e.message}`);
        attempts++;
        if (attempts < 3) await sleep(2000);
      }
    }

    if (!geoData) {
      console.log(`[${i+1}/${courses.length}] ${course.name} — geocode FAILED`);
      failed++;
      await sleep(1100);
      continue;
    }

    const addr = geoData.address;
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || addr.county || null;

    // Extract state abbreviation if course state is blank
    let stateAbbrev = null;
    if (!course.state || course.state.trim() === '') {
      const fullState = addr.state;
      if (fullState && STATE_ABBREV[fullState]) {
        stateAbbrev = STATE_ABBREV[fullState];
      } else if (fullState) {
        // Maybe it's already an abbreviation or unknown state
        stateAbbrev = fullState.length <= 3 ? fullState : null;
      }
    }

    if (!city) {
      console.log(`[${i+1}/${courses.length}] ${course.name} (${course.state}) — no city found in geocode`);
      failed++;
      await sleep(1100);
      continue;
    }

    // Build patch — only include fields that were blank
    const patch = { city };
    if (stateAbbrev && (!course.state || course.state.trim() === '')) {
      patch.state = stateAbbrev;
    }

    try {
      const patchResp = await patchCourse(course.id, patch);
      if (patchResp.status >= 200 && patchResp.status < 300) {
        filled++;
        const stateInfo = patch.state ? ` + state=${patch.state}` : '';
        console.log(`[${i+1}/${courses.length}] ${pct}% — Updated: ${course.name} => city=${city}${stateInfo}`);
      } else {
        console.log(`[${i+1}/${courses.length}] PATCH FAILED (${patchResp.status}): ${course.name} — ${patchResp.body}`);
        failed++;
      }
    } catch (e) {
      console.log(`[${i+1}/${courses.length}] PATCH ERROR: ${course.name} — ${e.message}`);
      failed++;
    }

    await sleep(1100);
  }

  console.log('\n=== DONE ===');
  console.log(`Total records fetched:    ${allCourses.length}`);
  console.log(`Garbage holes skipped:    ${skipped}`);
  console.log(`Real courses processed:   ${courses.length}`);
  console.log(`Cities filled in:         ${filled}`);
  console.log(`No coordinates (skipped): ${noCoords}`);
  console.log(`Failed (geocode/patch):   ${failed}`);
  console.log(`Already had city:         ${alreadyHasCity}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
