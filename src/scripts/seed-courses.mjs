import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { randomUUID } from "crypto";
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

// ============================================================
// COURSES TO SEED — 200+ top US public & resort courses
// ============================================================
const COURSES_TO_SEED = [
  // --- Iconic / Bucket List ---
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
  "Streamsong Blue",
  "Streamsong Black",
  "Wolf Creek Golf Club",
  "TPC Scottsdale",
  "Cabot Cliffs",
  "Cabot Links",
  "Sand Hills Golf Club",
  "Shinnecock Hills Golf Club",
  "Pacific Dunes",
  "Bandon Trails",
  "Old Macdonald",
  "Sheep Ranch Bandon",
  "Bandon Preserve",
  "Sea Island Seaside Course",
  "Sea Island Plantation Course",
  "Harbour Town Golf Links",
  "Erin Hills",
  "Shadow Creek",
  "Gamble Sands",
  "Coeur d Alene Resort Golf Course",

  // --- TPC Network ---
  "TPC Deere Run",
  "TPC Four Seasons Las Colinas",
  "TPC Harding Park",
  "TPC Louisiana",
  "TPC River Highlands",
  "TPC San Antonio AT&T Oaks",
  "TPC San Antonio Canyons",
  "TPC Southwind",
  "TPC Sugarloaf",
  "TPC Twin Cities",
  "TPC Wisconsin",
  "TPC Boston",
  "TPC Craig Ranch",
  "TPC Summerlin",

  // --- Top Public Courses by Region ---

  // Southeast
  "Augusta National Golf Club",
  "Harbour Town Golf Links Hilton Head",
  "Hammock Beach Resort Ocean Course",
  "World Woods Pine Barrens",
  "World Woods Rolling Oaks",
  "TPC Tampa Bay",
  "Streamsong Resort",
  "Innisbrook Copperhead",
  "Innisbrook Island",
  "Bay Hill Club",
  "Orange County National Panther Lake",
  "Orange County National Crooked Cat",
  "Reynolds Lake Oconee Great Waters",
  "Reynolds Lake Oconee Oconee",
  "Primm Valley Golf Club Desert",
  "Grayhawk Golf Club Raptor",
  "Grayhawk Golf Club Talon",
  "We-Ko-Pa Golf Club Saguaro",
  "We-Ko-Pa Golf Club Cholla",
  "Quintero Golf Club",
  "Verrado Golf Club",
  "Wigwam Golf Club Gold",
  "Troon North Monument",
  "Troon North Pinnacle",
  "Desert Willow Firecliff",
  "Desert Willow Mountain View",
  "The Legacy Golf Club Henderson",
  "Rio Secco Golf Club",
  "Reflection Bay Golf Club",
  "Royal Links Golf Club",
  "Bali Hai Golf Club",

  // Mid-Atlantic / Northeast
  "Bethpage Red",
  "Bethpage Yellow",
  "Bethpage Green",
  "Baltusrol Golf Club Lower",
  "Merion Golf Club East",
  "Oakmont Country Club",
  "Congressional Blue Course",
  "Bulle Rock Golf Course",
  "Tobacco Road Golf Club",
  "Pinehurst No 4",
  "Pinehurst No 8",
  "Mid Pines Inn Golf Club",
  "Pine Needles Lodge Golf Club",
  "Sedgefield Country Club",
  "Quail Hollow Club",
  "Bald Head Island Club",
  "Talamore Golf Resort",

  // Midwest
  "Whistling Straits Irish Course",
  "Blackwolf Run River Course",
  "Blackwolf Run Meadow Valleys",
  "Kohler Straits Course",
  "Erin Hills Golf Course",
  "University Ridge Golf Course",
  "SentryWorld Golf Course",
  "Lawsonia Golf Course Links",
  "Cog Hill Golf Club Dubsdread",
  "Prairie Landing Golf Club",
  "Cantigny Golf Club Woodside",
  "Geneva National Golf Club Player",
  "Geneva National Golf Club Palmer",
  "Bog Golf Course",
  "Eagle Eye Golf Club",
  "Forest Dunes Golf Club",
  "The Loop Forest Dunes",
  "Black Bear Golf Club",
  "Arcadia Bluffs Golf Club South",
  "Arcadia Bluffs Golf Club West",
  "Crystal Downs Country Club",
  "Boyne Highlands Heather",
  "Boyne Highlands Arthur Hills",
  "The Bear Golf Course",
  "StoneWater Golf Club",
  "Firestone Country Club South",
  "Muirfield Village Golf Club",
  "Ohio State Scarlet Course",

  // Southwest / Mountain
  "Paiute Golf Resort Snow Mountain",
  "Paiute Golf Resort Sun Mountain",
  "Paiute Golf Resort Wolf",
  "Edgewood Tahoe Golf Course",
  "Incline Village Championship",
  "Red Hawk Golf and Resort",
  "Talking Stick Golf Club O'odham",
  "Talking Stick Golf Club Piipaash",
  "Papago Golf Course",
  "Raven Golf Club Phoenix",
  "Starfire Golf Club",
  "Anthem Golf and Country Club",
  "Conquistador Golf Course",
  "Ventana Canyon Mountain",
  "Ventana Canyon Canyon",
  "La Paloma Golf Club",
  "Omni Tucson National Sonoran",
  "Omni Tucson National Catalina",
  "SaddleBrooke Ranch Golf Club",
  "Randolph North Golf Course",
  "Encanto Golf Course",

  // West Coast
  "Pebble Beach Golf Links",
  "Spyglass Hill Golf Course",
  "Monterey Peninsula Country Club Shore",
  "Poppy Hills Golf Course",
  "Bayonet Golf Course",
  "Blackhorse Golf Course",
  "Pasatiempo Golf Club",
  "Cordevalle Golf Club",
  "Half Moon Bay Golf Links Ocean",
  "Half Moon Bay Golf Links Old",
  "Harding Park Golf Course",
  "Presidio Golf Course",
  "Torrey Pines North",
  "La Costa Resort Legends",
  "Aviara Golf Club",
  "Pelican Hill Golf Club Ocean North",
  "Pelican Hill Golf Club Ocean South",
  "Newport Beach Country Club",
  "Riviera Country Club",
  "Sherwood Country Club",
  "Spanish Bay Golf Links",
  "Carmel Valley Ranch Golf Club",

  // Pacific Northwest
  "Salish Cliffs Golf Club",
  "Gold Mountain Golf Club Olympic",
  "Trophy Lake Golf and Casting",
  "The Reserve Vineyards North",
  "The Reserve Vineyards South",
  "Pumpkin Ridge Ghost Creek",
  "Pumpkin Ridge Witch Hollow",
  "Langdon Farms Golf Club",
  "Bandon Crossings Golf Course",
  "Sunriver Resort Meadows",
  "Sunriver Resort Woodlands",
  "Running Y Ranch Golf Course",
  "Crosswater Golf Club",

  // Texas
  "Cowboys Golf Club",
  "Whispering Pines Golf Club",
  "The Tribute Golf Links",
  "Tour 18 Golf Course Dallas",
  "Barton Creek Fazio Canyons",
  "Barton Creek Fazio Foothills",
  "Barton Creek Palmer Lakeside",
  "Barton Creek Coore Crenshaw",
  "Wolfdancer Golf Club",
  "Horseshoe Bay Resort Ram Rock",
  "Horseshoe Bay Resort Apple Rock",
  "Horseshoe Bay Resort Slick Rock",
  "La Cantera Golf Club Resort",
  "La Cantera Golf Club Palmer",
  "Firewheel Golf Park Bridges",
  "Firewheel Golf Park Lakes",
  "Crockett Creek Golf Club",

  // Colorado / Utah / Mountain West
  "Keystone Ranch Golf Course",
  "Breckenridge Golf Club",
  "Vail Golf Club",
  "Arrowhead Golf Club",
  "Raccoon Creek Golf Course",
  "Red Hawk Ridge Golf Course",
  "Murphy Creek Golf Course",
  "The Ridge at Castle Pines North",
  "Sanctuary Golf Course",
  "Deer Creek Golf Club",
  "Fossil Trace Golf Club",
  "Buffalo Run Golf Course",
  "Pole Creek Golf Club Ridge",
  "Pole Creek Golf Club Ranch",
  "Poplar Creek Golf Course",
  "Coral Canyon Golf Course",
  "Entrada at Snow Canyon",
  "Green Spring Golf Course",
  "Thanksgiving Point Golf Club",
  "Wolf Creek Golf Club Mesquite",

  // Hawaii
  "Mauna Kea Golf Course",
  "Mauna Lani South Course",
  "Mauna Lani North Course",
  "Waikoloa Beach Golf Course",
  "Waikoloa Kings Golf Course",
  "Hualalai Golf Course",
  "Kapalua Plantation Course",
  "Kapalua Bay Course",
  "Kaanapali Royal Course",
  "Wailea Gold Course",
  "Wailea Emerald Course",
  "Poipu Bay Golf Course",
  "Princeville Makai Golf Course",
  "Ko Olina Golf Club",
  "Turtle Bay Arnold Palmer",

  // Carolinas / Virginia / Tennessee
  "Pinehurst No 6",
  "Pinehurst No 7",
  "Pinehurst No 9",
  "True Blue Golf Club",
  "Caledonia Golf Fish Club",
  "Pawleys Plantation Golf Club",
  "King Bees Golf Club",
  "Barefoot Resort Dye Course",
  "Barefoot Resort Love Course",
  "Barefoot Resort Fazio Course",
  "Barefoot Resort Norman Course",
  "Grande Dunes Members Club",
  "Myrtle Beach National Kings North",
  "Myrtle Beach National West",
  "TPC Myrtle Beach",
  "Legends Golf Resort Heathland",
  "Legends Golf Resort Parkland",
  "Legends Golf Resort Moorland",
  "Kiawah Island Cougar Point",
  "Kiawah Island Oak Point",
  "Kiawah Island Osprey Point",
  "Kiawah Island Turtle Point",
  "The Golf Club at Cuscowilla",
  "Primland Highland Golf Course",
];

// Remove duplicates
const UNIQUE_COURSES = [...new Set(COURSES_TO_SEED)];

async function searchCourse(name) {
  if (!RAPIDAPI_KEY) {
    console.error("  ✗ RAPIDAPI_KEY not set in .env");
    return null;
  }
  const url = `https://golf-course-api.p.rapidapi.com/search?name=${encodeURIComponent(name)}`;
  const res = await fetch(url, {
    headers: {
      "x-rapidapi-host": "golf-course-api.p.rapidapi.com",
      "x-rapidapi-key": RAPIDAPI_KEY,
    },
  });
  if (!res.ok) {
    console.error(`  ✗ API error for ${name}: ${res.status}`);
    return null;
  }
  const data = await res.json();
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

// Build 18 default holes when the API has no scorecard data
// Standard par distribution: 2x par 5, 4x par 3, 12x par 4
function buildDefaultHoles(courseId) {
  const pars = [4,4,3,4,4,3,4,5,4, 4,4,3,4,4,3,4,5,4];
  const now = new Date().toISOString();
  return pars.map((par, i) => ({
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

async function seedCourse(name) {
  console.log(`\nSearching: ${name}...`);
  const course = await searchCourse(name);
  const now = new Date().toISOString();

  const courseName = course?.club_name || course?.name || name;
  const slug = slugify(courseName);

  // Check if already exists
  const { data: existing } = await supabase
    .from("Course")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    console.log(`  → Already exists, skipping.`);
    return "skipped";
  }

  const courseData = {
    id: randomUUID(),
    name: courseName,
    slug,
    city: course?.location?.city || course?.city || "",
    state: course?.location?.state || course?.state || "",
    country: course?.location?.country || "US",
    holeCount: course?.holes || 18,
    isPublic: true,
    isVerified: false,
    uploadCount: 0,
    saveCount: 0,
    viewCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const { data, error } = await supabase.from("Course").insert(courseData).select().single();

  if (error) {
    console.error(`  ✗ DB error for ${name}:`, error.message);
    return "failed";
  }

  console.log(`  ✓ Saved: ${data.name}`);

  // Build holes — use scorecard if available, fallback to default 18
  let holes;
  if (course?.scorecard && Array.isArray(course.scorecard) && course.scorecard.length > 0) {
    holes = course.scorecard.map((hole, i) => ({
      id: randomUUID(),
      courseId: data.id,
      holeNumber: hole.hole || i + 1,
      par: hole.par || 4,
      handicapRank: hole.handicap || i + 1,
      uploadCount: 0,
      createdAt: now,
      updatedAt: now,
    }));
    console.log(`  ✓ Using scorecard data (${holes.length} holes)`);
  } else {
    holes = buildDefaultHoles(data.id);
    console.log(`  ✓ Using default 18 holes (no scorecard from API)`);
  }

  const { error: holeError } = await supabase.from("Hole").insert(holes);
  if (holeError) {
    console.error(`  ✗ Hole insert error:`, holeError.message);
  } else {
    console.log(`  ✓ ${holes.length} holes added`);
  }

  await new Promise(r => setTimeout(r, 600));
  return "success";
}

async function main() {
  console.log("🏌️  Tour It — Course Seeding Script");
  console.log("=====================================");
  console.log(`Seeding ${UNIQUE_COURSES.length} courses...\n`);

  let success = 0, skipped = 0, failed = 0;

  for (const name of UNIQUE_COURSES) {
    try {
      const result = await seedCourse(name);
      if (result === "success") success++;
      else if (result === "skipped") skipped++;
      else failed++;
    } catch (err) {
      console.error(`  ✗ Error seeding ${name}:`, err.message);
      failed++;
    }
  }

  console.log("\n=====================================");
  console.log(`✓ Done! ${success} added, ${skipped} skipped, ${failed} failed.`);
  console.log("Check your Supabase dashboard → Table Editor → Course");
}

main();
