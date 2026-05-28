#!/usr/bin/env node
/**
 * Tour It — Catalog Expansion Itinerary Seeder
 *
 * Adds 12 new US destinations on top of the original 14 from
 * `seed-itineraries.mjs`. Idempotent on each new slug: deletes by
 * slug then inserts. Does NOT touch the original 14 — their slugs
 * are not in this script.
 *
 * Run: node prisma/seed-itineraries-expansion.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import dotenv from "dotenv";

dotenv.config();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Brief display name → exact DB name + state (and city when needed).
// Pulled from verify-expansion-courses{.mjs,2.mjs} probes.
const COURSE_LOOKUP = {
  // Big Cedar / Ozarks
  "Payne's Valley":                     { dbName: "Payne's Valley at Big Cedar Lodge",          state: "MO" },
  "Ozarks National":                    { dbName: "Ozarks National Golf Course",                 state: "MO" },
  "Top of the Rock":                    { dbName: "Top of the Rock Golf Course",                 state: "MO" },
  "Buffalo Ridge Springs":              { dbName: "Buffalo Ridge Springs Golf Course",           state: "MO" },

  // Hilton Head
  "Harbour Town":                       { dbName: "Harbour Town Golf Links",                     state: "SC" },
  "Palmetto Dunes RTJ":                 { dbName: "Palmetto Dunes - Robert Trent Jones Golf Course", state: "SC" },
  "Palmetto Dunes Fazio":               { dbName: "Palmetto Dunes - George Fazio Golf Course",   state: "SC" },
  "May River":                          { dbName: "May River Golf Course",                       state: "SC" },

  // Vegas
  "Bali Hai":                           { dbName: "Bali Hai Golf Club",                          state: "NV" },
  "Wynn":                               { dbName: "Wynn Golf Course",                            state: "NV" },
  "Cascata":                            { dbName: "Cascata Golf Course",                         state: "NV" },

  // Palm Springs / Coachella
  "TPC Stadium (PGA West)":             { dbName: "TPC Stadium Golf Course (PGA West)",          state: "CA" },
  "Arnold Palmer (PGA West)":           { dbName: "Arnold Palmer Golf Course (PGA West)",        state: "CA" },
  "Indian Wells Resort":                { dbName: "Indian Wells Golf Resort",                    state: "CA" },
  "Greg Norman (PGA West)":             { dbName: "Greg Norman Course Resort Course (PGA West)", state: "CA" },

  // Park City / Wasatch
  "Soldier Hollow":                     { dbName: "Soldier Hollow Golf Course",                  state: "UT" },
  "Wasatch Mountain":                   { dbName: "Wasatch Mountain State Golf Course",          state: "UT" },

  // Big Island Hawaii
  "Mauna Kea":                          { dbName: "Mauna Kea Golf Course",                       state: "HI" },
  "Mauna Lani":                         { dbName: "Mauna Lani Golf",                             state: "HI" },
  "Hualalai (Nicklaus)":                { dbName: "Hualalai Golf Club Nicklaus Course",          state: "HI" },

  // Maui
  "Kapalua Plantation":                 { dbName: "The Plantation Course",                       state: "HI" },
  "Wailea Gold":                        { dbName: "Wailea Gold Course",                          state: "HI" },
  "Wailea Emerald":                     { dbName: "Wailea Emerald Course",                       state: "HI" },

  // Central Oregon (Bend)
  "Tetherow":                           { dbName: "Tetherow Golf Club",                          state: "OR" },
  "Crosswater":                         { dbName: "Crosswater Golf Course",                      state: "OR" },
  "Pronghorn (Nicklaus)":               { dbName: "Pronghorn Club at Juniper Reserve - Nicklaus Course", state: "OR" },

  // Cape Cod
  "Cape Cod National":                  { dbName: "Cape Cod National Golf Club",                 state: "MA" },
  "Pinehills":                          { dbName: "Pinehills Golf Club",                         state: "MA" },
  "Cranberry Valley":                   { dbName: "Cranberry Valley Golf Club",                  state: "MA" },
  "Captains":                           { dbName: "Captains Golf Course",                        state: "MA" },

  // RTJ Trail (Alabama)
  "RTJ Grand National":                 { dbName: "RTJ Grand National Golf",                     state: "AL" },
  "RTJ Ross Bridge":                    { dbName: "RTJ Ross Bridge Golf",                        state: "AL" },
  "RTJ Oxmoor Valley":                  { dbName: "RTJ Oxmoor Valley Golf",                      state: "AL" },
  "Magnolia Grove":                     { dbName: "Magnolia Grove Golf Course",                  state: "AL" },

  // Greenbrier
  "Old White TPC":                      { dbName: "The Greenbrier - The Old White TPC",          state: "WV" },
  "Greenbrier Course":                  { dbName: "The Greenbrier - Greenbrier Course",          state: "WV" },
  "Meadows Course":                     { dbName: "The Greenbrier - Meadows Course",             state: "WV" },

  // San Diego
  "Torrey Pines North":                 { dbName: "Torrey Pines North Course",                   state: "CA" },
  "Torrey Pines South":                 { dbName: "Torrey Pines South Course",                   state: "CA" },
  "Aviara":                             { dbName: "Aviara Golf Club",                            state: "CA" },
};

async function resolveCourse(briefName) {
  const entry = COURSE_LOOKUP[briefName];
  if (!entry) throw new Error(`COURSE_LOOKUP missing entry for "${briefName}"`);
  let q = sb
    .from("Course")
    .select("id, name, city, latitude, longitude")
    .ilike("name", entry.dbName)
    .eq("state", entry.state)
    .limit(5);
  if (entry.city) q = q.ilike("city", entry.city);
  const { data, error } = await q;
  if (error) throw new Error(`Lookup failed for "${briefName}": ${error.message}`);
  if (!data || data.length === 0) throw new Error(`Course "${briefName}" not found (looked up "${entry.dbName}" in ${entry.state})`);
  if (data.length > 1) throw new Error(`"${briefName}" matched ${data.length} rows — ambiguous: ${data.map((r) => `${r.name} (${r.city})`).join("; ")}`);
  const c = data[0];
  if (c.latitude == null || c.longitude == null) {
    throw new Error(`Course "${briefName}" (${c.id}) has null lat/lng`);
  }
  return c;
}

const ITINERARIES = [
  {
    slug: "big-cedar-ozarks",
    name: "Big Cedar & The Ozarks",
    tagline: "Tiger's par-3 wonder, Coore-Crenshaw's Ozarks magic, all on one ridge.",
    whyThisTrip: "Three of the most photographed courses in America, all within a 20-minute shuttle. Payne's Valley is Tiger's first public design — finish with the par-3 cave hole framed by a 200-foot bluff. Ozarks National (Coore & Crenshaw) is the architecture nerd's pick. Top of the Rock is the Jack Nicklaus par-3 closer with views straight down Table Rock Lake. Bass Pro built this place and it shows — over-the-top in the best possible way.",
    vibeTag: "HIDDEN_GEM",
    costBand: "$$$",
    bestSeasonStart: 4,
    bestSeasonEnd: 10,
    durationDays: 3,
    stayRec: "Big Cedar Lodge — on property, shuttle to every course",
    region: "Ozarks",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Ozarks National",       note: "Coore & Crenshaw masterclass. Start here — sets the architectural tone." },
      { day: 2, order: 1, course: "Payne's Valley",        note: "Tiger's first public course. The cave hole closer is the picture you'll send your group." },
      { day: 3, order: 1, course: "Top of the Rock",       note: "Nicklaus par-3 finale. Sunset round if you can get the tee time." },
    ],
  },
  {
    slug: "hilton-head-lowcountry",
    name: "Hilton Head Lowcountry",
    tagline: "Harbour Town's lighthouse, oak-draped fairways, and shrimp-and-grits between rounds.",
    whyThisTrip: "Harbour Town is the bucket-list round — narrow corridors of live oaks ending at the lighthouse on 18, exactly like you've seen it on the RBC Heritage telecast. The Palmetto Dunes courses are the workhorses: RTJ has the lagoon-laced 10th, Fazio is the toughest test on the island. May River across the bridge in Bluffton is the sneaky bonus — Jack Nicklaus design that plays through pine forest and tidal marsh. Boiled peanuts and Frogmore stew are non-negotiable.",
    vibeTag: "BUDDY_TRIP",
    costBand: "$$$",
    bestSeasonStart: 3,
    bestSeasonEnd: 5,
    durationDays: 4,
    stayRec: "Sea Pines villa or Marriott Grande Ocean — split a place with the group",
    region: "Lowcountry",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Palmetto Dunes RTJ",    note: "Best warmup on the island. Three lagoons and a beachside finishing hole." },
      { day: 2, order: 1, course: "Palmetto Dunes Fazio",  note: "The toughest of the Palmetto Dunes layouts. Bring extra balls." },
      { day: 3, order: 1, course: "May River",             note: "Cross the bridge to Bluffton. Marsh, oaks, no houses. The hidden one." },
      { day: 4, order: 1, course: "Harbour Town",          note: "Save the lighthouse for last. The 18th finishing hole will live in your head." },
    ],
  },
  {
    slug: "vegas-strip-stretch",
    name: "Vegas Strip Stretch",
    tagline: "Sunrise rounds, blackjack nights. Three courses you can play between cocktails.",
    whyThisTrip: "Vegas golf is its own genre. Bali Hai is the strip-adjacent par-72 with palm trees and water that makes zero sense in the desert. Wynn is the $1000 round that's worth doing once for the experience — the only course actually on the strip. Cascata is the 40-minute drive out to Boulder City that everyone forgets about until they play it — a private creek runs straight through the clubhouse. Tee off at 7am, brunch by noon, sportsbook by 2.",
    vibeTag: "WILD_CARD",
    costBand: "$$$$",
    bestSeasonStart: 3,
    bestSeasonEnd: 5,
    durationDays: 3,
    stayRec: "Anywhere on the strip — golf rideshare is straightforward",
    region: "Las Vegas",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Bali Hai",              note: "South strip-adjacent. Easiest tee-time to hit, palm-tree paradise." },
      { day: 2, order: 1, course: "Cascata",               note: "Worth the drive. Creek through the clubhouse. Highest-rated course in the metro." },
      { day: 3, order: 1, course: "Wynn",                  note: "Tom Fazio redesign on the strip itself. Splurge round — bucket-list checkbox." },
    ],
  },
  {
    slug: "palm-springs-warmup",
    name: "Palm Springs Warm-Up",
    tagline: "January golf in 75° sun. Four PGA West rotations and the desert's best mountain backdrop.",
    whyThisTrip: "The original snowbird buddy trip. PGA West is six courses on one property — we picked the three best for variety: Stadium for the Pete Dye chaos (TPC of the West Coast), Arnold Palmer for the wide forgiving lines, Greg Norman for the modern desert routing. Indian Wells Resort is the across-the-valley change of pace. Three of the four are walkable in the morning, all four are carts after 11. Sunsets behind the Santa Rosa range are the photo your group chat will steal forever.",
    vibeTag: "BUDDY_TRIP",
    costBand: "$$$",
    bestSeasonStart: 1,
    bestSeasonEnd: 4,
    durationDays: 4,
    stayRec: "La Quinta Resort or a Palm Desert rental — central to all four",
    region: "Coachella Valley",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Arnold Palmer (PGA West)",  note: "Wide forgiving start. Get your ball-striking dialed before Stadium." },
      { day: 2, order: 1, course: "Greg Norman (PGA West)",    note: "Modern desert design. Less penal, more strategic — think Saturday morning." },
      { day: 3, order: 1, course: "Indian Wells Resort",       note: "Across the valley. Mountain backdrops on every hole. Restorative round." },
      { day: 4, order: 1, course: "TPC Stadium (PGA West)",    note: "Pete Dye's Coachella beast. Save it for last — closing 18 is iconic." },
    ],
  },
  {
    slug: "park-city-altitude",
    name: "Park City Altitude",
    tagline: "8,000 feet of elevation, your driver carries forever, and you're never in the rough.",
    whyThisTrip: "A weekend warrior's secret: the golf ball flies 10-15% farther at altitude, so you suddenly hit 270 with your driver. Soldier Hollow is the public crown jewel — two Gene Bates designs (Silver and Gold) on the 2002 Olympics cross-country site, mountain views in every direction. Wasatch Mountain State is the underrated companion next door. Both walkable, both under $90 in season. Pair golf with a real mountain town — Park City's Main Street has the best apres-anything in the western US.",
    vibeTag: "HIDDEN_GEM",
    costBand: "$$",
    bestSeasonStart: 6,
    bestSeasonEnd: 9,
    durationDays: 2,
    stayRec: "Park City Main Street — old mining town, modern bars, 25 min to both courses",
    region: "Wasatch Mountains",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Soldier Hollow",        note: "Olympic cross-country host. Mountain panoramas. Walk it." },
      { day: 2, order: 1, course: "Wasatch Mountain",      note: "Next door, totally different feel — meadow holes through aspens." },
    ],
  },
  {
    slug: "big-island-golf",
    name: "Hawaii Big Island Black Lava",
    tagline: "Black volcanic lava, electric blue Pacific, and the most photogenic 3rd hole on Earth.",
    whyThisTrip: "Mauna Kea is one of the original Robert Trent Jones Sr. masterpieces — the 3rd is the over-the-Pacific cliffside par-3 on every Hawaii golf list. Mauna Lani next door is the buddy — wider corridors, just as much lava, more reachable par 5s. Hualalai (Nicklaus) is the resort splurge — only Four Seasons guests get on, so save it for a one-night upgrade. The flight is long but you'll forget the moment you stand on Mauna Kea's 3rd tee.",
    vibeTag: "BUCKET_LIST",
    costBand: "$$$$",
    bestSeasonStart: 11,
    bestSeasonEnd: 4,
    durationDays: 3,
    stayRec: "Mauna Lani Resort or Westin Hapuna — Kohala Coast, walking distance to first tee",
    region: "Hawaii - Big Island",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Mauna Lani",            note: "Start here. Wider corridors, eases you into Hawaii target golf." },
      { day: 2, order: 1, course: "Hualalai (Nicklaus)",   note: "Four Seasons round. Stay on property the night before for tee access." },
      { day: 3, order: 1, course: "Mauna Kea",             note: "The 3rd hole is the picture. Save it for last." },
    ],
  },
  {
    slug: "maui-trade-winds",
    name: "Maui Trade Winds",
    tagline: "Kapalua's Plantation course, sea-cliff sunsets, and a back nine that defends every gust.",
    whyThisTrip: "Kapalua Plantation is the PGA Tour's season-opener — the 18th plays 663 yards downhill with the Pacific in the background, and every amateur who plays it remembers exactly what they hit into it. Wailea Gold and Emerald sit side-by-side on the south shore: Gold is the championship test, Emerald is the lush forgiving one for sore Day-3 legs. Get a convertible. The drive between Kapalua and Wailea (1h15) is the Pacific Coast Highway in tropical mode.",
    vibeTag: "BUCKET_LIST",
    costBand: "$$$$",
    bestSeasonStart: 11,
    bestSeasonEnd: 4,
    durationDays: 3,
    stayRec: "Kapalua first, Wailea second — split the stay or commute from one base",
    region: "Hawaii - Maui",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Kapalua Plantation",    note: "The Sentry course. Bombs-away 18th. Tee off mid-morning to catch the trades." },
      { day: 2, order: 1, course: "Wailea Gold",           note: "Drive south, switch resorts. Championship layout, mountain-to-ocean views." },
      { day: 3, order: 1, course: "Wailea Emerald",        note: "Easier on tired legs. Flowering trees on every hole. Postcard golf." },
    ],
  },
  {
    slug: "central-oregon-bend",
    name: "Bend's High Desert",
    tagline: "Three pine-and-lava layouts at 4,000 feet, paired with the best brewery scene in the West.",
    whyThisTrip: "Bend is what Bandon would be if Bandon also had craft beer. Tetherow is the David McLay Kidd design — fescue, lava, no trees on the front nine. Crosswater (Sunriver Resort) is the rich-soil parkland counterpoint — meadows, river crossings, no two holes alike. Pronghorn (Nicklaus side) is the desert finisher — sage, juniper, mountain views. Best non-golf town on the list — Deschutes Brewery for the apres round.",
    vibeTag: "HIDDEN_GEM",
    costBand: "$$$",
    bestSeasonStart: 5,
    bestSeasonEnd: 10,
    durationDays: 3,
    stayRec: "Downtown Bend or Sunriver Resort — Bend for nightlife, Sunriver for proximity",
    region: "Central Oregon",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Tetherow",              note: "McLay Kidd in the high desert. Fescue, lava, zero forgiveness. Start fresh." },
      { day: 2, order: 1, course: "Crosswater",            note: "Sunriver Resort. River crossings on five holes. Bring extra balls." },
      { day: 3, order: 1, course: "Pronghorn (Nicklaus)",  note: "Sage and juniper, with Cascade backdrops. Quietest round of the trip." },
    ],
  },
  {
    slug: "cape-cod-loop",
    name: "Cape Cod Loop",
    tagline: "Four muni-and-resort rounds along the Cape, lobster rolls between, sea breeze on every tee.",
    whyThisTrip: "The original New England buddy trip. Cape Cod National is the Brian Silva private-feel design — locals will tell you it's the best public course in Massachusetts. Pinehills (Plymouth) has the Jones-Nicklaus pedigree and is the longest carry. Captains is the Brewster muni with two 18s for the price most resorts charge for nine. Cranberry Valley is the unsung Harwich gem. All four are walkable, all four are under $85 in shoulder season. Pair every round with a lobster roll from a different shack — that's the real itinerary.",
    vibeTag: "BUDDY_TRIP",
    costBand: "$$",
    bestSeasonStart: 5,
    bestSeasonEnd: 10,
    durationDays: 4,
    stayRec: "Chatham, Brewster, or a Cape rental house — split it 4 ways and drive between rounds",
    region: "Cape Cod",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Pinehills",             note: "Largest layout on the trip. Two courses — Jones and Nicklaus II. Play the Jones." },
      { day: 2, order: 1, course: "Cape Cod National",     note: "The local pick. Brian Silva design. Plays like a private club." },
      { day: 3, order: 1, course: "Cranberry Valley",      note: "Harwich muni. Underrated all-around — finishing stretch is a treat." },
      { day: 4, order: 1, course: "Captains",              note: "Brewster muni's two-course bonanza. Pick Port (the linksier one)." },
    ],
  },
  {
    slug: "rtj-alabama-trail",
    name: "RTJ Trail Alabama",
    tagline: "Three Robert Trent Jones stops, BBQ in every town, four days of Southern golf hospitality.",
    whyThisTrip: "The Robert Trent Jones Golf Trail is 26 courses across 11 Alabama sites — a state-funded golf marvel with PGA-level conditions at municipal prices. We picked the three flagship stops plus Magnolia Grove. Grand National (Opelika) is the centerpiece — the Lake Course hosted the LPGA. Ross Bridge (Hoover) is the bagpiper-on-18 closer at sunset. Oxmoor Valley (Birmingham) is the ridge-routed Valley Course. Magnolia Grove (Mobile) adds gulf-coast variety. Cheapest premium golf you'll ever play.",
    vibeTag: "WILD_CARD",
    costBand: "$$",
    bestSeasonStart: 3,
    bestSeasonEnd: 5,
    durationDays: 4,
    stayRec: "Renaissance hotels are partnered with each Trail stop — book the package",
    region: "Alabama",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "RTJ Oxmoor Valley",     note: "Birmingham. Valley Course is the ridge-routed beauty." },
      { day: 2, order: 1, course: "RTJ Ross Bridge",       note: "Hoover. Bagpiper plays at sunset every night. Time the tee time accordingly." },
      { day: 3, order: 1, course: "RTJ Grand National",    note: "Opelika. Centerpiece of the Trail. Lake Course is the must-play." },
      { day: 4, order: 1, course: "Magnolia Grove",        note: "Drive south to Mobile. Gulf-coast finisher — different feel." },
    ],
  },
  {
    slug: "greenbrier-stretch",
    name: "The Greenbrier",
    tagline: "Three courses, one massive resort, a casino in the basement and Sam Snead's ghost on every tee box.",
    whyThisTrip: "The Greenbrier is one of those places that doesn't quite fit any other category — a 700-room federal-era resort in the West Virginia mountains with three real golf courses, a casino in the underground bunker, and more history than any property in American golf. Old White TPC is the Charles Blair Macdonald reverse-routing classic that hosted the PGA Tour for years. The Greenbrier Course is the Jack Nicklaus track. The Meadows is the easiest walk, and the loveliest in fall. Stay on property — this place isn't a daily-fee experience.",
    vibeTag: "BUCKET_LIST",
    costBand: "$$$$",
    bestSeasonStart: 5,
    bestSeasonEnd: 10,
    durationDays: 3,
    stayRec: "The Greenbrier itself — stay on property, full access, the whole point",
    region: "Appalachia",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Meadows Course",         note: "Easiest walk, prettiest in fall. Loosen up before the headliners." },
      { day: 2, order: 1, course: "Greenbrier Course",      note: "The Nicklaus track. Modern test, mountain views." },
      { day: 3, order: 1, course: "Old White TPC",          note: "Macdonald reverse-routing classic. Save for last. Bucket-list checkbox." },
    ],
  },
  {
    slug: "san-diego-coastal",
    name: "San Diego Coastal",
    tagline: "Pacific cliffs, sea-fog mornings, three iconic Southern California layouts.",
    whyThisTrip: "Torrey Pines South is the U.S. Open venue — you can play the same tee boxes Tiger played in 2008 for under $300, walking. Torrey North is the easier sibling but has the better ocean holes. Aviara (Carlsbad) is the lush Arnold Palmer design with macadamia groves and waterfalls that look like a movie set. All three are seaside, all three are walkable in the morning. Late-March to mid-May is the window — marine layer clears by 10am, no rain, 72 degrees by lunch.",
    vibeTag: "BUCKET_LIST",
    costBand: "$$$",
    bestSeasonStart: 3,
    bestSeasonEnd: 6,
    durationDays: 3,
    stayRec: "La Jolla Cove or Carlsbad — both within 25 min of all three courses",
    region: "Southern California",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Torrey Pines North",     note: "Better ocean holes than South. Warmup with the prettier of the two." },
      { day: 2, order: 1, course: "Aviara",                 note: "Carlsbad. Arnold Palmer's lush green-thumb design. Total mood shift." },
      { day: 3, order: 1, course: "Torrey Pines South",     note: "The U.S. Open course. Walk it. Pretend you're Tiger in 2008." },
    ],
  },
];

const VIBE_TAGS = new Set(["BUCKET_LIST", "BUDDY_TRIP", "HIDDEN_GEM", "QUICK_HIT", "WILD_CARD"]);
const COST_BANDS = new Set(["$$", "$$$", "$$$$"]);

async function main() {
  console.log("\n🗺  Tour It — Catalog Expansion Itinerary Seeder");
  console.log("==================================================\n");

  for (const it of ITINERARIES) {
    if (!VIBE_TAGS.has(it.vibeTag))   throw new Error(`"${it.slug}": vibeTag "${it.vibeTag}" invalid`);
    if (!COST_BANDS.has(it.costBand)) throw new Error(`"${it.slug}": costBand "${it.costBand}" invalid`);
    if (it.stops.length !== it.durationDays) {
      throw new Error(`"${it.slug}": durationDays=${it.durationDays} but ${it.stops.length} stops`);
    }
  }

  const resolved = new Map();
  for (const it of ITINERARIES) {
    for (const s of it.stops) {
      if (resolved.has(s.course)) continue;
      const c = await resolveCourse(s.course);
      resolved.set(s.course, c);
      console.log(`  ✓ ${s.course.padEnd(35)} → ${c.name}`);
    }
  }
  console.log(`\nResolved ${resolved.size} unique courses across ${ITINERARIES.length} itineraries\n`);

  for (const it of ITINERARIES) {
    const lats = it.stops.map((s) => resolved.get(s.course).latitude);
    const lngs = it.stops.map((s) => resolved.get(s.course).longitude);
    const centLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const centLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

    const { error: delErr } = await sb.from("TripItinerary").delete().eq("slug", it.slug);
    if (delErr) throw new Error(`Delete by slug "${it.slug}": ${delErr.message}`);

    const now = new Date().toISOString();
    const itineraryId = randomUUID();
    const { error: insErr } = await sb.from("TripItinerary").insert({
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
    });
    if (insErr) throw new Error(`Insert "${it.slug}": ${insErr.message}`);

    const stopRows = it.stops.map((s) => ({
      id:          randomUUID(),
      itineraryId,
      courseId:    resolved.get(s.course).id,
      day:         s.day,
      order:       s.order,
      note:        s.note ?? null,
    }));
    const { error: stopsErr } = await sb.from("TripItineraryStop").insert(stopRows);
    if (stopsErr) throw new Error(`Insert stops for "${it.slug}": ${stopsErr.message}`);

    console.log(`  ✓ ${it.slug.padEnd(28)} (${it.stops.length} stops, centroid ${centLat.toFixed(3)},${centLng.toFixed(3)})`);
  }

  console.log(`\n✅ Seeded ${ITINERARIES.length} new itineraries\n`);
}

main().catch((e) => {
  console.error("\n❌", e.message);
  process.exit(1);
});
