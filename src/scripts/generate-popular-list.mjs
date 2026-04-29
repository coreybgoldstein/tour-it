/**
 * Generates src/data/popular-courses-us.json
 *
 * For each US state, asks Claude Haiku for the top public/resort/municipal golf
 * courses, then cross-references against the DB. Only courses that exist in the DB
 * are written to the output file (no inserts — just a prioritized seed queue).
 *
 * Usage: node src/scripts/generate-popular-list.mjs
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
const { Client } = require("pg");
const Anthropic = require("@anthropic-ai/sdk");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
const db = new Client({ connectionString: process.env.DATABASE_URL });

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

// How many courses to request per state (varies by golf density)
const HIGH_GOLF_STATES = new Set(["FL","CA","AZ","TX","NC","SC","GA","NY","NJ","PA","OH","MI","IL","CO","VA","TN"]);

async function getTopCoursesForState(state) {
  const count = HIGH_GOLF_STATES.has(state) ? 30 : 15;
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: `List the ${count} most popular and well-known golf courses in ${state}, USA.
Focus on public, semi-private, resort, and municipal courses that regular golfers can book and play.
Include TPC courses, resort courses, and highly-rated public courses.
Return ONLY a JSON array, no other text:
[{"name":"Full Course Name","city":"City Name"}]`,
    }],
  });

  const text = msg.content.find(b => b.type === "text")?.text?.trim() || "[]";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const courses = JSON.parse(jsonMatch[0]);
    return courses.map(c => ({ name: c.name, city: c.city, state }));
  } catch {
    return [];
  }
}

async function findInDB(name, city, state) {
  // Try exact name + city first, then just name + state
  const { rows } = await db.query(
    `SELECT id, name, city, state FROM "Course"
     WHERE state = $1
       AND (
         (name ILIKE $2 AND city ILIKE $3)
         OR name ILIKE $2
         OR name ILIKE $4
       )
     LIMIT 1`,
    [state, `%${name}%`, `%${city}%`, name]
  );
  return rows[0] || null;
}

async function main() {
  await db.connect();

  const outputPath = path.resolve(__dirname, "../../src/data/popular-courses-us.json");
  const dataDir = path.dirname(outputPath);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  // Resume: load existing output if it exists
  let existing = [];
  if (fs.existsSync(outputPath)) {
    existing = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    console.log(`Resuming — ${existing.length} courses already in list`);
  }
  const existingIds = new Set(existing.map(c => c.id));
  const processedStates = new Set(existing.map(c => c.state));

  const results = [...existing];
  let added = 0, skipped = 0;

  for (const state of STATES) {
    if (processedStates.has(state)) {
      console.log(`${state}: already processed (skipping)`);
      continue;
    }

    console.log(`\n${state}: asking Haiku for top courses...`);
    let courses;
    try {
      courses = await getTopCoursesForState(state);
    } catch (err) {
      console.log(`  ✗ Haiku error: ${err.message}`);
      continue;
    }
    console.log(`  Got ${courses.length} suggestions — matching against DB...`);

    for (const course of courses) {
      const match = await findInDB(course.name, course.city, course.state);
      if (!match) { skipped++; continue; }
      if (existingIds.has(match.id)) continue;
      existingIds.add(match.id);
      results.push({ id: match.id, name: match.name, city: match.city, state: match.state });
      added++;
      console.log(`  ✅ ${match.name} — ${match.city}, ${match.state}`);
    }

    // Save after each state so we can resume on crash
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`  Saved. Total: ${results.length}`);

    // Brief pause between states
    await new Promise(r => setTimeout(r, 1000));
  }

  await db.end();
  console.log(`\nDone. ${results.length} courses in list (+${added} new, ${skipped} not in DB).`);
  console.log(`Output: ${outputPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
