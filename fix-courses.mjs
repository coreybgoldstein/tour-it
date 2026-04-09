// fix-courses.mjs
// Fixes golf course entries in Supabase: removes garbage, geocodes missing city/state

const SUPABASE_URL = 'https://awlbxzpevwidowxxvuef.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bGJ4enBldndpZG93eHh2dWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxODQ5OSwiZXhwIjoyMDg4NTk0NDk5fQ.TU53et5QL6MwLmcv1wQNwDMLtjp62xaLSrElrCpGV0I';

const STATE_MAP = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
  'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
  'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS',
  'Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA',
  'Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT',
  'Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM',
  'New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK',
  'Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
  'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
  'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY'
};

// Patterns that indicate garbage/hole-feature entries
const GARBAGE_PATTERNS = [
  /^#\d+\s+(green|tee|fairway|sand|rough|bunker|white tee|red tee|blue tee|yellow tee|black tee|tee box)/i,
  /^\d+(st|nd|rd|th)\s+(fairway|green|tee|sand|rough|bunker|tee box)/i,
  /^\d+TH\s+(FAIRWAY|GREEN|TEE|SAND|ROUGH|BUNKER|TEE BOX)/i,
  /^1ST\s+(FAIRWAY|GREEN|TEE|SAND)/i,
  /^2ND\s+(FAIRWAY|GREEN|TEE|SAND)/i,
  /^3RD\s+(FAIRWAY|GREEN|TEE|SAND)/i,
];

function isGarbage(name) {
  return GARBAGE_PATTERNS.some(p => p.test(name.trim()));
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchAllCourses() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/Course?select=id,name,city,state,country,latitude,longitude,holeCount&order=name.asc&limit=1000`,
    {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    }
  );
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'TourItGolfApp/1.0' } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || !data.address) return null;
  const addr = data.address;
  const city = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || null;
  const stateFull = addr.state || null;
  const stateAbbr = stateFull ? (STATE_MAP[stateFull] || null) : null;
  return { city, state: stateAbbr };
}

async function forwardGeocode(name) {
  const q = encodeURIComponent(`${name} golf course`);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=3&countrycodes=us`;
  const res = await fetch(url, { headers: { 'User-Agent': 'TourItGolfApp/1.0' } });
  if (!res.ok) return null;
  const results = await res.json();
  if (!results || results.length === 0) return null;

  // Look for a result that looks like a golf course
  for (const r of results) {
    const displayName = (r.display_name || '').toLowerCase();
    const type = (r.type || '').toLowerCase();
    const category = (r.class || '').toLowerCase();
    if (
      displayName.includes('golf') ||
      type.includes('golf') ||
      category.includes('golf') ||
      r.type === 'golf_course'
    ) {
      // Try to get city/state from display_name or do a reverse lookup
      const lat = parseFloat(r.lat);
      const lon = parseFloat(r.lon);
      const geo = await reverseGeocode(lat, lon);
      await sleep(1100);
      return { lat, lon, city: geo?.city || null, state: geo?.state || null };
    }
  }

  // If no golf-specific result, use first result if it's in the US
  const first = results[0];
  if (first.display_name && first.display_name.includes('United States')) {
    const lat = parseFloat(first.lat);
    const lon = parseFloat(first.lon);
    const geo = await reverseGeocode(lat, lon);
    await sleep(1100);
    return { lat, lon, city: geo?.city || null, state: geo?.state || null };
  }

  return null;
}

async function updateCourse(id, fields) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/Course?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(fields)
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update failed for ${id}: ${res.status} ${text}`);
  }
}

async function main() {
  console.log('Fetching all courses from Supabase...');
  const courses = await fetchAllCourses();
  console.log(`Total entries fetched: ${courses.length}`);

  // Separate garbage from real courses
  const garbage = courses.filter(c => isGarbage(c.name));
  const real = courses.filter(c => !isGarbage(c.name));

  console.log(`\nGarbage entries (skipped): ${garbage.length}`);
  console.log(`Real golf courses: ${real.length}`);

  // Identify courses that need work
  const needsWork = real.filter(c => {
    const missingCity = !c.city || c.city.trim() === '';
    const missingState = !c.state || c.state.trim() === '';
    return missingCity || missingState;
  });

  console.log(`\nReal courses missing city or state: ${needsWork.length}`);

  let fixed = 0;
  let couldNotFix = [];
  let geocodedFromLatLon = 0;
  let geocodedFromName = 0;

  for (let i = 0; i < needsWork.length; i++) {
    const course = needsWork[i];
    const missingCity = !course.city || course.city.trim() === '';
    const missingState = !course.state || course.state.trim() === '';
    const hasLatLon = course.latitude != null && course.longitude != null &&
                      course.latitude !== 0 && course.longitude !== 0;

    console.log(`\n[${i+1}/${needsWork.length}] "${course.name}" (city="${course.city}", state="${course.state}", hasLatLon=${hasLatLon})`);

    let updateFields = {};
    let success = false;

    if (hasLatLon) {
      // Try reverse geocoding
      await sleep(1100); // Nominatim rate limit: 1 req/sec
      const geo = await reverseGeocode(course.latitude, course.longitude);
      if (geo) {
        if (missingCity && geo.city) updateFields.city = geo.city;
        if (missingState && geo.state) updateFields.state = geo.state;
        if (Object.keys(updateFields).length > 0) {
          console.log(`  -> Reverse geocoded: city="${updateFields.city || course.city}", state="${updateFields.state || course.state}"`);
          geocodedFromLatLon++;
          success = true;
        } else {
          console.log(`  -> Reverse geocode returned no useful data`);
        }
      } else {
        console.log(`  -> Reverse geocode failed`);
      }
    }

    // If we still have missing data, try forward geocoding by name
    if (!success || (missingCity && !updateFields.city) || (missingState && !updateFields.state)) {
      if (!success) {
        console.log(`  -> Trying forward geocode by name...`);
        await sleep(1100);
        const fwd = await forwardGeocode(course.name);
        if (fwd) {
          if (missingCity && fwd.city) updateFields.city = fwd.city;
          if (missingState && fwd.state) updateFields.state = fwd.state;
          // Only update lat/lon if course has none
          if (!hasLatLon && fwd.lat && fwd.lon) {
            updateFields.latitude = fwd.lat;
            updateFields.longitude = fwd.lon;
          }
          if (Object.keys(updateFields).length > 0) {
            console.log(`  -> Forward geocoded: city="${updateFields.city || course.city}", state="${updateFields.state || course.state}"`);
            geocodedFromName++;
            success = true;
          } else {
            console.log(`  -> Forward geocode returned no useful data`);
          }
        } else {
          console.log(`  -> Forward geocode failed`);
        }
      }
    }

    if (success && Object.keys(updateFields).length > 0) {
      try {
        await updateCourse(course.id, updateFields);
        console.log(`  -> Updated successfully`);
        fixed++;
      } catch (err) {
        console.error(`  -> ERROR updating: ${err.message}`);
        couldNotFix.push({ name: course.name, reason: 'Update failed: ' + err.message });
      }
    } else {
      couldNotFix.push({
        name: course.name,
        reason: hasLatLon ? 'Geocoding returned no city/state' : 'No lat/lon and forward geocode failed'
      });
    }
  }

  console.log('\n========== SUMMARY ==========');
  console.log(`Total entries in DB: ${courses.length}`);
  console.log(`Garbage entries skipped: ${garbage.length}`);
  console.log(`Real golf courses: ${real.length}`);
  console.log(`Needed city/state fix: ${needsWork.length}`);
  console.log(`Fixed via reverse geocode (lat/lon): ${geocodedFromLatLon}`);
  console.log(`Fixed via forward geocode (name search): ${geocodedFromName}`);
  console.log(`Total fixed: ${fixed}`);
  console.log(`Could not fix: ${couldNotFix.length}`);

  if (couldNotFix.length > 0) {
    console.log('\nCourses that could NOT be fixed (manual review needed):');
    couldNotFix.forEach((c, i) => {
      console.log(`  ${i+1}. "${c.name}" — ${c.reason}`);
    });
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
