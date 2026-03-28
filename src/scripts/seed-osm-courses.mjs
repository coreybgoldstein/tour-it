import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { randomUUID } from "crypto";
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================================
// OpenStreetMap Overpass API — free, no key needed
// Pulls every golf course tagged in the US
// ============================================================

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Standard par distribution for 18 holes when no scorecard available
// 2x par 5, 4x par 3, 12x par 4 — spread naturally across the round
const DEFAULT_PARS = [4,4,3,4,4,3,4,5,4, 4,4,3,4,4,3,4,5,4];

function buildDefaultHoles(courseId) {
  const now = new Date().toISOString();
  return DEFAULT_PARS.map((par, i) => ({
    id: randomUUID(),
    courseId,
    holeNumber: i + 1,
    par,
    handicapRank: i + 1,
    uploadCount: 0,
    createdAt: now,
    updatedAt: now,
  }));
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 100);
}

// US state abbreviation lookup from full name
const STATE_ABBR = {
  "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA",
  "Colorado":"CO","Connecticut":"CT","Delaware":"DE","Florida":"FL","Georgia":"GA",
  "Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA",
  "Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD",
  "Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO",
  "Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ",
  "New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH",
  "Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC",
  "South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT",
  "Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY",
  "District of Columbia":"DC","Puerto Rico":"PR","Guam":"GU","Virgin Islands":"VI",
};

function normalizeState(raw) {
  if (!raw) return "";
  const trimmed = raw.trim();
  // Already an abbreviation
  if (trimmed.length === 2) return trimmed.toUpperCase();
  // Full name
  return STATE_ABBR[trimmed] || trimmed.slice(0, 2).toUpperCase();
}

async function fetchOSMCourses() {
  console.log("Querying OpenStreetMap Overpass API...");
  console.log("(This may take 30-60 seconds — pulling all US golf courses)\n");

  // Query for golf courses in the US
  // leisure=golf_course covers full courses; we also grab club_house nodes with golf tags
  const query = `
    [out:json][timeout:120];
    area["ISO3166-1"="US"][admin_level=2]->.us;
    (
      way["leisure"="golf_course"](area.us);
      relation["leisure"="golf_course"](area.us);
    );
    out center tags;
  `;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) {
    throw new Error(`Overpass API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  console.log(`✓ OSM returned ${data.elements?.length || 0} raw elements\n`);
  return data.elements || [];
}

function parseOSMElement(el) {
  const tags = el.tags || {};

  // Must have a name
  const name = tags.name || tags["name:en"];
  if (!name) return null;

  // Skip non-golf things that sneak through
  const nameLower = name.toLowerCase();
  if (nameLower.includes("mini golf") || nameLower.includes("miniature golf") ||
      nameLower.includes("mini-golf") || nameLower.includes("putting green") ||
      nameLower.includes("disc golf") || nameLower.includes("frisbee")) {
    return null;
  }

  // Get coordinates
  let lat = null, lng = null;
  if (el.center) { lat = el.center.lat; lng = el.center.lon; }
  else if (el.lat) { lat = el.lat; lng = el.lon; }

  // Parse address fields
  const city = tags["addr:city"] || tags["addr:town"] || tags["addr:village"] || "";
  const stateRaw = tags["addr:state"] || tags["addr:province"] || "";
  const state = normalizeState(stateRaw);
  const country = tags["addr:country"] || "US";

  // Skip non-US
  if (country && country !== "US" && country !== "United States") return null;

  // Hole count
  const holeCount = parseInt(tags.holes) || 18;

  // Determine if public/private
  const access = tags.access || tags["golf:type"] || "";
  const isPublic = !["private", "members", "restricted"].includes(access.toLowerCase());

  return { name, city, state, lat, lng, holeCount, isPublic };
}

async function insertBatch(courses) {
  if (courses.length === 0) return { inserted: 0, errors: 0 };

  const now = new Date().toISOString();
  const rows = courses.map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    city: c.city,
    state: c.state,
    country: "US",
    latitude: c.lat,
    longitude: c.lng,
    holeCount: c.holeCount,
    isPublic: c.isPublic,
    isVerified: false,
    uploadCount: 0,
    saveCount: 0,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
  }));

  const { data, error } = await supabase
    .from("Course")
    .upsert(rows, { onConflict: "slug", ignoreDuplicates: true })
    .select("id, name, slug");

  if (error) {
    console.error("Batch insert error:", error.message);
    return { inserted: 0, errors: courses.length };
  }

  return { inserted: data?.length || 0, errors: 0 };
}

async function insertHolesBatch(allHoles) {
  if (allHoles.length === 0) return;

  // Insert in chunks of 500 to avoid payload limits
  const CHUNK = 500;
  for (let i = 0; i < allHoles.length; i += CHUNK) {
    const chunk = allHoles.slice(i, i + CHUNK);
    const { error } = await supabase.from("Hole").upsert(chunk, { onConflict: "courseId,holeNumber", ignoreDuplicates: true });
    if (error) console.error(`Hole chunk error:`, error.message);
  }
}

async function main() {
  console.log("🏌️  Tour It — OSM Course Import");
  console.log("===================================\n");

  // 1. Fetch from OSM
  let elements;
  try {
    elements = await fetchOSMCourses();
  } catch (err) {
    console.error("Failed to fetch from OSM:", err.message);
    console.error("Try again in a few minutes — Overpass can be slow under load.");
    process.exit(1);
  }

  // 2. Parse and deduplicate by slug
  const slugsSeen = new Set();
  const parsed = [];

  for (const el of elements) {
    const course = parseOSMElement(el);
    if (!course) continue;

    const slug = slugify(course.name);
    if (!slug || slug.length < 3) continue;
    if (slugsSeen.has(slug)) continue;
    slugsSeen.add(slug);

    parsed.push({ ...course, id: randomUUID(), slug });
  }

  console.log(`✓ ${parsed.length} valid unique courses parsed from OSM\n`);

  // 3. Check existing slugs in DB to skip re-inserting
  console.log("Checking existing courses in DB...");
  const { data: existingRows } = await supabase.from("Course").select("slug");
  const existingSlugs = new Set(existingRows?.map(r => r.slug) || []);
  console.log(`  ${existingSlugs.size} courses already in DB\n`);

  const toInsert = parsed.filter(c => !existingSlugs.has(c.slug));
  console.log(`→ ${toInsert.length} new courses to insert\n`);

  if (toInsert.length === 0) {
    console.log("Nothing to insert — all courses already exist.");
    return;
  }

  // 4. Insert courses in batches of 100
  const BATCH = 100;
  let totalInserted = 0;
  let totalErrors = 0;
  const insertedCourses = [];

  console.log("Inserting courses...");
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { inserted, errors } = await insertBatch(batch);
    totalInserted += inserted;
    totalErrors += errors;
    insertedCourses.push(...batch);

    const pct = Math.round(((i + batch.length) / toInsert.length) * 100);
    process.stdout.write(`\r  Progress: ${i + batch.length}/${toInsert.length} (${pct}%)`);
  }
  console.log(`\n✓ ${totalInserted} courses inserted, ${totalErrors} errors\n`);

  // 5. Build and insert default holes for all new courses
  console.log("Building default holes for new courses...");
  const allHoles = [];
  for (const course of insertedCourses) {
    const holes = buildDefaultHoles(course.id);
    allHoles.push(...holes);
  }

  console.log(`Inserting ${allHoles.length} holes in batches...`);
  await insertHolesBatch(allHoles);
  console.log(`✓ Holes inserted\n`);

  console.log("===================================");
  console.log(`✓ Import complete!`);
  console.log(`  ${totalInserted} new courses added`);
  console.log(`  ${totalInserted * 18} holes created`);
  console.log(`  ${existingSlugs.size + totalInserted} total courses in DB`);
  console.log("\nCheck your Supabase dashboard → Table Editor → Course");
}

main();
