import https from "https";

const SUPABASE_URL = "awlbxzpevwidowxxvuef.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bGJ4enBldndpZG93eHh2dWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxODQ5OSwiZXhwIjoyMDg4NTk0NDk5fQ.TU53et5QL6MwLmcv1wQNwDMLtjp62xaLSrElrCpGV0I";

const STATE_MAP = {
  "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO",
  "Connecticut":"CT","Delaware":"DE","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID",
  "Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA",
  "Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN",
  "Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV",
  "New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY",
  "North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR",
  "Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",
  "Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA",
  "Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY",
  "District of Columbia":"DC","Puerto Rico":"PR","Guam":"GU",
};

const JUNK = /FAIRWAY|TEE BOX|^#\d|^\d+(ST|ND|RD|TH)\s|Tee Red|Tee White|BUNKER|HAZARD/i;

function get(hostname, path, headers = {}, retries = 3) {
  return new Promise((resolve) => {
    const attempt = (n) => {
      const req = https.request({ hostname, path, method: "GET", headers: { "User-Agent": "TourItGolfApp/1.0", ...headers } }, res => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => {
          try { resolve(JSON.parse(data)); } catch { resolve(null); }
        });
      });
      req.on("error", async (e) => {
        if (n > 0) { await sleep(2000); attempt(n - 1); }
        else { console.log("  GET failed:", e.code); resolve(null); }
      });
      req.setTimeout(15000, () => { req.destroy(); if (n > 0) { sleep(2000).then(() => attempt(n - 1)); } else resolve(null); });
      req.end();
    };
    attempt(retries);
  });
}

function patch(id, body, retries = 3) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const attempt = (n) => {
      const req = https.request({
        hostname: SUPABASE_URL,
        path: `/rest/v1/Course?id=eq.${id}`,
        method: "PATCH",
        headers: {
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "Prefer": "return=minimal",
        }
      }, res => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => resolve(res.statusCode));
      });
      req.on("error", async (e) => {
        if (n > 0) { await sleep(2000); attempt(n - 1); }
        else { console.log("  PATCH error:", e.code); resolve(0); }
      });
      req.setTimeout(15000, () => { req.destroy(); if (n > 0) { sleep(2000).then(() => attempt(n - 1)); } else resolve(0); });
      req.write(payload);
      req.end();
    };
    attempt(retries);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchAllBlank() {
  const all = [];
  let offset = 0;
  while (true) {
    const batch = await get(SUPABASE_URL,
      `/rest/v1/Course?city=eq.&select=id,name,city,state,latitude,longitude&limit=1000&offset=${offset}&order=name.asc`,
      { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` }
    );
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 1000) break;
    offset += 1000;
  }
  return all;
}

async function reverseGeocode(lat, lon) {
  const result = await get("nominatim.openstreetmap.org",
    `/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`
  );
  if (!result || !result.address) return null;
  const a = result.address;
  const city = a.city || a.town || a.village || a.municipality || a.suburb || a.county || "";
  const stateFull = a.state || "";
  const state = STATE_MAP[stateFull] || (stateFull.length === 2 ? stateFull : "");
  return { city, state };
}

async function main() {
  console.log("Fetching all courses with blank city...");
  const courses = await fetchAllBlank();
  const real = courses.filter(c => !JUNK.test(c.name));
  console.log(`Total blank: ${courses.length}, Real courses: ${real.length}`);

  let fixed = 0, failed = 0;

  for (let i = 0; i < real.length; i++) {
    const c = real[i];
    if (!c.latitude && !c.longitude) { failed++; continue; }

    const geo = await reverseGeocode(c.latitude, c.longitude);
    await sleep(1100); // Nominatim rate limit

    if (!geo || !geo.city) { failed++; console.log(`  FAIL: ${c.name}`); continue; }

    const update = {};
    if (!c.city) update.city = geo.city;
    if (!c.state && geo.state) update.state = geo.state;

    const status = await patch(c.id, update);
    if (status === 204 || status === 200) {
      fixed++;
      if (fixed % 25 === 0) console.log(`  [${i+1}/${real.length}] Fixed ${fixed} so far...`);
    } else {
      failed++;
      console.log(`  PATCH failed (${status}): ${c.name}`);
    }
  }

  console.log(`\nDone. Fixed: ${fixed}, Failed: ${failed}`);
}

main().catch(console.error);
