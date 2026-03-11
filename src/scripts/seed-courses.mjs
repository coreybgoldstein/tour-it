import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { randomUUID } from "crypto";
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

// Top US destination courses to seed
const COURSES_TO_SEED = [
  "Pebble Beach Golf Links",
  "Pinehurst No 2",
  "Bandon Dunes",
  "TPC Sawgrass",
  "Kiawah Island Ocean Course",
  "Bethpage Black",
  "Torrey Pines South",
  "Whistling Straits",
  "Chambers Bay",
  "Streamsong Red",
  "Wolf Creek Golf Club",
  "TPC Scottsdale",
  "Cabot Cliffs",
  "Sand Hills Golf Club",
  "Shinnecock Hills",
  "Oakmont Country Club",
  "Augusta National",
  "Merion Golf Club",
  "Pacific Dunes",
  "Bandon Trails",
  "Old Macdonald",
  "Sea Island Seaside",
  "Harbour Town Golf Links",
  "Erin Hills",
  "Shadow Creek",
];

async function searchCourse(name) {
  const url = `https://golf-course-api.p.rapidapi.com/search?name=${encodeURIComponent(name)}`;
  const res = await fetch(url, {
    headers: {
      "x-rapidapi-host": "golf-course-api.p.rapidapi.com",
      "x-rapidapi-key": RAPIDAPI_KEY,
    },
  });
  if (!res.ok) {
    console.error(`Failed to fetch ${name}: ${res.status}`);
    return null;
  }
  const data = await res.json();
  console.log("  RAW RESPONSE:", JSON.stringify(data).slice(0, 300));
  return data?.courses?.[0] || data?.[0] || null;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function getTeeColor(abbr) {
  const map = {
    "PB": "#1a4a6e", "P2": "#3d2b1a", "BD": "#1a3a2a",
    "TPC": "#3a1a10", "SAW": "#0e2a1a", "KI": "#0e2e3a",
    "BPB": "#1a1a1a", "TP": "#1a3020", "AN": "#0d2e18",
    "WS": "#1a2a3a", "CB": "#2a2a1a", "SR": "#2e1a10",
    "WC": "#2e1a0e", "SC": "#1a0e2e", "CC": "#0e1e2e",
  };
  return map[abbr] || "#1a2a1a";
}

function getAbbr(name) {
  const words = name.replace(/[^a-zA-Z\s]/g, "").split(" ").filter(w => w.length > 2);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map(w => w[0]).join("").slice(0, 3).toUpperCase();
}

async function seedCourse(name) {
  console.log(`\nSearching: ${name}...`);
  const course = await searchCourse(name);

  if (!course) {
    console.log(`  ✗ Not found: ${name}`);
    return;
  }

  console.log(`  ✓ Found: ${course.club_name || course.name || name}`);

  const abbr = getAbbr(course.club_name || course.name || name);
  const slug = slugify(course.club_name || course.name || name);

    const now = new Date().toISOString();
  const courseData = {
    id: randomUUID(),
    name: course.club_name || course.name || name,
    slug,
    city: course.location?.city || course.city || "",
    state: course.location?.state || course.state || "",
    country: course.location?.country || "US",
    holeCount: course.holes || 18,
    isPublic: true,
    isVerified: true,
    uploadCount: 0,
    saveCount: 0,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  // Check if already exists
  const { data: existing } = await supabase
    .from("Course")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    console.log(`  → Already exists, skipping.`);
    return;
  }

  const { data, error } = await supabase.from("Course").insert(courseData).select().single();

  if (error) {
    console.error(`  ✗ DB error for ${name}:`, error.message);
    return;
  }

  console.log(`  ✓ Saved to DB: ${data.name} (id: ${data.id})`);

  // Add holes if scorecard data available
  if (course.scorecard && Array.isArray(course.scorecard)) {
    const holes = course.scorecard.map((hole, i) => ({
      courseId: data.id,
      holeNumber: hole.hole || i + 1,
      par: hole.par || 4,
      handicap: hole.handicap || i + 1,
      uploadCount: 0,
    }));

    const { error: holeError } = await supabase.from("Hole").insert(holes);
    if (holeError) {
      console.error(`  ✗ Hole insert error:`, holeError.message);
    } else {
      console.log(`  ✓ Added ${holes.length} holes`);
    }
  }

  // Rate limit — be nice to the API
  await new Promise(r => setTimeout(r, 500));
}

async function main() {
  console.log("🏌️  Tour It — Course Seeding Script");
  console.log("=====================================");
  console.log(`Seeding ${COURSES_TO_SEED.length} courses...\n`);

  let success = 0;
  let failed = 0;

  for (const name of COURSES_TO_SEED) {
    try {
      await seedCourse(name);
      success++;
    } catch (err) {
      console.error(`  ✗ Error seeding ${name}:`, err.message);
      failed++;
    }
  }

  console.log("\n=====================================");
  console.log(`✓ Done! ${success} seeded, ${failed} failed.`);
  console.log("Check your Supabase dashboard → Table Editor → Course");
}

main();
