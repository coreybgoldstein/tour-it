#!/usr/bin/env node

/**
 * Tour It — List Courses in Radius
 *
 * Lists Course IDs within a geographic radius of a center point, using the haversine
 * formula. Only considers courses that already have non-null lat/lng. Optionally
 * filters to those still missing one of {description, coverImageUrl, logoUrl,
 * yearEstablished}.
 *
 * Usage:
 *   node src/scripts/list-courses-radius.mjs --lat 34.0007 --lng -81.0348 --radius 100 \
 *     --missing-data --out columbia-radius-ids.txt
 *
 * Output: one course ID per line (stdout or --out file).
 * Summary (counts, top cities/states) is logged to stderr.
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { lat: null, lng: null, radius: 100, missingData: false, out: null, states: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--lat") out.lat = parseFloat(args[i + 1]);
    if (args[i] === "--lng") out.lng = parseFloat(args[i + 1]);
    if (args[i] === "--radius") out.radius = parseFloat(args[i + 1]);
    if (args[i] === "--missing-data") out.missingData = true;
    if (args[i] === "--out") out.out = args[i + 1];
    if (args[i] === "--states") out.states = args[i + 1].split(",").map((s) => s.trim().toUpperCase());
  }
  return out;
}

// haversine — miles
function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.7613;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function fetchAllCoursesWithGeo(states) {
  // Page through all rows with non-null lat/lng. Supabase default cap is 1000.
  const PAGE = 1000;
  let from = 0;
  const all = [];
  while (true) {
    let q = supabase
      .from("Course")
      .select("id, name, city, state, latitude, longitude, description, coverImageUrl, logoUrl, yearEstablished")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (states && states.length) q = q.in("state", states);

    const { data, error } = await q;
    if (error) throw new Error(`DB query failed: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function countNullGeoInStates(states) {
  if (!states || !states.length) return null;
  const { count, error } = await supabase
    .from("Course")
    .select("id", { count: "exact", head: true })
    .in("state", states)
    .or("latitude.is.null,longitude.is.null");
  if (error) return null;
  return count;
}

async function main() {
  const args = parseArgs();
  if (args.lat == null || args.lng == null) {
    console.error("Usage: --lat <num> --lng <num> --radius <miles> [--missing-data] [--out file] [--states SC,NC,GA]");
    process.exit(1);
  }

  // Default to SC/NC/GA filter when targeting Columbia, SC region — narrows the
  // query substantially without changing the radius result for this center.
  const states = args.states || ["SC", "NC", "GA"];

  console.error(
    `Querying Course table (states=${states.join(",")}, with lat/lng)...`
  );
  const rows = await fetchAllCoursesWithGeo(states);
  console.error(`Got ${rows.length} candidate rows with lat/lng in ${states.join(",")}`);

  const nullGeoCount = await countNullGeoInStates(states);
  if (nullGeoCount != null) {
    console.error(
      `Note: ${nullGeoCount} courses in ${states.join(",")} have null lat/lng and are NOT considered. ` +
        `The bulk seeder will fill lat/lng as it processes courses, so a second pass will catch some.`
    );
  }

  const inRadius = [];
  for (const r of rows) {
    const lat = Number(r.latitude);
    const lng = Number(r.longitude);
    if (!isFinite(lat) || !isFinite(lng)) continue;
    const d = haversineMiles(args.lat, args.lng, lat, lng);
    if (d <= args.radius) inRadius.push({ ...r, distance: d });
  }
  inRadius.sort((a, b) => a.distance - b.distance);

  console.error(`In radius (${args.radius} mi): ${inRadius.length}`);

  let target = inRadius;
  if (args.missingData) {
    target = inRadius.filter(
      (r) => !r.description || !r.coverImageUrl || !r.logoUrl || !r.yearEstablished
    );
    console.error(`Missing one of {description, coverImageUrl, logoUrl, yearEstablished}: ${target.length}`);
  }

  // Top cities/states
  const cityCounts = {};
  const stateCounts = {};
  for (const r of target) {
    const key = `${r.city || "?"}, ${r.state || "?"}`;
    cityCounts[key] = (cityCounts[key] || 0) + 1;
    stateCounts[r.state || "?"] = (stateCounts[r.state || "?"] || 0) + 1;
  }
  const topCities = Object.entries(cityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const topStates = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]);

  console.error("\nTop 10 cities (target set):");
  for (const [city, n] of topCities) console.error(`  ${n.toString().padStart(4)}  ${city}`);
  console.error("\nState breakdown (target set):");
  for (const [st, n] of topStates) console.error(`  ${n.toString().padStart(4)}  ${st}`);

  const ids = target.map((r) => r.id);
  const text = ids.join("\n") + "\n";
  if (args.out) {
    writeFileSync(args.out, text);
    console.error(`\nWrote ${ids.length} IDs to ${args.out}`);
  } else {
    process.stdout.write(text);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
