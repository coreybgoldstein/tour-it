#!/usr/bin/env node

/**
 * Tour It — Phase 2 Itinerary Seeder
 *
 * Creates the 14 trip itineraries + their stops.
 *
 * Hard rules per the brief:
 *   - Look up every course by name (case-insensitive). No hardcoded IDs.
 *   - If any name fails to resolve to exactly one row → throw and stop.
 *   - Compute itinerary lat/lng as centroid of all its stops' coords.
 *   - Idempotent: re-running deletes existing TripItinerary by slug (stops cascade) then inserts.
 *   - Do not modify any Course rows.
 *
 * Run: node prisma/seed-itineraries.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import dotenv from "dotenv";

dotenv.config();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Course lookup map ─────────────────────────────────────────────────────────
// Brief display name → exact DB name + state. Lookup uses case-insensitive
// equality on `name` (ilike with no wildcards) and a state filter for safety.
//
// Names below were captured from phase1-final-state.json (the post-Phase-1
// snapshot). They are the exact strings as stored in the DB right now.

const COURSE_LOOKUP = {
  "Pebble Beach Golf Links":              { dbName: "Pebble Beach Golf Course",                                  state: "CA" },
  "Spyglass Hill Golf Course":            { dbName: "Spyglass Hill Golf Course",                                 state: "CA" },
  "The Links at Spanish Bay":             { dbName: "The Links at Spanish Bay",                                  state: "CA" },
  "Bandon Dunes":                         { dbName: "Bandon Dunes Golf Resort",                                  state: "OR" },
  "Pacific Dunes":                        { dbName: "Pacific Dunes",                                             state: "OR" },
  "Old Macdonald":                        { dbName: "Old Macdonald",                                             state: "OR" },
  "Bandon Trails":                        { dbName: "Bandon Trails",                                             state: "OR" },
  "Sheep Ranch":                          { dbName: "Bandon Sheep Ranch",                                        state: "OR" },
  "Pinehurst No. 2":                      { dbName: "Pinehurst No. 2",                                           state: "NC" },
  "Pinehurst No. 4":                      { dbName: "Pinehurst No. 4",                                           state: "NC" },
  "Pinehurst No. 8":                      { dbName: "Pinehurst Course No. 8",                                    state: "NC" },
  "Pine Needles Lodge & Golf Club":       { dbName: "Pine Needles",                                              state: "NC" },
  "Caledonia Golf & Fish Club":           { dbName: "Caledonia Golf & Fish Club",                                state: "SC" },
  "True Blue Golf Club":                  { dbName: "True Blue Golf Plantation",                                 state: "SC" },
  "TPC Myrtle Beach":                     { dbName: "TPC Myrtle Beach",                                          state: "SC" },
  "Barefoot Resort — Dye Course":         { dbName: "Barefoot Resort & Golf - Dye Course",                       state: "SC" },
  "We-Ko-Pa — Saguaro Course":            { dbName: "We-Ko-Pa Golf Club",                                        state: "AZ" },
  "Troon North — Monument Course":        { dbName: "Troon North Golf Club",                                     state: "AZ" },
  "TPC Scottsdale — Stadium Course":      { dbName: "TPC Scottsdale Stadium Course",                             state: "AZ" },
  "Sand Valley":                          { dbName: "Sand Valley Golf Resort",                                   state: "WI" },
  "Mammoth Dunes":                        { dbName: "Mammoth Dunes",                                             state: "WI" },
  "Whistling Straits — Straits Course":   { dbName: "Whistling Straits",                                         state: "WI", city: "Sheboygan" },
  "Streamsong Red":                       { dbName: "Streamsong Resort - Red Course",                            state: "FL" },
  "Streamsong Blue":                      { dbName: "Streamsong Blue",                                           state: "FL" },
  "Streamsong Black":                     { dbName: "Streamsong Resort - Black Course",                          state: "FL" },
  "Bayside Golf Club":                    { dbName: "Bayside Golf Club",                                         state: "NE" },
  "Wild Horse Golf Club":                 { dbName: "Wild Horse Golf Club",                                      state: "NE" },
  "The Prairie Club — Dunes Course":      { dbName: "The Prairie Club",                                          state: "NE" },
  "Arcadia Bluffs — Bluffs Course":       { dbName: "Arcadia Bluffs Golf Club",                                  state: "MI" },
  "Forest Dunes — The Loop (Black)":      { dbName: "Forest Dunes Golf Club - The Loop (Black Course)",          state: "MI" },
  "Forest Dunes — The Loop (Red)":        { dbName: "Forest Dunes Golf Club - The Loop (Red Course)",            state: "MI" },
  "Bay Harbor Golf Club":                 { dbName: "Bay Harbor Golf Club",                                      state: "MI" },
  "Chambers Bay":                         { dbName: "Chambers Bay Golf Course",                                  state: "WA" },
  "Gamble Sands":                         { dbName: "Gamble Sands Golf Course",                                  state: "WA" },
  "Pumpkin Ridge — Ghost Creek":          { dbName: "Pumpkin Ridge Golf Club",                                   state: "OR" },
  "Bethpage Red":                         { dbName: "Bethpage Red Course",                                       state: "NY" },
  "Bethpage Black":                       { dbName: "Bethpage Black Golf Course",                                state: "NY" },
  "Montauk Downs":                        { dbName: "Montauk Downs",                                             state: "NY" },
  "Cantigny Golf":                        { dbName: "Cantigny Golf",                                             state: "IL" },
  "Harborside International — Port Course": { dbName: "Harborside International Golf Center (Port)",             state: "IL" },
  "Cog Hill — Dubsdread (No. 4)":         { dbName: "Cog Hill Golf & Country Club",                              state: "IL" },
  "Charleston Municipal Golf Course":     { dbName: "Charleston Municipal Golf Course",                          state: "SC" },
  "Kiawah Island — Osprey Point":         { dbName: "Osprey Point Golf Course",                                  state: "SC" },
  "Kiawah Island — The Ocean Course":     { dbName: "Kiawah Island Golf Resort - The Ocean Course",              state: "SC" },
  "PGA Frisco — Fields Ranch East":       { dbName: "Fields Ranch - East Course",                                state: "TX" },
  "Cowboys Golf Club":                    { dbName: "Cowboys Golf Club",                                         state: "TX" },
  "Lions Municipal Golf Course":          { dbName: "Lions Municipal Golf Course",                               state: "TX" },
  "Memorial Park Golf Course":            { dbName: "Memorial Park Golf Course",                                 state: "TX" },
};

// Lookup with strict 1-row expectation
async function resolveCourse(briefName) {
  const entry = COURSE_LOOKUP[briefName];
  if (!entry) throw new Error(`COURSE_LOOKUP missing entry for "${briefName}"`);
  let q = supabase
    .from("Course")
    .select("id, name, city, latitude, longitude")
    .ilike("name", entry.dbName)        // case-insensitive equality (no % wildcards)
    .eq("state", entry.state)
    .limit(5);
  if (entry.city) q = q.ilike("city", entry.city);
  const { data, error } = await q;
  if (error) throw new Error(`Lookup failed for "${briefName}": ${error.message}`);
  if (!data || data.length === 0) throw new Error(`Course "${briefName}" not found in DB (looked up "${entry.dbName}" in ${entry.state}${entry.city ? `, city="${entry.city}"` : ""})`);
  if (data.length > 1) throw new Error(`Course "${briefName}" matched ${data.length} rows — ambiguous: ${data.map((r) => `${r.name} (${r.city})`).join("; ")}`);
  const c = data[0];
  if (c.latitude == null || c.longitude == null) {
    throw new Error(`Course "${briefName}" (${c.id}) has null lat/lng — cannot compute itinerary centroid`);
  }
  return c;
}

// ── Itineraries ───────────────────────────────────────────────────────────────

const ITINERARIES = [
  {
    slug: "monterey-coast",
    name: "The Monterey Coast",
    tagline: "Three days on the cliffs. Pebble does the talking.",
    whyThisTrip: "Save Pebble for the last day. Spyglass and Spanish Bay are real courses, but the second you step onto Pebble's 7th tee — that 100-yard wedge over the Pacific — everything else from the trip gets reshuffled in your head. Bring layers. The fog rolls in fast in the morning and burns off by 11. Three rounds, one bucket list ticked off.",
    vibeTag: "BUCKET_LIST",
    costBand: "$$$$",
    bestSeasonStart: 4,
    bestSeasonEnd: 10,
    durationDays: 3,
    stayRec: "The Lodge at Pebble Beach — walk to the first tee",
    region: "Pacific Coast",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Spyglass Hill Golf Course", note: "Play early — fog usually clears by 9am" },
      { day: 2, order: 1, course: "The Links at Spanish Bay", note: "Afternoon round — bagpiper on 18 at sunset" },
      { day: 3, order: 1, course: "Pebble Beach Golf Links", note: "Save this for last. You'll understand why on the 7th tee." },
    ],
  },
  {
    slug: "bandon-dunes-marathon",
    name: "Bandon Dunes Marathon",
    tagline: "Five courses, five days, no carts. Pack rain gear and surrender.",
    whyThisTrip: "Five courses in five days, no carts, no exceptions. By Day 3 your legs will hate you and your soul will have figured out what golf is actually supposed to feel like. Pacific Dunes is the consensus favorite, but Sheep Ranch on the right day at sunset will rewrite your top-10. Pack rain gear regardless of forecast — Oregon doesn't care.",
    vibeTag: "BUCKET_LIST",
    costBand: "$$$$",
    bestSeasonStart: 5,
    bestSeasonEnd: 10,
    durationDays: 5,
    stayRec: "Lodge at Bandon Dunes — on property, walk everywhere",
    region: "Pacific Coast",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Bandon Dunes",   note: "The original. Sets the tone for the whole trip." },
      { day: 2, order: 1, course: "Pacific Dunes",  note: "Most people's favorite. Save your energy — the back nine is relentless." },
      { day: 3, order: 1, course: "Old Macdonald",  note: "Widest fairways of the trip. Don't be fooled — the greens are brutal." },
      { day: 4, order: 1, course: "Bandon Trails",  note: "The forest one. Completely different feel from the other four." },
      { day: 5, order: 1, course: "Sheep Ranch",    note: "Clifftop. No scorecard, no defined fairways. Play it however you want." },
    ],
  },
  {
    slug: "pinehurst-pilgrimage",
    name: "Pinehurst Pilgrimage",
    tagline: "The cradle of American golf. Stay in the village. Walk to the first tee.",
    whyThisTrip: "Stay in the village. Walk to the first tee. The crowned greens on No. 2 will embarrass you the first time and make sense the second. Save No. 2 for the last day so you actually understand what you're playing — start with No. 4 and No. 8 to get the feel for Pinehurst. Pine Needles is the sneaky add that most people skip. Don't skip it.",
    vibeTag: "BUCKET_LIST",
    costBand: "$$$",
    bestSeasonStart: 3,
    bestSeasonEnd: 5,
    durationDays: 4,
    stayRec: "The Carolina Hotel — stay in the village, everything is walkable",
    region: "Carolina Sandhills",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Pinehurst No. 4",                 note: "Best warmup in the resort. Gets you reading crowned greens before No. 2." },
      { day: 2, order: 1, course: "Pinehurst No. 8",                 note: "Most underrated of the numbered courses. Longer than it looks." },
      { day: 3, order: 1, course: "Pine Needles Lodge & Golf Club",  note: "Donald Ross original. Quieter than the resort. Don't skip it." },
      { day: 4, order: 1, course: "Pinehurst No. 2",                 note: "Save it for last. You'll actually appreciate it after three days of warmup." },
    ],
  },
  {
    slug: "myrtle-beach-classic",
    name: "Myrtle Beach Classic",
    tagline: "The original buddy trip. Four days, four courses, cheaper than two days at Pebble.",
    whyThisTrip: "The OG buddy trip. Caledonia and True Blue sit across the highway from each other and they're better than half the country clubs you've played. Rent a beach house, split it four ways, and you're playing four days for what two days at Pebble cost. Bring your worst shirts. The 19th hole is the whole point.",
    vibeTag: "BUDDY_TRIP",
    costBand: "$$",
    bestSeasonStart: 3,
    bestSeasonEnd: 5,
    durationDays: 4,
    stayRec: "Beach rental, North Myrtle Beach — split four ways, cheaper than any hotel",
    region: "Myrtle Beach",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Caledonia Golf & Fish Club",     note: "Best course in Myrtle. Play it first so everything else feels like a bonus." },
      { day: 2, order: 1, course: "True Blue Golf Club",            note: "Across the highway from Caledonia. Same ownership, same quality, different feel." },
      { day: 3, order: 1, course: "TPC Myrtle Beach",               note: "The tour stop. Tighter than it looks on TV." },
      { day: 4, order: 1, course: "Barefoot Resort — Dye Course",   note: "Pete Dye closing the trip — chaotic, fun, zero chill." },
    ],
  },
  {
    slug: "scottsdale-desert-run",
    name: "Scottsdale Desert Run",
    tagline: "80° in March. Mountains everywhere. Three of the most photogenic courses in America.",
    whyThisTrip: "80 degrees in March, mountains everywhere, three of the most photogenic courses in America. We-Ko-Pa is the locals' pick — way less crowded than Troon. Save TPC Stadium for the last day so you can hike up 16 and stand where the gallery roars during the Phoenix Open. Get there before April or it's too hot to think.",
    vibeTag: "BUDDY_TRIP",
    costBand: "$$$",
    bestSeasonStart: 1,
    bestSeasonEnd: 4,
    durationDays: 3,
    stayRec: "Scottsdale or Fountain Hills — central to all three courses",
    region: "Arizona",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "We-Ko-Pa — Saguaro Course",       note: "Locals' pick. Less crowded, just as good." },
      { day: 2, order: 1, course: "Troon North — Monument Course",   note: "The signature boulder on 15. You'll know it when you see it." },
      { day: 3, order: 1, course: "TPC Scottsdale — Stadium Course", note: "Walk up 16 and stand in the empty amphitheater. Close your eyes for a second." },
    ],
  },
  {
    slug: "wisconsin-sand",
    name: "Wisconsin Sand",
    tagline: "Modern American golf at its loudest. Bring layers. Plan for wind.",
    whyThisTrip: "Sand Valley and Mammoth Dunes are the same property — wake up, walk to the first tee, do it again. Then drive two hours to Whistling Straits for the Ryder Cup pilgrimage. Wind off Lake Michigan is no joke. Bring a windshirt and one extra club for every shot. Pack snacks — there is not much between Sand Valley and the closest town.",
    vibeTag: "BUDDY_TRIP",
    costBand: "$$$",
    bestSeasonStart: 6,
    bestSeasonEnd: 9,
    durationDays: 3,
    stayRec: "Lodge at Sand Valley — on property for Days 1-2, drive to Kohler for Day 3",
    region: "Wisconsin",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Mammoth Dunes",                       note: "Wide, fast, more forgiving than Sand Valley. Good opener." },
      { day: 2, order: 1, course: "Sand Valley",                         note: "Narrower, more demanding. Day 2 is right." },
      { day: 3, order: 1, course: "Whistling Straits — Straits Course",  note: "Two hours east. Wind off Lake Michigan will add two clubs to everything." },
    ],
  },
  {
    slug: "streamsong-experience",
    name: "The Streamsong Experience",
    tagline: "Three modern masterpieces. Reclaimed phosphate mines turned cathedrals. Walking only.",
    whyThisTrip: "Three of the best modern courses in America, one Florida property, walking only. Blue is the most playable, Red is the prettiest, Black will hand you your lunch. The resort is dialed — the lodge bar after Day 2 when everyone is comparing notes is half the trip. Best time to go is October when the Florida heat finally breaks.",
    vibeTag: "BUDDY_TRIP",
    costBand: "$$$$",
    bestSeasonStart: 10,
    bestSeasonEnd: 4,
    durationDays: 3,
    stayRec: "Streamsong Resort — on property, walking distance to all three courses",
    region: "Florida",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Streamsong Blue",  note: "Most playable of the three. Good opener — gets you reading the terrain." },
      { day: 2, order: 1, course: "Streamsong Red",   note: "Coore and Crenshaw. The prettiest. Take your time on it." },
      { day: 3, order: 1, course: "Streamsong Black", note: "Gil Hanse closing the trip. It will humble you. That is fine." },
    ],
  },
  {
    slug: "nebraska-sandhills",
    name: "Nebraska Sandhills",
    tagline: "Six hours from the nearest big airport. That is the point.",
    whyThisTrip: "Bayside is the warmup — affordable, accessible, gets you into the region and into the mindset. Then The Prairie Club and Wild Horse are the reason you made the drive. Stay on property at one of the lodges and do not leave for three days. The stars at night out there do not look real.",
    vibeTag: "HIDDEN_GEM",
    costBand: "$$$",
    bestSeasonStart: 5,
    bestSeasonEnd: 10,
    durationDays: 3,
    stayRec: "The Prairie Club Lodge — stay on property",
    region: "Nebraska Sandhills",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Bayside Golf Club",                 note: "The warmup. Public, affordable, gets you into the sandhills headspace." },
      { day: 2, order: 1, course: "The Prairie Club — Dunes Course",   note: "This is why you drove six hours. Pure sandhills golf." },
      { day: 3, order: 1, course: "Wild Horse Golf Club",              note: "The closer. Public, walkable, top-100 minimalist design — punches way above its green fee." },
    ],
  },
  {
    slug: "northern-michigan-loop",
    name: "Northern Michigan Loop",
    tagline: "Lake Michigan dunes, reversible holes, more great golf per square mile than you'd expect.",
    whyThisTrip: "Lake Michigan dunes, reversible holes at Forest Dunes where you literally play the same routing in reverse on Day 3 and it feels like a completely different course, and Arcadia Bluffs which somehow does not get talked about enough. Bay Harbor closes the trip on a high note. Go June through September — outside that window the weather will eat your trip alive.",
    vibeTag: "HIDDEN_GEM",
    costBand: "$$$",
    bestSeasonStart: 6,
    bestSeasonEnd: 9,
    durationDays: 4,
    stayRec: "Traverse City or on-site at Forest Dunes — central to all four stops",
    region: "Northern Michigan",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Arcadia Bluffs — Bluffs Course",          note: "Lake Michigan views on almost every hole. Does not get enough credit nationally." },
      { day: 2, order: 1, course: "Forest Dunes — The Loop (Black)",         note: "Play Black first so Red feels like a completely different course tomorrow." },
      { day: 3, order: 1, course: "Forest Dunes — The Loop (Red)",           note: "Same routing, opposite direction. Genuinely plays like a new course." },
      { day: 4, order: 1, course: "Bay Harbor Golf Club",                    note: "Resort closer. Lakeside setting, easier than the previous three, perfect send-off." },
    ],
  },
  {
    slug: "pacific-northwest-underrated",
    name: "Pacific Northwest Underrated",
    tagline: "Oregon and Washington's quiet stars. Smaller crowds, big golf.",
    whyThisTrip: "Chambers Bay hosted a US Open and somehow still flies under the radar. Gamble Sands is what Bandon would look like if it were four hours inland and half as crowded. Pumpkin Ridge is the practical Day 3 — accessible, fun, no stress after two demanding courses. Drive between them — that is part of the trip. Bring rain gear and do not trust the forecast.",
    vibeTag: "HIDDEN_GEM",
    costBand: "$$$",
    bestSeasonStart: 5,
    bestSeasonEnd: 10,
    durationDays: 3,
    stayRec: "Tacoma for Day 1, Brewster area for Day 2, Portland for Day 3",
    region: "Pacific Northwest",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Chambers Bay",                  note: "Fescue everywhere, Puget Sound views, slope will surprise you." },
      { day: 2, order: 1, course: "Gamble Sands",                  note: "Four hours east. Worth every minute of the drive. Stay on site." },
      { day: 3, order: 1, course: "Pumpkin Ridge — Ghost Creek",   note: "Oregon closer. Former US Amateur host. Under the radar and proud of it." },
    ],
  },
  {
    slug: "long-island-loop",
    name: "Long Island Loop",
    tagline: "Three days, three of the best public tracks within an hour of NYC.",
    whyThisTrip: "Bethpage Black is on every public-course bucket list for a reason. Bethpage Red is the one locals actually prefer — friendlier scoring but just as fun. Montauk Downs is the wildcard: public, affordable, feels like a private links course you snuck onto. Try to book a Black tee time more than 30 days out or you are looking at a 4am wait line situation.",
    vibeTag: "QUICK_HIT",
    costBand: "$$",
    bestSeasonStart: 5,
    bestSeasonEnd: 10,
    durationDays: 3,
    stayRec: "Mid-Island — central to Bethpage on Days 1-2, driveable to Montauk for Day 3",
    region: "Long Island",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Bethpage Red",    note: "Warmup round. Friendlier than Black, still excellent." },
      { day: 2, order: 1, course: "Montauk Downs",   note: "Drive out east. Feels like a private links course you snuck onto." },
      { day: 3, order: 1, course: "Bethpage Black",  note: "Save it for last. Book 30+ days out or plan on a 4am tee line." },
    ],
  },
  {
    slug: "chicago-publics",
    name: "Chicago Publics",
    tagline: "The best public golf in the Midwest, all within an hour of downtown.",
    whyThisTrip: "Cantigny and Harborside are the warmups — both excellent, both reasonably priced, both underrated on the national radar. Cog Hill Dubsdread is the closer — former PGA Tour stop, zero apologies. Stay downtown, drive out each morning. The whole trip comes in under a grand per person if you are not picky about hotels.",
    vibeTag: "QUICK_HIT",
    costBand: "$$",
    bestSeasonStart: 5,
    bestSeasonEnd: 10,
    durationDays: 3,
    stayRec: "Downtown Chicago — drive out each morning, back for dinner each night",
    region: "Chicago",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Cantigny Golf",                                 note: "Former Wheaton estate turned public. Easier of the three. Good opener." },
      { day: 2, order: 1, course: "Harborside International — Port Course",        note: "Links-style on the south side. Underrated nationally." },
      { day: 3, order: 1, course: "Cog Hill — Dubsdread (No. 4)",                  note: "Former Bridgestone Invitational host. Save it for last — it earns the closer spot." },
    ],
  },
  {
    slug: "coastal-carolina-public",
    name: "Coastal Carolina Public",
    tagline: "Charleston and Kiawah, no membership required.",
    whyThisTrip: "The Ocean Course at Kiawah is the one — saved for Day 3 so you actually appreciate it instead of getting humbled by the wind on Day 1. Charleston Municipal is the most underrated muni in America and it is not close. Stay on Kiawah if the budget allows. Stay in downtown Charleston if it does not — the food scene alone justifies the 45-minute drive.",
    vibeTag: "QUICK_HIT",
    costBand: "$$$",
    bestSeasonStart: 3,
    bestSeasonEnd: 5,
    durationDays: 3,
    stayRec: "Kiawah Island Resort or downtown Charleston — both work for different reasons",
    region: "Coastal Carolina",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Charleston Municipal Golf Course",   note: "Most underrated muni in America. Seriously." },
      { day: 2, order: 1, course: "Kiawah Island — Osprey Point",       note: "Resort warmup. More forgiving than the Ocean Course. Good prep." },
      { day: 3, order: 1, course: "Kiawah Island — The Ocean Course",   note: "Ten miles of ocean holes. Wind will be a factor. One extra club, minimum." },
    ],
  },
  {
    slug: "texas-stretch",
    name: "The Texas Stretch",
    tagline: "Four days, three cities, one rental car. Texas-sized portions of golf.",
    whyThisTrip: "Four days, three cities, one rental car. PGA Frisco is the new flagship — Fields Ranch East already feels like a major venue. Cowboys Golf Club in Grapevine is the wildcard: stadium seating, unique design, genuinely fun. Lions Muni in Austin is the heart-string play — pure community golf, been there since 1934. Memorial Park in Houston is what every city muni should aspire to be. BBQ between every round is non-negotiable.",
    vibeTag: "WILD_CARD",
    costBand: "$$$",
    bestSeasonStart: 3,
    bestSeasonEnd: 5,
    durationDays: 4,
    stayRec: "Move cities — Dallas/Grapevine → Austin → Houston, one night each",
    region: "Texas",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "PGA Frisco — Fields Ranch East",  note: "New flagship. Already feels like a major venue." },
      { day: 2, order: 1, course: "Cowboys Golf Club",               note: "Grapevine. Stadium seating, unique layout, genuinely fun." },
      { day: 3, order: 1, course: "Lions Municipal Golf Course",     note: "Austin. Been here since 1934. Public golf the way it should be." },
      { day: 4, order: 1, course: "Memorial Park Golf Course",       note: "Houston closer. Gil Hanse redesign. Best city muni in Texas." },
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

const VIBE_TAGS = new Set(["BUCKET_LIST", "BUDDY_TRIP", "HIDDEN_GEM", "QUICK_HIT", "WILD_CARD"]);
const COST_BANDS = new Set(["$$", "$$$", "$$$$"]);

async function main() {
  console.log("\n🗺  Tour It — Phase 2 Itinerary Seeder");
  console.log("=========================================\n");

  // ── PRE-FLIGHT: validate the brief and resolve every course ────────────────
  console.log("Pre-flight: validating itineraries and resolving all course names…\n");

  // Validate enums + structural rules
  for (const it of ITINERARIES) {
    if (!VIBE_TAGS.has(it.vibeTag))   throw new Error(`Itinerary "${it.slug}": vibeTag "${it.vibeTag}" not in allowed set`);
    if (!COST_BANDS.has(it.costBand)) throw new Error(`Itinerary "${it.slug}": costBand "${it.costBand}" not in allowed set`);
    if (it.stops.length !== it.durationDays) {
      throw new Error(`Itinerary "${it.slug}": durationDays=${it.durationDays} but stops.length=${it.stops.length}`);
    }
  }

  // Resolve all courses up front; bail loudly on any miss
  const resolved = new Map(); // briefName → { id, name, latitude, longitude }
  for (const it of ITINERARIES) {
    for (const s of it.stops) {
      if (resolved.has(s.course)) continue;
      const c = await resolveCourse(s.course);
      resolved.set(s.course, c);
      console.log(`  ✓ ${s.course.padEnd(45)} → ${c.name}`);
    }
  }
  console.log(`\nResolved ${resolved.size} unique courses across ${ITINERARIES.length} itineraries\n`);

  // ── INSERT (idempotent: delete-by-slug then insert) ────────────────────────
  console.log("Seeding itineraries (idempotent — deletes existing-by-slug first)…\n");

  const summary = [];
  for (const it of ITINERARIES) {
    // Centroid
    const lats = it.stops.map((s) => resolved.get(s.course).latitude);
    const lngs = it.stops.map((s) => resolved.get(s.course).longitude);
    const centLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const centLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

    // Delete existing by slug (stops cascade-delete via onDelete: Cascade)
    const { error: delErr } = await supabase.from("TripItinerary").delete().eq("slug", it.slug);
    if (delErr) throw new Error(`Delete by slug "${it.slug}": ${delErr.message}`);

    const now = new Date().toISOString();
    const itineraryId = randomUUID();
    const itineraryRow = {
      id:              itineraryId,
      slug:            it.slug,
      name:            it.name,
      tagline:         it.tagline,
      whyThisTrip:     it.whyThisTrip,
      heroImageUrl:    it.heroImageUrl,
      vibeTag:         it.vibeTag,
      costBand:        it.costBand,
      bestSeasonStart: it.bestSeasonStart,
      bestSeasonEnd:   it.bestSeasonEnd,
      durationDays:    it.durationDays,
      stayRec:         it.stayRec,
      latitude:        centLat,
      longitude:       centLng,
      region:          it.region,
      createdAt:       now,
      updatedAt:       now,
    };
    const { data: itIns, error: insErr } = await supabase
      .from("TripItinerary")
      .insert(itineraryRow)
      .select("id, slug, name")
      .single();
    if (insErr) throw new Error(`Insert itinerary "${it.slug}": ${insErr.message}`);

    const stopRows = it.stops.map((s) => ({
      id:          randomUUID(),
      itineraryId: itIns.id,
      courseId:    resolved.get(s.course).id,
      day:         s.day,
      order:       s.order,
      note:        s.note,
    }));
    const { error: stopErr } = await supabase.from("TripItineraryStop").insert(stopRows);
    if (stopErr) throw new Error(`Insert stops for "${it.slug}": ${stopErr.message}`);

    summary.push({
      slug: it.slug,
      name: it.name,
      vibeTag: it.vibeTag,
      stops: stopRows.length,
      durationDays: it.durationDays,
      centroid: [centLat.toFixed(4), centLng.toFixed(4)],
    });
    console.log(`  ✅ ${it.slug.padEnd(28)} ${it.vibeTag.padEnd(12)} stops=${stopRows.length}/${it.durationDays}  centroid=[${centLat.toFixed(3)}, ${centLng.toFixed(3)}]`);
  }

  // ── VERIFY ──────────────────────────────────────────────────────────────────
  console.log("\n=========================================");
  console.log("Verification");
  console.log("=========================================");
  const { data: rows } = await supabase
    .from("TripItinerary")
    .select("id, name, vibeTag, durationDays, costBand, stops:TripItineraryStop(id)")
    .order("vibeTag", { ascending: true })
    .order("name", { ascending: true });
  console.log(`\n${"Name".padEnd(30)} ${"vibeTag".padEnd(12)} days  cost  stops`);
  console.log("─".repeat(70));
  let ok = true;
  for (const r of rows) {
    const stopCount = r.stops.length;
    const match = stopCount === r.durationDays ? "✓" : "✗";
    if (stopCount !== r.durationDays) ok = false;
    console.log(`${r.name.padEnd(30)} ${r.vibeTag.padEnd(12)} ${String(r.durationDays).padEnd(5)} ${r.costBand.padEnd(5)} ${stopCount} ${match}`);
  }
  console.log(`\nTotal itineraries: ${rows.length}`);
  console.log(`All stop counts match durationDays: ${ok ? "yes ✅" : "NO ✗"}`);
  if (rows.length !== 14) console.log(`⚠ Expected 14 itineraries, got ${rows.length}`);

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("\n✗ FATAL:", err.message);
  process.exit(1);
});
