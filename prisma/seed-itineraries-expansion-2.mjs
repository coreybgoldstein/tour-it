#!/usr/bin/env node
/**
 * Tour It — Catalog Expansion Round 2
 *
 * Adds 15 more US destinations on top of the 26 already in the DB.
 * Idempotent on each new slug. Does NOT touch existing slugs.
 *
 * All courses must pass the public/accessible filter — no private
 * clubs. Probed via verify-expansion-courses-{3,4,5}.mjs.
 *
 * Run: node prisma/seed-itineraries-expansion-2.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
dotenv.config();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const COURSE_LOOKUP = {
  // NC Sandhills architecture
  "Tobacco Road":                 { dbName: "Tobacco Road Golf Club",                                  state: "NC" },
  "Tot Hill Farm":                { dbName: "Tot Hill Farm",                                           state: "NC" },
  "Mid Pines":                    { dbName: "Mid Pines",                                               state: "NC" },
  "Southern Pines GC":            { dbName: "Southern Pines Golf Club",                                state: "NC" },

  // Vermont fall foliage
  "Equinox":                      { dbName: "The Golf Club at The Equinox Resort",                     state: "VT" },
  "Stowe Mountain":               { dbName: "Stowe Mountain Club",                                     state: "VT" },
  "Sugarbush":                    { dbName: "Sugarbush Resort Golf Club",                              state: "VT" },
  "Killington":                   { dbName: "Killington Golf Course",                                  state: "VT" },

  // Tahoe summer
  "Edgewood Tahoe":               { dbName: "Edgewood Tahoe Golf Course",                              state: "NV" },
  "Old Greenwood":                { dbName: "Old Greenwood Golf Course",                               state: "CA" },
  "Coyote Moon":                  { dbName: "Coyote Moon Golf Course",                                 state: "CA" },

  // Coeur d'Alene lakes
  "Coeur d'Alene Resort":         { dbName: "The Coeur d'Alene Resort Golf Course",                    state: "ID" },
  "Circling Raven":               { dbName: "Circling Raven Golf Course",                              state: "ID" },

  // Sun Valley mountain
  "Trail Creek":                  { dbName: "Trail Creek Golf Course",                                 state: "ID" },
  "Bigwood":                      { dbName: "Bigwood Golf Course",                                     state: "ID" },
  "White Cloud Nine":             { dbName: "White Cloud Nine at Sun Valley",                          state: "ID" },

  // Colorado Rockies
  "Breckenridge":                 { dbName: "Breckenridge Golf Club",                                  state: "CO" },
  "Beaver Creek":                 { dbName: "Beaver Creek Golf Club",                                  state: "CO" },
  "Vail Golf":                    { dbName: "Vail Golf Course",                                        state: "CO" },
  "Red Sky (Norman)":             { dbName: "Red Sky Ranch Golf Club- Greg Norman Course",             state: "CO" },

  // Napa & Sonoma wine
  "Silverado":                    { dbName: "Silverado Resort",                                        state: "CA" },
  "Eagle Vines":                  { dbName: "Eagle Vines Golf Club",                                   state: "CA" },
  "Chardonnay":                   { dbName: "Chardonnay Golf Club",                                    state: "CA" },

  // Orlando family sampler
  "Reunion Resort":               { dbName: "Reunion Resort Golf Course",                              state: "FL" },
  "Disney Magnolia":              { dbName: "Disney's Magnolia Golf Course",                           state: "FL" },
  "Disney Palm":                  { dbName: "Disney's Palm Golf Course",                               state: "FL" },
  "Bay Hill":                     { dbName: "Bay Hill Golf Club",                                      state: "FL" },

  // Tampa Bay sampler
  "Innisbrook":                   { dbName: "Innisbrook Golf Resort",                                  state: "FL" },
  "TPC Tampa Bay":                { dbName: "TPC Tampa Bay",                                           state: "FL" },
  "Cabot Citrus Karoo":           { dbName: "Cabot Citrus Farms - Karoo",                              state: "FL" },

  // Williamsburg historic
  "Golden Horseshoe Gold":        { dbName: "Golden Horseshoe Golf Club Gold Course",                  state: "VA" },
  "Golden Horseshoe Green":       { dbName: "Golden Horseshoe Golf Club Green Course",                 state: "VA" },
  "Kingsmill Woods":              { dbName: "Kingsmill Resort: The Woods Course",                      state: "VA" },
  "Royal New Kent":               { dbName: "Royal New Kent Golf Club",                                state: "VA" },

  // Kentucky bourbon trail
  "Kearney Hill":                 { dbName: "Kearney Hill Golf Links",                                 state: "KY" },
  "University Club KY":           { dbName: "University Club of Kentucky",                             state: "KY" },
  "Heritage Hill":                { dbName: "Heritage Hill Golf Course",                               state: "KY" },
  "Persimmon Ridge":              { dbName: "Persimmon Ridge Golf Club",                               state: "KY" },

  // Biloxi Gulf Coast Casino
  "Fallen Oak":                   { dbName: "Fallen Oak Golf Course",                                  state: "MS" },
  "Grand Bear":                   { dbName: "Grand Bear Golf Course",                                  state: "MS" },
  "Shell Landing":                { dbName: "Shell Landing",                                           state: "MS" },
  "The Bridges":                  { dbName: "The Bridges Golf Club",                                   state: "MS" },

  // Mesquite Wolf Creek
  "Wolf Creek":                   { dbName: "Wolf Creek Golf Club",                                    state: "NV" },
  "Conestoga":                    { dbName: "Conestoga Golf Club",                                     state: "NV" },
  "Falcon Ridge":                 { dbName: "Falcon Ridge Golf Course",                                state: "NV" },

  // Tucson desert
  "Ventana Canyon":               { dbName: "Ventana Canyon Golf Course",                              state: "AZ" },
  "Omni Tucson National":         { dbName: "Omni Tucson National Golf Resort",                        state: "AZ" },
  "The Boulders":                 { dbName: "The Boulders Golf Club",                                  state: "AZ" },
  "Starr Pass":                   { dbName: "Starr Pass Golf Course",                                  state: "AZ" },

  // Lake of the Ozarks
  "Old Kinderhook":               { dbName: "Old Kinderhook Resort, Golf, Club & Spa",                 state: "MO" },
  "Osage National":               { dbName: "Osage National Golf Club",                                state: "MO" },
  "Bear Creek Valley":            { dbName: "Bear Creek Valley Golf Club",                             state: "MO" },
};

async function resolveCourse(briefName) {
  const entry = COURSE_LOOKUP[briefName];
  if (!entry) throw new Error(`COURSE_LOOKUP missing entry for "${briefName}"`);
  let q = sb
    .from("Course")
    .select("id, name, city, isPublic, latitude, longitude")
    .ilike("name", entry.dbName)
    .eq("state", entry.state)
    .limit(5);
  if (entry.city) q = q.ilike("city", entry.city);
  const { data, error } = await q;
  if (error) throw new Error(`Lookup failed for "${briefName}": ${error.message}`);
  if (!data || data.length === 0) throw new Error(`Course "${briefName}" not found (looked up "${entry.dbName}" in ${entry.state})`);
  if (data.length > 1) throw new Error(`"${briefName}" matched ${data.length} rows — ambiguous: ${data.map((r) => `${r.name} (${r.city})`).join("; ")}`);
  const c = data[0];
  if (c.latitude == null || c.longitude == null) throw new Error(`"${briefName}" (${c.id}) has null lat/lng`);
  if (c.isPublic === false) throw new Error(`"${briefName}" (${c.id}) is private — accessible-only rule violated`);
  return c;
}

const ITINERARIES = [
  {
    slug: "nc-sandhills-architecture",
    name: "Sandhills Architecture Loop",
    tagline: "Mike Strantz's wildest design and three Donald Ross classics — one tank of gas, four totally different rounds.",
    whyThisTrip: "Tobacco Road is the most polarizing public course in America — Mike Strantz turned an old sandpit into a moonscape of blind shots and 100-foot dunes. Pair it with Tot Hill Farm (Strantz's other wild design) and you've got the architecture nerd's dream weekend. Then drive 45 minutes south to Southern Pines and Mid Pines — two Donald Ross originals lovingly restored by Kyle Franz. Four rounds, four totally different shapes of golf.",
    vibeTag: "HIDDEN_GEM",
    costBand: "$$",
    bestSeasonStart: 3,
    bestSeasonEnd: 5,
    durationDays: 4,
    stayRec: "Holly Inn or a Southern Pines rental — central to all four",
    region: "Carolina Sandhills",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Tot Hill Farm",        note: "Warm up to Strantz's vocabulary — blind shots, false fronts." },
      { day: 2, order: 1, course: "Tobacco Road",         note: "Strantz's masterpiece. Wear sunglasses — the sand is blinding." },
      { day: 3, order: 1, course: "Southern Pines GC",    note: "Donald Ross 1906 routing, Kyle Franz restoration. Walk it." },
      { day: 4, order: 1, course: "Mid Pines",            note: "Sister course to Pine Needles. The greens are the test." },
    ],
  },
  {
    slug: "vermont-fall-foliage",
    name: "Vermont Fall Foliage",
    tagline: "Three weeks a year, every fairway is on fire and every par 3 looks like a postcard.",
    whyThisTrip: "Mid-September to mid-October is the only window — but if you nail it, the Green Mountains turn into a 200-mile photo shoot and you've got first-tee times because most golfers have already winterized. Equinox is the Manchester resort splurge. Stowe Mountain Club is the up-and-down par-3 fantasy. Sugarbush plays through Mad River Valley. Killington routes around a working ski mountain. Plan around peak color — usually first week of October — and book a leaf-peeping audio tour with the rental car.",
    vibeTag: "HIDDEN_GEM",
    costBand: "$$$",
    bestSeasonStart: 9,
    bestSeasonEnd: 10,
    durationDays: 4,
    stayRec: "The Equinox Resort in Manchester, or an inn-hop along Route 7",
    region: "New England",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Equinox",              note: "Manchester Village base. Start here — easiest tee times, prettiest clubhouse." },
      { day: 2, order: 1, course: "Killington",           note: "Drive north. Par-3 over a ravine — bring extras." },
      { day: 3, order: 1, course: "Sugarbush",            note: "Mad River Valley. Front nine flat, back nine climbs into the foliage." },
      { day: 4, order: 1, course: "Stowe Mountain",       note: "Bob Cupp design, dramatic elevation. Save for last — best photos." },
    ],
  },
  {
    slug: "tahoe-summer",
    name: "Tahoe Summer",
    tagline: "Three rounds at 6,200 feet, the lake glowing alpine-blue from every tee.",
    whyThisTrip: "The ski crowd has finally cleared and the air is bone-dry — perfect golf weather, your ball flies 8% farther, and 7 PM dinners are still in shirtsleeves. Edgewood Tahoe sits literally on the south shore — five holes touch the lake. Old Greenwood is the Jack Nicklaus pine-and-meadow design near Truckee. Coyote Moon adds the granite-cliff Sierra finale. Stay in a Truckee cabin and your group dinner takes 15 minutes to get to.",
    vibeTag: "HIDDEN_GEM",
    costBand: "$$$",
    bestSeasonStart: 6,
    bestSeasonEnd: 9,
    durationDays: 3,
    stayRec: "Truckee or Tahoe City rental — central to all three",
    region: "Sierra Nevada",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Coyote Moon",          note: "Truckee. Granite cliffs, no houses. Easiest walk." },
      { day: 2, order: 1, course: "Old Greenwood",        note: "Nicklaus design. Meadow and pine — wide fairways for altitude bombing." },
      { day: 3, order: 1, course: "Edgewood Tahoe",       note: "South shore. Lake-front 17th and 18th. Save for last." },
    ],
  },
  {
    slug: "coeur-dalene-lakes",
    name: "Coeur d'Alene Lake Weekend",
    tagline: "America's only floating green and a Coore-Crenshaw classic in deep Idaho woods.",
    whyThisTrip: "Coeur d'Alene Resort is famous for one thing: the par-3 14th is a floating green that gets towed into position every morning. Ride the boat shuttle from the lakeside hotel to the first tee. Then drive 30 minutes south to Circling Raven — a Gene Bates design that runs through 600 acres of pine-and-marsh on the Coeur d'Alene Tribe's land, regularly ranked top-100 public. Two days, one rental car, zero crowds.",
    vibeTag: "HIDDEN_GEM",
    costBand: "$$$",
    bestSeasonStart: 6,
    bestSeasonEnd: 9,
    durationDays: 2,
    stayRec: "The Coeur d'Alene Resort — boat shuttle to first tee, lakefront",
    region: "Inland Northwest",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Circling Raven",       note: "Drive south first day. Gene Bates pine-and-marsh routing." },
      { day: 2, order: 1, course: "Coeur d'Alene Resort", note: "Boat to the first tee. Land the floating green and you get a certificate." },
    ],
  },
  {
    slug: "sun-valley-mountain",
    name: "Sun Valley Mountain Air",
    tagline: "Three Idaho high-country rounds in the original American ski resort.",
    whyThisTrip: "Sun Valley is where American ski resorts were invented — a 1936 Union Pacific destination built specifically to give the East Coast somewhere to fly. In summer, the same valley becomes a golf paradise at 6,000 feet. Trail Creek (the resort course) is a Robert Trent Jones Jr. design through the cottonwoods. Bigwood is the walking-friendly muni you can stroll from the lodge. White Cloud Nine adds a creekside short-game session. The whole village is one square mile — perfect zero-logistics buddy trip.",
    vibeTag: "HIDDEN_GEM",
    costBand: "$$$",
    bestSeasonStart: 6,
    bestSeasonEnd: 9,
    durationDays: 3,
    stayRec: "Sun Valley Lodge or Ketchum hotel — walking distance to everything",
    region: "Idaho Mountain",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Bigwood",              note: "Ketchum muni. Walking 9-and-9 warm-up. Cheap and quick." },
      { day: 2, order: 1, course: "Trail Creek",          note: "Resort headliner. RTJ Jr. design — bring extras for the creek crossings." },
      { day: 3, order: 1, course: "White Cloud Nine",     note: "Par-3 closer. Drink-cart pace, sunset tee time." },
    ],
  },
  {
    slug: "colorado-rockies-loop",
    name: "Colorado Rockies Loop",
    tagline: "Four Rocky Mountain rounds at 8,000+ feet — your driver carries forever and the air smells like pine.",
    whyThisTrip: "Summer in Colorado ski country is one of America's great golf secrets. Breckenridge is the only Jack Nicklaus muni in the world — 27 holes wrapped around a beaver pond at 9,300 feet. Beaver Creek is the Robert Trent Jones Jr. design tucked into the resort village. Vail Golf Club is the historic Press Maxwell design (you'll bird the Gore Range views). Red Sky's Norman course is the bucket-list closer — 300-foot elevation drops on tee shots. Cool nights, no humidity, and ski-town apres every evening.",
    vibeTag: "BUCKET_LIST",
    costBand: "$$$",
    bestSeasonStart: 6,
    bestSeasonEnd: 9,
    durationDays: 4,
    stayRec: "Vail Village or Beaver Creek — central to all four; consider a 2-night/2-night split",
    region: "Colorado Rockies",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Vail Golf",            note: "Public muni, oldest layout. Easy ease-in to altitude." },
      { day: 2, order: 1, course: "Breckenridge",         note: "Drive over Vail Pass. Only Nicklaus muni in the world. Walk if you can." },
      { day: 3, order: 1, course: "Beaver Creek",         note: "Resort village course. RTJ Jr. — bring layers, mornings are 50°." },
      { day: 4, order: 1, course: "Red Sky (Norman)",     note: "Save the splurge for last. 300-ft elevation drops on the par 5s." },
    ],
  },
  {
    slug: "napa-sonoma-wine",
    name: "Napa & Sonoma Wine Country",
    tagline: "Three Napa rounds, vineyards on every approach, the night ending in a tasting room.",
    whyThisTrip: "The most adult golf trip on the menu. Silverado Resort is the historic Robert Trent Jones design with two championship courses on property — host of the PGA Tour's Fortinet Championship. Eagle Vines and Chardonnay sit five miles apart in American Canyon, both routed straight through working vineyards. Golf in the morning, vineyards in the afternoon, wood-fired dinners every night. Best version of this trip: late September during harvest, when the vines are heavy and the cellars are open.",
    vibeTag: "WILD_CARD",
    costBand: "$$$",
    bestSeasonStart: 4,
    bestSeasonEnd: 10,
    durationDays: 3,
    stayRec: "Silverado Resort or a Yountville inn — central to vineyards and golf",
    region: "Napa Valley",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Chardonnay",           note: "Vineyard-routed warmup. Half the holes border working grape rows." },
      { day: 2, order: 1, course: "Eagle Vines",          note: "Five minutes from Chardonnay. Tougher, more elevation." },
      { day: 3, order: 1, course: "Silverado",            note: "PGA Tour venue. Save for last — Trail Course is the Fortinet stop." },
    ],
  },
  {
    slug: "orlando-family-sampler",
    name: "Orlando Family Sampler",
    tagline: "Four rounds, kids at the parks, every night ends at a different chain steakhouse.",
    whyThisTrip: "Orlando is built for family golf — direct flights, three theme parks, and 50+ public courses inside the I-4 corridor. Reunion Resort has three signature courses (Watson, Nicklaus, Palmer) all on one property. Disney's two original courses are open to the public — Magnolia hosted the Tour for decades. Bay Hill is Arnie's home and you can play the same Saturday tee boxes the Tour plays in March. Stay at Reunion or a Disney resort, golf 36 holes a day if you want.",
    vibeTag: "BUDDY_TRIP",
    costBand: "$$$",
    bestSeasonStart: 1,
    bestSeasonEnd: 5,
    durationDays: 4,
    stayRec: "Reunion Resort or a Disney Springs hotel — both work for non-golfers",
    region: "Central Florida",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Disney Palm",          note: "Hosted the PGA Tour into the '90s. Easy ease-in." },
      { day: 2, order: 1, course: "Disney Magnolia",      note: "Longer Disney course. The 6th's water hazard is shaped like Mickey." },
      { day: 3, order: 1, course: "Reunion Resort",       note: "Pick the Nicklaus track if it's available. Best on property." },
      { day: 4, order: 1, course: "Bay Hill",             note: "Arnold Palmer's home course. Tour stop in March. Bucket-list closer." },
    ],
  },
  {
    slug: "tampa-bay-sampler",
    name: "Tampa Bay Sampler",
    tagline: "PGA Tour venues, world-class greens, fish tacos between rounds.",
    whyThisTrip: "Tampa flies direct from every northeastern city and gives you three completely different rounds without ever changing your hotel. Innisbrook (Copperhead) is the PGA Tour's Valspar Championship venue — one of the toughest finishing 3-hole stretches in the Tour rotation. TPC Tampa Bay is the Bobby Weed design routed through pine flatwoods with bunkers everywhere. Cabot Citrus Farms (the old World Woods reimagining) is the new top-100 Florida headline — opened 2024, already top-50 public in the US. Three rounds, one car, all top-shelf.",
    vibeTag: "BUCKET_LIST",
    costBand: "$$$",
    bestSeasonStart: 1,
    bestSeasonEnd: 4,
    durationDays: 3,
    stayRec: "Innisbrook Resort or downtown St. Pete — both within 60 min of all three",
    region: "Tampa Bay",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "TPC Tampa Bay",        note: "Lutz. Bobby Weed design — bunkers everywhere, plenty of bail-outs." },
      { day: 2, order: 1, course: "Innisbrook",           note: "Copperhead Course is the Tour stop. Snake Pit (16/17/18) lives up to its name." },
      { day: 3, order: 1, course: "Cabot Citrus Karoo",   note: "Old World Woods, reborn 2024. Top-50 US public. Save for last." },
    ],
  },
  {
    slug: "williamsburg-historic",
    name: "Williamsburg Historic Triangle",
    tagline: "Colonial history by day, four heritage public courses including two by Rees Jones.",
    whyThisTrip: "Williamsburg is the easiest golf-and-history combo on the East Coast. Golden Horseshoe Gold is Robert Trent Jones Sr.'s favorite of his own designs (he said so) — routed straight through colonial woods. The Green Course (Rees Jones) is the public-side complement. Kingsmill Resort's River Course is the LPGA Tour stop. Royal New Kent is the wild Mike Strantz design 30 minutes north — turns Williamsburg into a Scottish links for a day. Pair every round with a different colonial tavern.",
    vibeTag: "WILD_CARD",
    costBand: "$$$",
    bestSeasonStart: 4,
    bestSeasonEnd: 6,
    durationDays: 4,
    stayRec: "Williamsburg Inn or a Colonial Williamsburg historic property",
    region: "Mid-Atlantic",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Golden Horseshoe Green", note: "Rees Jones warm-up. Tight corridors, classic shapes." },
      { day: 2, order: 1, course: "Royal New Kent",       note: "Drive 30 min north. Strantz's Scottish-links experiment in tidewater Virginia." },
      { day: 3, order: 1, course: "Kingsmill Woods",      note: "Resort course on the James River. LPGA pedigree." },
      { day: 4, order: 1, course: "Golden Horseshoe Gold", note: "RTJ Sr.'s favorite design. Save for last — colonial woods, vintage routing." },
    ],
  },
  {
    slug: "kentucky-bourbon-trail",
    name: "Kentucky Bourbon Trail Golf",
    tagline: "Pete Dye public courses, Bluegrass parkland, bourbon tastings between rounds.",
    whyThisTrip: "Kentucky's secret: half its best courses are public, and the Bourbon Trail's 18 distilleries are within 90 minutes of every tee. Kearney Hill (Lexington) is one of Pete Dye's most underrated municipal designs — host of the Senior PGA. Persimmon Ridge (Shelby County) is the Louisville-area Dye public option. University Club of Kentucky is the parkland Bluegrass walk. Heritage Hill rounds out a 4-day rotation. Buffalo Trace, Maker's Mark, Woodford Reserve — all within day-trip range.",
    vibeTag: "WILD_CARD",
    costBand: "$$",
    bestSeasonStart: 4,
    bestSeasonEnd: 6,
    durationDays: 4,
    stayRec: "Louisville hotel + Lexington Airbnb split — bourbon trail runs between them",
    region: "Kentucky",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Heritage Hill",        note: "Louisville. Bluegrass parkland warm-up." },
      { day: 2, order: 1, course: "Persimmon Ridge",      note: "Shelby County. Pete Dye public — bring extras." },
      { day: 3, order: 1, course: "University Club KY",   note: "Lexington. Classic Bluegrass routing, easy walk." },
      { day: 4, order: 1, course: "Kearney Hill",         note: "Lexington Pete Dye. Senior PGA pedigree. Save for last." },
    ],
  },
  {
    slug: "biloxi-gulf-coast-casino",
    name: "Biloxi Gulf Coast Casino",
    tagline: "Four Gulf Coast rounds, casino dinners every night, half the price of Vegas.",
    whyThisTrip: "Biloxi is what Vegas was 20 years ago — beach-front casinos, $79 rooms midweek, and 15 public golf courses inside a 30-minute radius. Fallen Oak is the headliner — the Tom Fazio bucket-list resort course inside the Beau Rivage. Grand Bear is the Jack Nicklaus Signature design through DeSoto National Forest. Shell Landing and The Bridges round out the rotation with two of the best-conditioned everyday plays on the coast. Eat blackened redfish for lunch, win or lose at the craps table for dinner.",
    vibeTag: "WILD_CARD",
    costBand: "$$",
    bestSeasonStart: 3,
    bestSeasonEnd: 5,
    durationDays: 4,
    stayRec: "Beau Rivage or IP Casino — Fallen Oak shuttle requires a casino-hotel stay",
    region: "Gulf Coast",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Shell Landing",        note: "Gautier. Davis Love III design — wide ease-in." },
      { day: 2, order: 1, course: "The Bridges",          note: "Bay St. Louis. Hollywood Casino-attached. Walkable in places." },
      { day: 3, order: 1, course: "Grand Bear",           note: "Jack Nicklaus through DeSoto National Forest. No houses, no roads." },
      { day: 4, order: 1, course: "Fallen Oak",           note: "Tom Fazio bucket-list closer. Stay at Beau Rivage for tee access." },
    ],
  },
  {
    slug: "mesquite-wolf-creek",
    name: "Mesquite Wolf Creek Stretch",
    tagline: "America's most photographed public course — and two cheaper desert siblings around it.",
    whyThisTrip: "Wolf Creek is the Instagram course. Every shot is a target. Every elevation change is 100 feet. It looks like Bryce Canyon hosting a golf tournament. Mesquite, Nevada sits 80 minutes north of Vegas, and around Wolf Creek you've got Conestoga (the upscale newcomer) and Falcon Ridge (the value play). Three rounds, three completely different desert environments, all $100-$300. Stay in Mesquite for the cheap rooms or commute from Vegas. Either way: bring a camera.",
    vibeTag: "WILD_CARD",
    costBand: "$$",
    bestSeasonStart: 3,
    bestSeasonEnd: 5,
    durationDays: 3,
    stayRec: "CasaBlanca or Eureka Resort in Mesquite — cheaper than Vegas, walking distance to everything",
    region: "Mojave Desert",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Falcon Ridge",         note: "Cheaper warmup. Get your feel for desert target golf." },
      { day: 2, order: 1, course: "Conestoga",            note: "Newer, more polished. Mountain backdrops on every tee." },
      { day: 3, order: 1, course: "Wolf Creek",           note: "Save the camera roll for last. Don't keep score. Just take pictures." },
    ],
  },
  {
    slug: "tucson-desert",
    name: "Tucson Desert Rotation",
    tagline: "Saguaro cacti, Catalina mountain backdrops, and four desert layouts at half Scottsdale prices.",
    whyThisTrip: "Tucson is what Scottsdale was 30 years ago — same desert, same blue skies, half the crowd and half the price. Ventana Canyon is the Tom Fazio bucket-list resort design — every hole frames the Catalina Mountains. Omni Tucson National hosts the Tucson Conquistadores Pro-Am. The Boulders sits an hour north in Carefree — Jay Morrish design among red boulders. Starr Pass rounds it out with two Arnold Palmer 18s in west Tucson. Late winter / early spring is the sweet spot.",
    vibeTag: "HIDDEN_GEM",
    costBand: "$$",
    bestSeasonStart: 1,
    bestSeasonEnd: 4,
    durationDays: 4,
    stayRec: "Loews Ventana Canyon or JW Marriott Starr Pass — both have on-property courses",
    region: "Sonoran Desert",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Starr Pass",           note: "West Tucson Arnold Palmer. Walking-friendly on the front." },
      { day: 2, order: 1, course: "Omni Tucson National", note: "Pro-Am host. Classic 70s desert design — wider corridors." },
      { day: 3, order: 1, course: "The Boulders",         note: "Drive an hour north to Carefree. Red rock outcroppings on every hole." },
      { day: 4, order: 1, course: "Ventana Canyon",       note: "Save for last. Fazio's desert bucket-list. The 3rd is the picture." },
    ],
  },
  {
    slug: "lake-of-the-ozarks",
    name: "Lake of the Ozarks",
    tagline: "Boat to lunch, golf between, the Midwest's quietly excellent lake-resort scene.",
    whyThisTrip: "Lake of the Ozarks is what Midwesterners do instead of going to the coast — a 92-mile lake with three Tom Weiskopf and Robert Trent Jones Jr. courses on it, plus the cheapest premium golf in the state. Old Kinderhook (Tom Weiskopf) is the headliner — multi-time top-10 Missouri public. Osage National sits across the lake with three nine-hole loops. Bear Creek Valley is the under-$60 value play. Stay in a Camdenton or Osage Beach rental with a boat slip; commute by water if you want.",
    vibeTag: "HIDDEN_GEM",
    costBand: "$$",
    bestSeasonStart: 5,
    bestSeasonEnd: 9,
    durationDays: 3,
    stayRec: "Osage Beach rental or Old Kinderhook villas — boat slip is the cheat code",
    region: "Ozarks",
    heroImageUrl: null,
    stops: [
      { day: 1, order: 1, course: "Bear Creek Valley",    note: "Osage Beach value play. Bluff routing — bring your driver." },
      { day: 2, order: 1, course: "Osage National",       note: "27 holes by Arnold Palmer. Pick the Mountain nine first." },
      { day: 3, order: 1, course: "Old Kinderhook",       note: "Tom Weiskopf headliner. Save for last — best conditions and views." },
    ],
  },
];

const VIBE_TAGS = new Set(["BUCKET_LIST", "BUDDY_TRIP", "HIDDEN_GEM", "QUICK_HIT", "WILD_CARD"]);
const COST_BANDS = new Set(["$$", "$$$", "$$$$"]);

async function main() {
  console.log("\n🗺  Tour It — Catalog Expansion Round 2");
  console.log("=========================================\n");

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
      console.log(`  ✓ ${s.course.padEnd(28)} → ${c.name}`);
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

    console.log(`  ✓ ${it.slug.padEnd(32)} (${it.stops.length} stops)`);
  }

  console.log(`\n✅ Seeded ${ITINERARIES.length} new itineraries\n`);
}

main().catch((e) => {
  console.error("\n❌", e.message);
  process.exit(1);
});
