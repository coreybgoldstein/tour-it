/**
 * Resets and re-seeds descriptions for all courses that were previously seeded
 * with the old prompt (which could hallucinate details).
 *
 * Reads popular-seed-progress.json for the list of already-processed course IDs,
 * clears their description, yearEstablished, and courseType, then re-runs the full
 * Wikipedia + Golf API pipeline on each one.
 *
 * Usage: node src/scripts/reseed-descriptions.mjs
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const { Client } = require("pg");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const db = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await db.connect();

  // Get all course IDs from the progress file
  const progressFile = path.resolve(__dirname, "../../popular-seed-progress.json");
  const progress = fs.existsSync(progressFile)
    ? JSON.parse(fs.readFileSync(progressFile, "utf-8"))
    : { done: [] };

  const ids = progress.done;
  if (!ids.length) {
    console.log("No courses in progress file to re-seed.");
    await db.end();
    return;
  }

  console.log(`Resetting descriptions for ${ids.length} previously seeded courses...`);

  // Clear description (and derived fields) so processCourseById re-runs them
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
  await db.query(
    `UPDATE "Course" SET description = NULL, "yearEstablished" = NULL, "courseType" = NULL
     WHERE id IN (${placeholders})`,
    ids
  );
  console.log(`Cleared. Re-seeding now...\n`);

  await db.end();

  // Reset progress file so --popular re-processes them
  fs.writeFileSync(progressFile, JSON.stringify({ done: [] }, null, 2));

  // Re-run the seeder on all of them
  execSync(
    `node ${path.resolve(__dirname, "seed-courses-v2.mjs")} --popular --limit ${ids.length}`,
    { stdio: "inherit", cwd: path.resolve(__dirname, "../..") }
  );
}

main().catch(err => { console.error(err); process.exit(1); });
