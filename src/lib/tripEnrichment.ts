// Rich trip-itinerary enrichment, keyed by slug.
//
// The DB row has the structural fields (name, hero image, courses,
// region, vibeTag, costBand, durationDays). This module overlays the
// "human travel flavor": airport strategy, lodging tiers, vibe tags,
// who this is for / who should skip, fun fact, food/drink, etc.
//
// Kept in code rather than the DB until the catalog grows past ~30
// destinations — easier to iterate on copy without migrations, and
// every destination gets the same authored treatment without a CMS.
// Migrating to a JSONB column on TripItinerary is a 1-hour swap when
// we cross that threshold.
//
// US-only for the beta.

export type LodgingTier = {
  /** Top-tier resort / hotel — splurge play. */
  luxury?: string;
  /** Best-value play — clean, well-located, not blowing the bank. */
  value?: string;
  /** Best fit for groups (rental house, multi-room). */
  group?: string;
};

export type Airport = {
  code: string;
  name: string;
  driveMinutes: number;
  /** Why this one (vs alternates). */
  note?: string;
};

export type TripEnrichment = {
  // One-sentence hook the user reads first.
  oneLiner: string;
  // Tags surfaced as filter chips: "buddies", "luxury", "value",
  // "architecture", "bachelor", "couples", "weekend", "bucket-list".
  bestFor: string[];
  // Primary airport + optional alternate (for cheaper or shorter
  // flights from secondary markets).
  primaryAirport: Airport;
  alternateAirport?: Airport;
  // Lodging recommendations across price points.
  lodging: LodgingTier;
  // Cultural context — "what the group chat will remember."
  whatToRemember: string;
  // Honest "who should skip" so we don't oversell.
  skipIf: string;
  // Local food + drink — the non-golf layer.
  foodDrink: string;
  // One-line trivia / brag.
  funFact: string;
  // Logistics.
  walkingFriendly: boolean;
  rentalCarNeeded: boolean;
  // Best months (1=Jan, 12=Dec). Used for filter chips like
  // "Plan now (in season)" or "Save for [season]".
  bestMonths: number[];
};

export const TRIP_ENRICHMENT: Record<string, TripEnrichment> = {
  "pinehurst-pilgrimage": {
    oneLiner: "The closest thing America has to a golf town — built for walking, betting, and arguing about Donald Ross greens.",
    bestFor: ["buddies", "architecture", "bucket-list", "walking"],
    primaryAirport: { code: "RDU", name: "Raleigh-Durham", driveMinutes: 75, note: "Cleanest play for direct flights." },
    alternateAirport: { code: "CLT", name: "Charlotte Douglas", driveMinutes: 110 },
    lodging: {
      luxury: "The Carolina (on the Pinehurst Resort property — full stay-and-play access).",
      value: "Holly Inn or Mid Pines Inn — character, classic Sandhills bones.",
      group: "Village rental house — walking distance to the resort, beers on the porch after 36.",
    },
    whatToRemember: "Walking the Donald Ross routing of No. 2 with caddies who've memorized every break since you were in high school.",
    skipIf: "You want nightlife, big resort pools, or anything other than golf 36 holes a day.",
    foodDrink: "Pine Crest Inn for old-school clubhouse vibes. Drum & Quill for after-round pints.",
    funFact: "Pinehurst No. 2 is the only course to host the U.S. Open and U.S. Women's Open back-to-back in the same week (2014).",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [3, 4, 5, 9, 10, 11],
  },

  "bandon-dunes-marathon": {
    oneLiner: "Walk-only links golf on the Oregon coast — the closest American thing to a Scottish pilgrimage.",
    bestFor: ["buddies", "bucket-list", "walking", "architecture"],
    primaryAirport: { code: "OTH", name: "Southwest Oregon Regional (North Bend)", driveMinutes: 30, note: "Closest by far. Limited direct flights." },
    alternateAirport: { code: "PDX", name: "Portland International", driveMinutes: 270, note: "More flights but a 4½-hr drive south. Worth it if OTH is sold out." },
    lodging: {
      luxury: "Lily Pond or Chrome Lake suites — on-property, walking to first tees.",
      value: "Lodge or Inn rooms — same access, smaller rooms, real money saved.",
      group: "Grove Cottages — 4-bedroom on-property, group caddie pickups out the front door.",
    },
    whatToRemember: "The first time the fog lifts off Pacific Dunes and you realize you're on the edge of the continent.",
    skipIf: "You don't want to walk. There are no carts. None. Bring shoes that have been broken in.",
    foodDrink: "Pacific Grill at the lodge. McKee's Pub for late-night Guinness. Local Coos Bay seafood if you venture off-property.",
    funFact: "Mike Keiser built Bandon as a tribute to links golf without ever expecting it to make money — it now hosts multiple USGA championships.",
    walkingFriendly: true,
    rentalCarNeeded: false,
    bestMonths: [5, 6, 7, 8, 9, 10],
  },

  "monterey-coast": {
    oneLiner: "Pebble Beach is the postcard, but the Monterey Peninsula has three other top-100 courses in a 10-mile radius.",
    bestFor: ["bucket-list", "luxury", "couples", "architecture"],
    primaryAirport: { code: "MRY", name: "Monterey Regional", driveMinutes: 15, note: "Tiny but local — drops you 15 minutes from Pebble." },
    alternateAirport: { code: "SJC", name: "San Jose Mineta", driveMinutes: 90, note: "More flights, bigger fares, ~90 min north." },
    lodging: {
      luxury: "The Lodge at Pebble Beach or The Inn at Spanish Bay — both come with prime tee-time priority.",
      value: "Carmel Mission Inn or a Carmel-by-the-Sea boutique — 15 min from Pebble, half the price.",
      group: "Vacation rental in Carmel Valley — quieter, group dinners on a deck overlooking vineyards.",
    },
    whatToRemember: "Standing on the 7th tee at Pebble Beach pretending you're not nervous about a 90-yard wedge over the Pacific.",
    skipIf: "Your budget caps at $400/round. Pebble alone is $675+. The neighbors aren't much cheaper.",
    foodDrink: "The Bench at Pebble for sunset. Casanova in Carmel for the date night. Anywhere in Carmel for the wine.",
    funFact: "Pebble Beach has hosted six U.S. Opens — more than any other course in the modern rotation.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [4, 5, 6, 9, 10],
  },

  "streamsong-experience": {
    oneLiner: "Three of the most architecturally daring courses in America, built on a reclaimed phosphate mine in the Florida middle-of-nowhere.",
    bestFor: ["buddies", "architecture", "walking"],
    primaryAirport: { code: "TPA", name: "Tampa International", driveMinutes: 70, note: "Default play — closer to Streamsong than Orlando." },
    alternateAirport: { code: "MCO", name: "Orlando International", driveMinutes: 95 },
    lodging: {
      luxury: "Streamsong Resort lodge — on-property, package deals make this cheaper than it looks.",
      value: "Same lodge, just book the standard rooms instead of suites.",
      group: "On-property is the only realistic play — the next town is too far for groups.",
    },
    whatToRemember: "The total isolation. Once you check in, you're 45 minutes from anything that isn't the resort.",
    skipIf: "You like having other things to do at night besides eat at the lodge and go to bed early.",
    foodDrink: "Restaurant Fragmentary at the lodge — surprisingly serious chef-driven menu. P2O5 for cocktails after.",
    funFact: "Streamsong's Black course (Gil Hanse) was built on top of phosphate-mining spoil piles — the elevation isn't natural, it's industrial reclamation.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [1, 2, 3, 4, 10, 11, 12],
  },

  "scottsdale-desert-run": {
    oneLiner: "Desert golf meets actual nightlife — the rare trip where the after-round scene matches the courses.",
    bestFor: ["buddies", "bachelor", "luxury", "weekend"],
    primaryAirport: { code: "PHX", name: "Phoenix Sky Harbor", driveMinutes: 25, note: "Major hub, every airline, ~25 min to Old Town Scottsdale." },
    lodging: {
      luxury: "Four Seasons Scottsdale at Troon North — pool, spa, walking-distance practice facility.",
      value: "Hampton Inn or Hyatt Place in Old Town — close to the bars, cheap rooms.",
      group: "Old Town rental house — split four ways, walk to dinner + bars instead of Ubering.",
    },
    whatToRemember: "Stadium 16 at TPC Scottsdale empty in the morning. That same hole during the WM Phoenix Open packed with 20,000 people.",
    skipIf: "It's July or August. 115°F on the course is not a vibe.",
    foodDrink: "FnB or Maple & Ash for dinner. Bottled Blonde for the bar scene. Casa Cody for the morning patio breakfast.",
    funFact: "TPC Scottsdale's 16th hole is the only fully-enclosed stadium hole in professional golf.",
    walkingFriendly: false,
    rentalCarNeeded: true,
    bestMonths: [1, 2, 3, 4, 10, 11, 12],
  },

  "myrtle-beach-classic": {
    oneLiner: "100+ public courses, oceanfront condos, and the cheapest stay-and-play deals in American golf.",
    bestFor: ["buddies", "value", "weekend"],
    primaryAirport: { code: "MYR", name: "Myrtle Beach International", driveMinutes: 20 },
    alternateAirport: { code: "CHS", name: "Charleston International", driveMinutes: 100, note: "Worth it if MYR fares are inflated — Charleston is often cheaper to fly into." },
    lodging: {
      luxury: "Hammock Beach Resort or Marina Inn at Grande Dunes — oceanfront with stay-and-play.",
      value: "Beach Cove or Long Bay condos — kitchen, washer-dryer, half the price.",
      group: "Rental house in North Myrtle Beach — bedrooms for everyone, common room for the gambling.",
    },
    whatToRemember: "Eight rounds in four days. A different course every morning. Calabash seafood at night.",
    skipIf: "You want bucket-list architecture. Myrtle is volume and value, not Pinehurst.",
    foodDrink: "Sea Captain's House for the view. Wicked Tuna for the seafood. Pirates Voyage if you really lean in.",
    funFact: "Myrtle Beach has more golf courses per capita than anywhere else in the United States — and the lowest average round price among major golf destinations.",
    walkingFriendly: false,
    rentalCarNeeded: true,
    bestMonths: [3, 4, 5, 9, 10, 11],
  },

  "wisconsin-sand": {
    oneLiner: "Whistling Straits, Erin Hills, Sand Valley — three world-tour-grade courses inside a 3-hour radius.",
    bestFor: ["buddies", "architecture", "bucket-list", "walking"],
    primaryAirport: { code: "MKE", name: "Milwaukee Mitchell", driveMinutes: 60, note: "Closest to Whistling Straits and Erin Hills." },
    alternateAirport: { code: "MSN", name: "Madison Dane County", driveMinutes: 90, note: "Closer to Sand Valley." },
    lodging: {
      luxury: "Sand Valley Lodge for one half of the trip, American Club at Kohler for the other.",
      value: "Hampton Inn or Holiday Inn in Sheboygan — Whistling Straits is 15 min away.",
      group: "Sand Valley cottages or American Club guest houses — group-trip designed.",
    },
    whatToRemember: "Standing on Whistling Straits 17 with Lake Michigan to your left and four buddies arguing about club selection.",
    skipIf: "You want to play in October or later — Wisconsin winters close everything.",
    foodDrink: "The Immigrant Restaurant at the American Club — Wisconsin supper-club energy. Mammy Jamia's for cheese curds + beer.",
    funFact: "Whistling Straits has hosted three PGA Championships and the 2021 Ryder Cup — the most Tour events of any modern course built on a flat midwestern field.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [5, 6, 7, 8, 9],
  },

  "nebraska-sandhills": {
    oneLiner: "Sand Hills and Prairie Club — the most untouched links-style golf in the Western Hemisphere.",
    bestFor: ["bucket-list", "architecture", "walking", "hidden-gem"],
    primaryAirport: { code: "DEN", name: "Denver International", driveMinutes: 240, note: "Best fares — 4-hour drive northeast is part of the trip." },
    alternateAirport: { code: "OMA", name: "Omaha Eppley", driveMinutes: 300, note: "Approach from the east — same drive time, fewer flights." },
    lodging: {
      luxury: "Sand Hills GC lodge (members only — get a member invite if you can).",
      value: "Bunkhouse-style lodging at The Prairie Club or Awarii Dunes — clean, simple, golf-trip-perfect.",
      group: "Bunkhouse units at The Prairie Club — four guys to a unit, courses out the back door.",
    },
    whatToRemember: "Driving 40 miles between courses and not seeing another car. Skies that go to the horizon. Pure golf.",
    skipIf: "You need cell service, room service, or anything other than golf and a bunkhouse fridge.",
    foodDrink: "Whatever the lodge cooks. There's no restaurant scene out here — that's the point.",
    funFact: "Sand Hills GC has been rated America's #1 modern course by Golf Digest in nearly every ranking since 1995.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [5, 6, 7, 8, 9],
  },

  "northern-michigan-loop": {
    oneLiner: "Arcadia Bluffs, Crystal Downs, Forest Dunes — Lake Michigan summer golf that punches three weight classes above its reputation.",
    bestFor: ["buddies", "architecture", "hidden-gem"],
    primaryAirport: { code: "TVC", name: "Traverse City Cherry Capital", driveMinutes: 30, note: "Direct flights from Detroit, Chicago, Minneapolis seasonally." },
    alternateAirport: { code: "DTW", name: "Detroit Metro", driveMinutes: 240, note: "Cheaper fares but a real road trip north." },
    lodging: {
      luxury: "Bay Harbor or Arcadia Bluffs lodge.",
      value: "Holiday Inn Express in Traverse City — central to the whole loop.",
      group: "Lake-house rental on Lake Michigan — group dinners on the dock after rounds.",
    },
    whatToRemember: "9 PM sunsets in July, ice-cold beer on the porch, the smell of cherry orchards. American summer.",
    skipIf: "You're trying to go after September. Courses close, the lake gets cold, the magic is gone.",
    foodDrink: "Trattoria Stella for upscale. The Filling Station for casual. Sleder's for the dive bar that's been there since 1882.",
    funFact: "Crystal Downs (Alister MacKenzie, with Perry Maxwell) only opened to outside play in the last decade — for 80 years it was members-only and barely photographed.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [6, 7, 8, 9],
  },

  "coastal-carolina-public": {
    oneLiner: "Kiawah's Ocean Course and the Charleston-area public play that surrounds it — the bucket-list course with weekend logistics.",
    bestFor: ["buddies", "bucket-list", "weekend"],
    primaryAirport: { code: "CHS", name: "Charleston International", driveMinutes: 45, note: "Easy direct flights from most East Coast cities." },
    lodging: {
      luxury: "The Sanctuary at Kiawah Island — on-property, Ocean Course tee times come with the room.",
      value: "Downtown Charleston boutique hotel — 45 min to Kiawah but the city is half the trip.",
      group: "Kiawah villa rental — kitchen, beach access, group breakfast before 8 AM tee times.",
    },
    whatToRemember: "Standing on Kiawah Ocean Course 17 in 25 mph wind off the Atlantic. The shot you'll talk about for months.",
    skipIf: "You're not okay with serious wind. The Ocean Course in October is no joke.",
    foodDrink: "Husk in Charleston. FIG. The Ordinary. Charleston is one of the best food cities in America — plan dinners.",
    funFact: "Kiawah's Ocean Course hosted the 2012 and 2021 PGA Championships — Phil Mickelson won at 50, the oldest major champion ever.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [3, 4, 5, 10, 11],
  },

  "long-island-loop": {
    oneLiner: "Bethpage Black, Bethpage Red, and a handful of underrated municipal tracks within an hour of NYC.",
    bestFor: ["buddies", "value", "weekend", "architecture"],
    primaryAirport: { code: "JFK", name: "JFK", driveMinutes: 40, note: "Closest to Bethpage." },
    alternateAirport: { code: "LGA", name: "LaGuardia", driveMinutes: 45 },
    lodging: {
      luxury: "Garden City Hotel — old-money Long Island bones, walking distance to the train.",
      value: "Hampton Inn Plainview or any chain near Bethpage — basic, close, cheap.",
      group: "Stay in NYC and drive out for tee times — the night scene is half the appeal.",
    },
    whatToRemember: "Sleeping in the Bethpage parking lot in the back of a buddy's SUV to get a first-come walk-on tee time. The most New York thing you can do.",
    skipIf: "You can't handle 4:30 AM wake-ups for a tee time at the most accessible major-championship course in America.",
    foodDrink: "Peter Luger for the steakhouse pilgrimage. Russo's bakery for breakfast on the way to Bethpage.",
    funFact: "Bethpage Black is the only public course to host two U.S. Opens (2002, 2009) and a PGA Championship (2019), with the 2025 Ryder Cup added to the list.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [4, 5, 6, 9, 10],
  },

  "chicago-publics": {
    oneLiner: "Cog Hill, Cantigny, and a Chicago weekend that pairs Western Open history with deep-dish pizza.",
    bestFor: ["buddies", "value", "weekend"],
    primaryAirport: { code: "ORD", name: "O'Hare", driveMinutes: 50 },
    alternateAirport: { code: "MDW", name: "Midway", driveMinutes: 45, note: "Often cheaper, closer to downtown." },
    lodging: {
      luxury: "Pendry Chicago or Waldorf Astoria — downtown base, drive out for tee times.",
      value: "Loop chain hotel — close to Magnificent Mile, close to dinner, far enough from O'Hare to feel like the city.",
      group: "VRBO in the Loop or River North — 4-bedroom, group walks to dinner.",
    },
    whatToRemember: "Deep-dish at Lou Malnati's after a Cog Hill round. Cocktails at The Aviary at midnight.",
    skipIf: "You want oceanfront or mountain backdrop. Chicago golf is good but the scenery is endless cornfield.",
    foodDrink: "Pequod's deep-dish (the real one). Au Cheval for the burger. Alinea if you want to lose your mind.",
    funFact: "Cog Hill #4 ('Dubsdread') hosted 20 PGA Tour Western Open events — more than any other public course in Tour history.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [5, 6, 7, 8, 9, 10],
  },

  "pacific-northwest-underrated": {
    oneLiner: "Chambers Bay, Bandon's understudies, and a Seattle weekend that puts links golf 30 minutes from a real city.",
    bestFor: ["hidden-gem", "walking", "weekend"],
    primaryAirport: { code: "SEA", name: "Seattle-Tacoma", driveMinutes: 45, note: "Closest to Chambers Bay (45 min south)." },
    lodging: {
      luxury: "Hotel 1000 or Fairmont Olympic in downtown Seattle — drive south for the rounds.",
      value: "Tacoma waterfront hotel — closer to Chambers, half the price.",
      group: "Seattle Airbnb — pricier per night but pays back via group dinners at Pike Place.",
    },
    whatToRemember: "Walking the rolling fescue of Chambers Bay on a clear afternoon with Mt. Rainier on the horizon. America's quietest links experience.",
    skipIf: "It's January through March. The PNW has its rep for a reason.",
    foodDrink: "The Walrus and the Carpenter for oysters. Canlis if you're doing a celebration dinner. Anywhere in Pike Place for breakfast.",
    funFact: "Chambers Bay hosted the 2015 U.S. Open — the first time the Open was contested west of the Mississippi in 67 years.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [5, 6, 7, 8, 9],
  },

  "texas-stretch": {
    oneLiner: "PGA Frisco, Trinity Forest, and the surprisingly deep Dallas-Fort Worth public-and-resort scene.",
    bestFor: ["buddies", "weekend"],
    primaryAirport: { code: "DFW", name: "DFW", driveMinutes: 30, note: "Major hub, fares always reasonable." },
    alternateAirport: { code: "DAL", name: "Dallas Love Field", driveMinutes: 25 },
    lodging: {
      luxury: "Omni PGA Frisco — 36 holes on-property, the new American golf-resort blueprint.",
      value: "Hyatt Place in Frisco — clean, close, cheap.",
      group: "Frisco Airbnb — Dallas is sprawling, basing in Frisco keeps you near the new golf belt.",
    },
    whatToRemember: "PGA Frisco's Fields Ranch is the Tour-future course. Walking it before it goes on TV every year for the rest of your life.",
    skipIf: "It's July or August. Texas summer golf is for masochists.",
    foodDrink: "Pecan Lodge for BBQ. Knife for the steakhouse pilgrimage. Mi Cocina for Mex.",
    funFact: "PGA Frisco is the PGA of America's headquarters campus — built from scratch in 2022 specifically to host modern Tour events.",
    walkingFriendly: false,
    rentalCarNeeded: true,
    bestMonths: [3, 4, 5, 10, 11],
  },
};

/** Helper — get enrichment for a slug, or null if not yet authored. */
export function getEnrichment(slug: string): TripEnrichment | null {
  return TRIP_ENRICHMENT[slug] ?? null;
}

/** Helper — return all slug → enrichment pairs so the search page
 *  can join against TripItinerary rows for filter chips. */
export function allEnrichments(): { slug: string; enrichment: TripEnrichment }[] {
  return Object.entries(TRIP_ENRICHMENT).map(([slug, enrichment]) => ({ slug, enrichment }));
}

/** Filter-chip catalog. Order matters — this is the order chips
 *  render on the /search Trips tab. */
export const BEST_FOR_TAGS = [
  { id: "buddies", label: "Buddies trip" },
  { id: "bucket-list", label: "Bucket list" },
  { id: "luxury", label: "Luxury" },
  { id: "value", label: "Value" },
  { id: "weekend", label: "Weekend" },
  { id: "walking", label: "Walking" },
  { id: "architecture", label: "Architecture" },
  { id: "hidden-gem", label: "Hidden gem" },
  { id: "couples", label: "Couples" },
  { id: "bachelor", label: "Bachelor" },
] as const;

export type BestForTag = typeof BEST_FOR_TAGS[number]["id"];
