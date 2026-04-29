/**
 * Backfill latitude/longitude for courses that are missing coordinates.
 *
 * Strategy per course:
 *   1. Golf Course API search → lat/lng if available
 *   2. Nominatim (OpenStreetMap) geocoding fallback — free, no key needed
 *
 * Processes courses that have a description (already seeded) but no lat/lng.
 * Safe to re-run — skips any course that already has coordinates.
 *
 * Usage:
 *   node src/scripts/seed-latlng.mjs              # all seeded courses missing coords
 *   node src/scripts/seed-latlng.mjs --limit 100  # cap at 100 courses
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const { Client } = require("pg");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const db = new Client({ connectionString: process.env.DATABASE_URL });
const GOLF_API_KEY = process.env.GOLF_COURSE_API_KEY;

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : null;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function golfApiSearch(name) {
  if (!GOLF_API_KEY) return null;
  try {
    const res = await fetch(
      `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(name)}`,
      { headers: { Authorization: `Key ${GOLF_API_KEY}` } }
    );
    if (!res.ok) return null;
    const { courses } = await res.json();
    const match = (courses || [])[0];
    if (!match?.location?.latitude || !match?.location?.longitude) return null;
    return {
      lat: parseFloat(match.location.latitude),
      lng: parseFloat(match.location.longitude),
      source: "golf-api",
    };
  } catch {
    return null;
  }
}

async function nominatimGeocode(name, city, state) {
  try {
    const q = encodeURIComponent(`${name} golf ${city} ${state} USA`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=3&countrycodes=us`,
      { headers: { "User-Agent": "TourItGolf/1.0 corey@touritgolf.com" } }
    );
    if (!res.ok) return null;
    const results = await res.json();
    // Prefer results that mention "golf" in display_name
    const golfResult = results.find(r => /golf/i.test(r.display_name)) || results[0];
    if (!golfResult) return null;
    return {
      lat: parseFloat(golfResult.lat),
      lng: parseFloat(golfResult.lon),
      source: "nominatim",
    };
  } catch {
    return null;
  }
}

async function main() {
  await db.connect();

  const { rows: courses } = await db.query(
    `SELECT id, name, city, state FROM "Course"
     WHERE latitude IS NULL
       AND longitude IS NULL
       AND description IS NOT NULL
     ORDER BY "uploadCount" DESC, "createdAt" ASC
     ${LIMIT ? `LIMIT ${LIMIT}` : "LIMIT 5000"}`
  );

  console.log(`Found ${courses.length} seeded courses without coordinates`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];
    console.log(`[${i + 1}/${courses.length}] ${course.name} — ${course.city}, ${course.state}`);

    // Try Golf API first
    let coords = await golfApiSearch(course.name);

    // Nominatim fallback (rate-limited to 1 req/sec by OSM policy)
    if (!coords) {
      await sleep(1100);
      coords = await nominatimGeocode(course.name, course.city, course.state);
    }

    if (coords) {
      await db.query(
        `UPDATE "Course" SET latitude = $1, longitude = $2, "updatedAt" = $3 WHERE id = $4`,
        [coords.lat, coords.lng, new Date().toISOString(), course.id]
      );
      console.log(`  ✅ ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} (${coords.source})`);
      updated++;
    } else {
      console.log(`  ✗ No coordinates found`);
      failed++;
    }

    // Golf API rate limit buffer (250ms between calls)
    await sleep(coords?.source === "golf-api" ? 250 : 0);
  }

  await db.end();
  console.log(`\nDone. Updated: ${updated} | Failed: ${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
