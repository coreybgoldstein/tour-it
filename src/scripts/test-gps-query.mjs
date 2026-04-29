/**
 * Diagnostic: verify Fields Ranch lat/lng in DB and simulate the bounding box query.
 * Usage: node src/scripts/test-gps-query.mjs [lat] [lng]
 *
 * Defaults to approximate Frisco TX coords if no args given.
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

const args = process.argv.slice(2);
const testLat = args[0] ? parseFloat(args[0]) : 33.2068;
const testLng = args[1] ? parseFloat(args[1]) : -96.8499;

async function main() {
  await db.connect();

  // 1. Show Fields Ranch rows directly
  console.log("=== Fields Ranch rows ===");
  const { rows: fr } = await db.query(
    `SELECT id, name, city, state, latitude, longitude, "uploadCount"
     FROM "Course"
     WHERE name ILIKE '%fields ranch%'
     ORDER BY name`
  );
  if (fr.length === 0) {
    console.log("  (no rows found with name LIKE fields ranch)");
  }
  fr.forEach(r => console.log(`  ${r.name} | lat=${r.latitude} lng=${r.longitude} | uploads=${r.uploadCount}`));

  // 2. Simulate the bounding box query used in the upload page
  console.log(`\n=== Bounding box query (test coords: ${testLat}, ${testLng}) ===`);
  console.log(`  lat range: [${testLat - 0.1}, ${testLat + 0.1}]`);
  console.log(`  lng range: [${testLng - 0.1}, ${testLng + 0.1}]`);

  const { rows: bbox } = await db.query(
    `SELECT id, name, city, state, latitude, longitude, "uploadCount"
     FROM "Course"
     WHERE latitude >= $1 AND latitude <= $2
       AND longitude >= $3 AND longitude <= $4
     ORDER BY "uploadCount" DESC
     LIMIT 10`,
    [testLat - 0.1, testLat + 0.1, testLng - 0.1, testLng + 0.1]
  );
  if (bbox.length === 0) {
    console.log("  (0 courses returned by bounding box query)");
  }
  bbox.forEach(r => console.log(`  ${r.name} — ${r.city}, ${r.state} | lat=${r.latitude} lng=${r.longitude}`));

  // 3. Also show how many courses in the DB have lat/lng at all
  const { rows: [{ count }] } = await db.query(
    `SELECT COUNT(*) FROM "Course" WHERE latitude IS NOT NULL AND longitude IS NOT NULL`
  );
  console.log(`\n=== Courses with lat/lng in DB: ${count} ===`);

  await db.end();
}

main().catch(err => { console.error(err); process.exit(1); });
