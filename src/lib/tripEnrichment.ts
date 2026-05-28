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

  "big-cedar-ozarks": {
    oneLiner: "Tiger's first public design, Coore-Crenshaw's masterpiece, and Nicklaus's par-3 closer — all on one Bass Pro ridge.",
    bestFor: ["buddies", "architecture", "bucket-list", "hidden-gem"],
    primaryAirport: { code: "SGF", name: "Springfield-Branson National", driveMinutes: 70, note: "Easiest direct option." },
    alternateAirport: { code: "XNA", name: "Northwest Arkansas Regional", driveMinutes: 110 },
    lodging: {
      luxury: "Big Cedar Lodge — Knotty Pine Cabins or the Falls Lodge; shuttle to every course.",
      value: "Branson Hilton Convention Center — 25 min away, half the rate.",
      group: "Big Cedar group cabins (sleeps 6-12) — fireplaces, decks over Table Rock Lake.",
    },
    whatToRemember: "Standing on Payne's Valley's 19th — the cave hole — and trying to convince your group it's not photoshopped.",
    skipIf: "You want walkable golf. Big Cedar is cart-mandatory; the property is huge.",
    foodDrink: "Devil's Pool Restaurant at Big Cedar — wild game and steak. Pickin' Porch BBQ in Branson for the divey antidote.",
    funFact: "Payne's Valley is named for Payne Stewart and opened in 2020 — the first public-access course Tiger Woods ever designed.",
    walkingFriendly: false,
    rentalCarNeeded: true,
    bestMonths: [4, 5, 6, 9, 10],
  },

  "hilton-head-lowcountry": {
    oneLiner: "Live oaks, the Harbour Town lighthouse, and the most photogenic 18th hole in resort golf.",
    bestFor: ["buddies", "bucket-list", "couples", "weekend"],
    primaryAirport: { code: "SAV", name: "Savannah/Hilton Head Int'l", driveMinutes: 45, note: "Closest non-regional option." },
    alternateAirport: { code: "HHH", name: "Hilton Head Island Airport", driveMinutes: 15, note: "Tiny — limited inbound flights." },
    lodging: {
      luxury: "The Sea Pines Resort — Inn & Club; walking distance to Harbour Town first tee.",
      value: "Marriott Grande Ocean — beachfront, midweek rates drop hard in shoulder season.",
      group: "Sea Pines villa rental — 4-6BR oceanfront houses split four ways beat any hotel.",
    },
    whatToRemember: "Standing in the fairway on 18 at Harbour Town, the candy-striped lighthouse framing your approach. You've seen it on TV a hundred times.",
    skipIf: "You're chasing nightlife. Hilton Head shuts down at 10pm — by design.",
    foodDrink: "Hudson's Seafood for sunset oysters. Quarterdeck at Harbour Town for the post-round daiquiri. Skull Creek Boathouse for the group dinner.",
    funFact: "Harbour Town opened in 1969 and was Pete Dye's first major design — the lighthouse 18th was demanded by developer Charles Fraser specifically to be 'instantly recognizable from a TV blimp.'",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [3, 4, 5, 10, 11],
  },

  "vegas-strip-stretch": {
    oneLiner: "Sunrise tee times, blackjack nights, and the only par-72 with a casino visible from the tee.",
    bestFor: ["buddies", "bachelor", "weekend", "luxury"],
    primaryAirport: { code: "LAS", name: "Harry Reid International", driveMinutes: 15, note: "Strip is 10 min away. Just take a rideshare." },
    lodging: {
      luxury: "Wynn or Encore — play Wynn at sunrise, walk back to the property.",
      value: "Excalibur or NYNY — south-strip, walking distance to Bali Hai.",
      group: "Strip suite share — split a 2BR villa at Cosmo/Aria, do the budget on the table not the room.",
    },
    whatToRemember: "Teeing off Wynn at 6:30am with the sphere and the strip in your sightline and no one else on the course.",
    skipIf: "You can't get up at 5am. Vegas golf is sunrise-or-bust in summer — 110° by noon.",
    foodDrink: "Carbone for the group dinner. Esther's Kitchen downtown for the off-strip night. In-N-Out as the 4am cure.",
    funFact: "Wynn Golf Course was demolished in 2017 to build the Encore Las Vegas, then rebuilt in 2019 by Tom Fazio — making it the only course in America that has been deleted and re-created on the same plot.",
    walkingFriendly: false,
    rentalCarNeeded: false,
    bestMonths: [3, 4, 10, 11],
  },

  "palm-springs-warmup": {
    oneLiner: "January golf in 75-degree sun, four PGA West rotations, and snow on the mountains at 4 PM.",
    bestFor: ["buddies", "weekend", "value", "luxury"],
    primaryAirport: { code: "PSP", name: "Palm Springs International", driveMinutes: 30, note: "Tiny, easy, walk-the-tarmac vibes." },
    alternateAirport: { code: "LAX", name: "LAX", driveMinutes: 130, note: "Skip unless you're combining with LA." },
    lodging: {
      luxury: "La Quinta Resort & Club — original Hollywood-era resort, casitas, on PGA West property.",
      value: "Embassy Suites La Quinta — clean, central, suites for less than the resort.",
      group: "Palm Desert house rental — split a 4BR with a pool for less than 4 resort rooms.",
    },
    whatToRemember: "Standing on the par-3 17th at TPC Stadium — the island green — knowing you've seen it on the PGA Tour broadcast a dozen times.",
    skipIf: "It's May through September. You will melt. Snowbird season for a reason.",
    foodDrink: "Spencer's at the Mountain for the after-round patio. Bouschet for the buddy dinner. Sherman's Deli for the brunch.",
    funFact: "PGA West has six championship courses — only 18 properties in the world have more — and the Stadium Course was so brutal when it opened in 1986 that the PGA Tour banned it after one event for being 'unfair.' It returned in 2016.",
    walkingFriendly: false,
    rentalCarNeeded: true,
    bestMonths: [1, 2, 3, 4, 11, 12],
  },

  "park-city-altitude": {
    oneLiner: "8,000 feet of elevation makes your driver carry an extra 30 yards — and Park City Main Street has the apres dialed.",
    bestFor: ["weekend", "value", "walking", "hidden-gem"],
    primaryAirport: { code: "SLC", name: "Salt Lake City International", driveMinutes: 45, note: "Major hub. Easy direct from anywhere." },
    lodging: {
      luxury: "Stein Eriksen Lodge — Deer Valley slope-side, restorative-spa-after-36 vibes.",
      value: "Park City Marriott — Main Street walkable, half the rate of the Deer Valley properties.",
      group: "Old Town condo on Main Street — walk to dinner, drive to golf, no rental car needed once you're there.",
    },
    whatToRemember: "Crushing a drive that ACTUALLY goes 280 because of altitude, while a moose watches from the treeline.",
    skipIf: "It's October-May. Mountains. They have snow.",
    foodDrink: "Riverhorse on Main for the closer dinner. High West Saloon for the bourbon flight. No Name Saloon for the dive-bar Bloody Mary.",
    funFact: "Soldier Hollow hosted the 2002 Winter Olympic biathlon and cross-country skiing — the golf course routes through the same valley the athletes raced through.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [6, 7, 8, 9],
  },

  "big-island-golf": {
    oneLiner: "Black volcanic lava, electric-blue Pacific, and one of the original Robert Trent Jones Sr. masterpieces.",
    bestFor: ["bucket-list", "couples", "luxury"],
    primaryAirport: { code: "KOA", name: "Kona International", driveMinutes: 30, note: "On the Kohala Coast side — closest to every course." },
    lodging: {
      luxury: "Four Seasons Hualalai — splurge night to get tee access at Hualalai.",
      value: "Westin Hapuna Beach Resort — bordering Mauna Kea, half the rate of Four Seasons.",
      group: "Kohala Coast vacation rental — Mauna Lani villas split four ways are cheaper than the resort.",
    },
    whatToRemember: "Standing on Mauna Kea's 3rd tee — the all-carry over the Pacific — and realizing it's a 200-yard forced carry into the wind.",
    skipIf: "You expect it to be sunny everywhere. Kohala Coast is desert-dry, Hilo side rains every day.",
    foodDrink: "Merriman's at Mauna Lani for the founders-of-Hawaii-regional-cuisine dinner. Tommy Bahama's for the buddy round-table.",
    funFact: "Mauna Kea was Robert Trent Jones Sr.'s 1964 design — the resort and course were built specifically to entice Laurance Rockefeller's friends to keep visiting his new Mauna Kea Beach Hotel.",
    walkingFriendly: false,
    rentalCarNeeded: true,
    bestMonths: [4, 5, 6, 9, 10, 11],
  },

  "maui-trade-winds": {
    oneLiner: "Kapalua's Plantation course, sea-cliff sunsets, and a back-nine wind that defends every gust.",
    bestFor: ["bucket-list", "couples", "luxury"],
    primaryAirport: { code: "OGG", name: "Kahului Airport (Maui)", driveMinutes: 60, note: "60 min to Kapalua, 45 min to Wailea." },
    lodging: {
      luxury: "Montage Kapalua Bay — beachfront, walking distance to Plantation course.",
      value: "Ka'anapali Beach Hotel — local-owned, lower-key, 20 min to Plantation.",
      group: "Wailea Beach Villas — 3BR oceanfront, perfect for a 4-couple split.",
    },
    whatToRemember: "The 18th at Plantation — 663 yards downhill, ocean on the horizon, and you'll hit a 7-iron in.",
    skipIf: "You hate driving. Kapalua to Wailea is 1h15 each way; pick one base or split the stay.",
    foodDrink: "Mama's Fish House (book months ahead) for the bucket-list dinner. Monkeypod Kitchen at Wailea for the daily reliable.",
    funFact: "The Plantation course's 18th hole drops 200 feet of elevation from tee to green — long hitters can reach the par-5 in 2 with a smooth 3-wood thanks to the trade winds.",
    walkingFriendly: false,
    rentalCarNeeded: true,
    bestMonths: [4, 5, 6, 9, 10, 11],
  },

  "central-oregon-bend": {
    oneLiner: "Three lava-and-pine layouts at 4,000 feet, paired with the best brewery scene in the American West.",
    bestFor: ["buddies", "hidden-gem", "weekend", "walking"],
    primaryAirport: { code: "RDM", name: "Redmond Municipal (Bend)", driveMinutes: 25, note: "Tiny but direct from most West Coast hubs." },
    alternateAirport: { code: "PDX", name: "Portland International", driveMinutes: 200, note: "Only worth it if combining with Portland." },
    lodging: {
      luxury: "Tetherow Lodges — on-property, McLay Kidd cottages overlooking the course.",
      value: "Downtown Bend boutique (Oxford, McMenamins) — nightlife close, 15 min drive to golf.",
      group: "Sunriver Resort vacation home — multi-bedroom, walk to Crosswater first tee.",
    },
    whatToRemember: "Tetherow's no-tree front nine in evening light, with Mt. Bachelor still snow-capped in your background.",
    skipIf: "It's November-April. The high desert closes in winter.",
    foodDrink: "Deschutes Brewery (the OG) and Crux Fermentation Project for beer. Spork for the Asian-fusion buddy dinner.",
    funFact: "Tetherow was David McLay Kidd's first US design after Bandon Dunes — the same routing principles in 4,000 feet of high desert instead of Oregon Coast fog.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [5, 6, 7, 8, 9, 10],
  },

  "cape-cod-loop": {
    oneLiner: "Four muni-and-resort rounds along the Cape, lobster rolls between, sea breeze on every tee.",
    bestFor: ["buddies", "value", "walking", "hidden-gem"],
    primaryAirport: { code: "BOS", name: "Boston Logan", driveMinutes: 90, note: "Best fares; rent a car at the airport." },
    alternateAirport: { code: "PVD", name: "T.F. Green (Providence)", driveMinutes: 110 },
    lodging: {
      luxury: "Wequassett Resort & Golf Club — Chatham, Cape's only AAA-five-diamond.",
      value: "Cape Codder Resort, Hyannis — central to all four courses, half the rate.",
      group: "Brewster or Chatham 4BR rental — split four ways and you're paying $80/night each in shoulder season.",
    },
    whatToRemember: "Driving down 6A in late afternoon between courses, windows down, lobster roll smell from every shack.",
    skipIf: "It's mid-July or August. Locals call it Trafficmaggedon for a reason.",
    foodDrink: "The Lobster Pot in Provincetown. Arnold's in Eastham for the road-stop lobster roll. The Bramble Inn for the splurge dinner.",
    funFact: "Captains Golf Course (Brewster) was the first municipal 36-hole facility in Massachusetts — both courses opened in the same season in 1985.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [5, 6, 9, 10],
  },

  "rtj-alabama-trail": {
    oneLiner: "Three Robert Trent Jones Trail flagships, BBQ in every town, the cheapest premium golf you'll ever play.",
    bestFor: ["buddies", "value", "architecture", "hidden-gem"],
    primaryAirport: { code: "BHM", name: "Birmingham-Shuttlesworth", driveMinutes: 20, note: "Closest to Oxmoor + Ross Bridge." },
    alternateAirport: { code: "ATL", name: "Hartsfield-Jackson Atlanta", driveMinutes: 150, note: "Cheaper fares, longer drive." },
    lodging: {
      luxury: "Renaissance Ross Bridge Golf Resort — bagpiper plays at sunset every night.",
      value: "Marriott Shoals on the Tennessee River — pool overlooks the dam.",
      group: "Auburn-Opelika home rental — closest to Grand National, college-town SEC vibes.",
    },
    whatToRemember: "Standing on the 18th tee at Ross Bridge as a bagpiper walks out at sunset to play the property's closing call. It's not a gimmick if it actually works.",
    skipIf: "You expect resort polish. RTJ Trail is municipal-quality clubhouses with PGA-quality conditioning.",
    foodDrink: "Saw's BBQ in Homewood for the Birmingham stop. Acre in Auburn for the chef-driven Opelika dinner.",
    funFact: "Alabama state pension fund poured $400M into building the RTJ Trail in the 1990s — the bet was that 26 free-to-play-for-residents courses would attract retirees, conventions, and tourists. It worked: more than 11 million rounds played to date.",
    walkingFriendly: false,
    rentalCarNeeded: true,
    bestMonths: [3, 4, 5, 9, 10, 11],
  },

  "greenbrier-stretch": {
    oneLiner: "Three courses, one massive federal-era resort, a casino in the basement and Sam Snead's ghost on every tee box.",
    bestFor: ["bucket-list", "couples", "luxury", "architecture"],
    primaryAirport: { code: "LWB", name: "Greenbrier Valley", driveMinutes: 15, note: "Tiny direct shuttle from Atlanta/DC." },
    alternateAirport: { code: "ROA", name: "Roanoke Regional (VA)", driveMinutes: 110 },
    lodging: {
      luxury: "The Greenbrier — Presidential or Estate House if you can swing it.",
      value: "The Greenbrier Sporting Club rentals — same access, half the formality.",
      group: "Estate House at Greenbrier — historic homes on property, 4-8 BR, ideal for a couples-weekend foursome.",
    },
    whatToRemember: "Touring the Cold War-era bunker beneath the West Virginia Wing — built in secret to house Congress in case of nuclear attack.",
    skipIf: "You want casual. The Greenbrier is jackets-after-6 formal. Lean into it.",
    foodDrink: "Main Dining Room for the historic dinner. Prime 44 West for the steakhouse. Twelve Oaks for the lounge cocktail.",
    funFact: "The Greenbrier Bunker — declassified in 1992 — was built between 1958 and 1961 to house the entire US Congress in case of nuclear war, with the front 'West Virginia Wing' of the hotel serving as the cover story.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [5, 6, 9, 10],
  },

  "san-diego-coastal": {
    oneLiner: "Pacific cliffs, sea-fog mornings, and the U.S. Open public course every American golfer should play once.",
    bestFor: ["bucket-list", "couples", "weekend", "walking"],
    primaryAirport: { code: "SAN", name: "San Diego International", driveMinutes: 25, note: "Right downtown, the easiest big-city airport in America." },
    lodging: {
      luxury: "The Lodge at Torrey Pines — Craftsman elegance, walk to the first tee.",
      value: "Hilton La Jolla Torrey Pines — same property views, half the price.",
      group: "La Jolla vacation home — beachy, close to both Torrey and Aviara.",
    },
    whatToRemember: "Walking the 4th hole at Torrey Pines South — that cliffside par-3 over the canyon — knowing Tiger went birdie-birdie-eagle there in 2008.",
    skipIf: "You want guaranteed sun. May-June marine layer doesn't burn off until noon.",
    foodDrink: "George's at the Cove for the La Jolla sunset dinner. Eddie V's for steaks. Hodad's for the world-famous burger.",
    funFact: "Torrey Pines South hosted the 2008 U.S. Open — the one Tiger Woods won on one leg with a torn ACL — and remains one of only two public-access courses to ever host a regular U.S. Open (the other is Pebble Beach).",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [3, 4, 5, 9, 10],
  },

  "nc-sandhills-architecture": {
    oneLiner: "Mike Strantz's wildest moonscape paired with three Donald Ross classics — architecture nerd nirvana.",
    bestFor: ["architecture", "buddies", "value", "hidden-gem", "walking"],
    primaryAirport: { code: "RDU", name: "Raleigh-Durham", driveMinutes: 75 },
    alternateAirport: { code: "FAY", name: "Fayetteville Regional", driveMinutes: 45 },
    lodging: {
      luxury: "Mid Pines Inn — Donald Ross's actual former home, restored.",
      value: "Holly Inn or any Pinehurst Village rental — central and walkable.",
      group: "Southern Pines / Aberdeen 4BR house — all four courses inside 30 minutes.",
    },
    whatToRemember: "Standing on Tobacco Road's 18th tee — Strantz built a blind drive over a 70-foot dune, and you can't see anything until you crest the hill.",
    skipIf: "You hate blind shots, big fescue rough, or being mocked by your group for hitting it sideways.",
    foodDrink: "Drum & Quill in Pinehurst Village. Ironwood Cafe in Southern Pines. Pine Crest Inn for the old-school dinner.",
    funFact: "Mike Strantz designed only nine golf courses before dying of cancer at 50 in 2005 — Tobacco Road and Tot Hill Farm are arguably his most untamed work, both within 30 minutes of each other.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [3, 4, 5, 9, 10, 11],
  },

  "vermont-fall-foliage": {
    oneLiner: "A three-week window where every fairway is on fire and most golfers have already winterized.",
    bestFor: ["couples", "weekend", "walking", "hidden-gem"],
    primaryAirport: { code: "BTV", name: "Burlington International", driveMinutes: 60, note: "Closest to Stowe/Sugarbush. Direct from most Northeast cities." },
    alternateAirport: { code: "ALB", name: "Albany International", driveMinutes: 90, note: "Better for Equinox/Manchester side." },
    lodging: {
      luxury: "The Equinox in Manchester — Federal-era hotel, walk to the first tee.",
      value: "Trapp Family Lodge in Stowe — von Trapp family, fall views, midweek rates.",
      group: "Mad River Valley farmhouse rental — Sugarbush + Killington proximity.",
    },
    whatToRemember: "Teeing off a par 3 with the leaves at PEAK color and the morning frost still on the green — silence, then the strike.",
    skipIf: "It's not late September through mid-October. Outside that 3-week window, you're either too early or too late.",
    foodDrink: "Hen of the Wood (Burlington & Waterbury). The Reluctant Panther in Manchester. Maple Pecan everything.",
    funFact: "Vermont's foliage 'peak week' moves about 50 miles south per week starting in mid-September — peakvermont.org publishes a live map golfers can plan rounds against.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [9, 10],
  },

  "tahoe-summer": {
    oneLiner: "Three rounds at 6,200 feet, an alpine lake glowing from every tee, ski-town apres still in shirtsleeves at 7 PM.",
    bestFor: ["buddies", "couples", "hidden-gem", "walking"],
    primaryAirport: { code: "RNO", name: "Reno-Tahoe International", driveMinutes: 60, note: "Closest. Direct from West Coast hubs." },
    alternateAirport: { code: "SMF", name: "Sacramento International", driveMinutes: 120 },
    lodging: {
      luxury: "Edgewood Tahoe Resort — on-property, lakefront, walking distance to first tee.",
      value: "Truckee or Tahoe City inn — mid-range and central.",
      group: "Truckee cabin rental — 4-6 BR mountain homes, no resort markup.",
    },
    whatToRemember: "The view from Edgewood's 17th tee — a par 3 with Lake Tahoe filling the entire skyline.",
    skipIf: "It's before June or after September. Tahoe has a real winter; courses close hard.",
    foodDrink: "Moody's Bistro in Truckee. Beacon at Edgewood for the lake-deck sunset. Pizza On The Hill for the burger night.",
    funFact: "Edgewood Tahoe hosts the American Century Championship every July — the celebrity tournament where Steph Curry, Tony Romo, and Justin Timberlake play for $1M+ purses in front of 50,000 spectators.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [6, 7, 8, 9],
  },

  "coeur-dalene-lakes": {
    oneLiner: "America's only floating green, plus a tribal-owned Coore-Crenshaw woodland classic 30 minutes south.",
    bestFor: ["weekend", "couples", "hidden-gem", "walking"],
    primaryAirport: { code: "GEG", name: "Spokane International", driveMinutes: 45, note: "Closest. Direct from most West/Mountain cities." },
    lodging: {
      luxury: "The Coeur d'Alene Resort — lakefront, boat-shuttle to first tee, the whole gimmick.",
      value: "Downtown Coeur d'Alene boutique hotel — walkable, half the rate.",
      group: "Hayden Lake rental — 4BR homes with private docks, 25 min to both courses.",
    },
    whatToRemember: "Sitting on the 14th tee at the Coeur d'Alene Resort, watching the floating green slowly drift into position 200 yards away. They tow it every morning.",
    skipIf: "It's before May or after September. North Idaho closes hard in winter.",
    foodDrink: "Beverly's at the Resort for the lake-front splurge. Wolf Lodge Inn for the world-famous filet mignon. Cricket's Restaurant for the dive-bar nightcap.",
    funFact: "The Coeur d'Alene's floating green has been towed into position for every round since 1991 — it's a 15,000-square-foot platform anchored by 600 feet of underwater cable.",
    walkingFriendly: false,
    rentalCarNeeded: true,
    bestMonths: [6, 7, 8, 9],
  },

  "sun-valley-mountain": {
    oneLiner: "America's first ski resort becomes a summer golf village — three rounds, one square mile, no logistics.",
    bestFor: ["buddies", "weekend", "hidden-gem", "walking"],
    primaryAirport: { code: "SUN", name: "Friedman Memorial (Hailey, ID)", driveMinutes: 15, note: "Tiny airport in-valley. Direct from SEA/SLC/DEN/LAX seasonally." },
    alternateAirport: { code: "BOI", name: "Boise International", driveMinutes: 170 },
    lodging: {
      luxury: "Sun Valley Lodge — the original 1936 ski lodge, restored 2015.",
      value: "Ketchum boutique hotels — Limelight, Knob Hill Inn — half the lodge rate.",
      group: "Warm Springs condo rental — slope-side, walk to dinner, drive 10 min to golf.",
    },
    whatToRemember: "Hitting a tee shot at Trail Creek and watching the ball hang in thin mountain air for what feels like 8 seconds before it comes down.",
    skipIf: "It's before late June or after mid-September. Snow window is real.",
    foodDrink: "Pioneer Saloon for the bone-in ribeye institution. Cristina's for breakfast. Apple's Bar & Grill at Sun Valley Lodge for the closer.",
    funFact: "Sun Valley was developed in 1936 by Union Pacific Railroad chairman Averell Harriman as a way to give East Coast skiers somewhere to send their UP train tickets — it invented the chairlift the same year.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [6, 7, 8, 9],
  },

  "colorado-rockies-loop": {
    oneLiner: "Four ski-town rounds at 8,000+ feet, your driver carries forever, pine air on every backswing.",
    bestFor: ["buddies", "weekend", "couples", "luxury"],
    primaryAirport: { code: "DEN", name: "Denver International", driveMinutes: 120, note: "Direct from anywhere. Drive west on I-70." },
    alternateAirport: { code: "EGE", name: "Eagle County Regional (Vail)", driveMinutes: 30, note: "Pricey but lands you 10 min from Beaver Creek." },
    lodging: {
      luxury: "Park Hyatt Beaver Creek or The Sebastian Vail — slope-side, on-mountain, walk to dinner.",
      value: "Frisco/Silverthorne hotel — central to Breck/Vail/Beaver Creek, half the rate.",
      group: "Vail Village or Breckenridge ski-in condo — peak summer rates are 60% off winter.",
    },
    whatToRemember: "Standing on Breckenridge's 5th tee at 9,300 feet and watching your drive carry an extra 40 yards. The math works — Boyle's Law, dry air, less drag.",
    skipIf: "It's before June 15 or after September 15. Mountain courses close hard for snow.",
    foodDrink: "Sweet Basil in Vail for the splurge. Cima at the top of the Beaver Creek gondola for the high-altitude lunch. Briar Rose in Breck for the steakhouse classic.",
    funFact: "Breckenridge Golf Club is the only Jack Nicklaus-designed municipal course in the world — the town owns it, residents play for less than $50, and Nicklaus took the commission as a personal favor in 1985.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [6, 7, 8, 9],
  },

  "napa-sonoma-wine": {
    oneLiner: "Three vineyard-routed rounds, harvest-time tasting flights, and the most adult golf weekend on the menu.",
    bestFor: ["couples", "luxury", "weekend"],
    primaryAirport: { code: "SFO", name: "San Francisco International", driveMinutes: 75 },
    alternateAirport: { code: "OAK", name: "Oakland International", driveMinutes: 60, note: "Often cheaper, marginally closer." },
    lodging: {
      luxury: "Silverado Resort — historic on-property hotel, 36 holes out the back door.",
      value: "Yountville inn (Bardessono, Hotel Yountville) — walkable to The French Laundry-adjacent dining row.",
      group: "Napa Valley 4BR rental — vineyard pool, foursome dinners on the deck.",
    },
    whatToRemember: "Standing in a Silverado fairway during harvest, the smell of fermenting grapes drifting across the property from neighboring vineyards.",
    skipIf: "You only care about hard golf. Napa courses are scenic and forgiving — this is a wine-and-meal trip with golf in between.",
    foodDrink: "The French Laundry if you can swing it. Bouchon for the bistro version. Oxbow Public Market for the lunch grazing. Buehler Vineyards for the family-run tasting room.",
    funFact: "Silverado Resort's North Course has hosted the PGA Tour's Fortinet Championship (the FedExCup season opener) every fall since 2014 — Phil Mickelson, Sahith Theegala, and Justin Thomas have all won there.",
    walkingFriendly: false,
    rentalCarNeeded: true,
    bestMonths: [4, 5, 6, 9, 10],
  },

  "orlando-family-sampler": {
    oneLiner: "Four direct-flight rounds, Disney out the door for non-golfers, and Arnold Palmer's home course as the closer.",
    bestFor: ["buddies", "couples", "weekend"],
    primaryAirport: { code: "MCO", name: "Orlando International", driveMinutes: 30, note: "Direct from every East Coast and Midwest city." },
    lodging: {
      luxury: "Four Seasons Orlando at Walt Disney World — direct gate to Magnolia and Palm courses.",
      value: "Disney Springs Hilton or Doubletree — Disney shuttle, half the rate, full park access.",
      group: "Reunion Resort villa — 4-8BR, three on-property courses, water park for the non-golfers.",
    },
    whatToRemember: "Standing on Bay Hill's 18th — the par-4 with water all down the right — knowing this is where Tiger won 8 times.",
    skipIf: "It's July or August. Florida summer afternoons are 95% humidity and afternoon storms by 2 PM.",
    foodDrink: "Victoria & Albert's at the Grand Floridian for the splurge. Chef's Table at Reunion. The Boathouse in Disney Springs.",
    funFact: "Bay Hill's 'Member-Member' tournament was Arnold Palmer's favorite event of the year — he hosted it personally from 1976 until his death in 2016. It's still played every November.",
    walkingFriendly: false,
    rentalCarNeeded: true,
    bestMonths: [1, 2, 3, 4, 11, 12],
  },

  "tampa-bay-sampler": {
    oneLiner: "PGA Tour venues, world-class greens, fish tacos between rounds — the easy version of a buddy trip.",
    bestFor: ["buddies", "weekend", "bucket-list"],
    primaryAirport: { code: "TPA", name: "Tampa International", driveMinutes: 35, note: "Direct from nearly everywhere. The easiest big-city Florida airport." },
    lodging: {
      luxury: "Innisbrook Salamander Resort — on-property, walk to Copperhead first tee.",
      value: "Downtown St. Pete boutique (The Don CeSar / Hyatt Place) — golf-commutable, better dining.",
      group: "Westshore Yacht Club rental or Clearwater Beach 4BR — split the difference between courses.",
    },
    whatToRemember: "Standing on Innisbrook's Snake Pit (16-17-18) and realizing the Tour pros find this stretch as hard as you do.",
    skipIf: "It's summer. June-September is Florida storm season — golf before 11 or skip the day.",
    foodDrink: "Bern's Steak House for the legendary night out. Columbia Restaurant in Ybor for the Cuban classic. Frenchy's for the seafood-shack lunch.",
    funFact: "Cabot Citrus Farms — the rebuild of the dormant World Woods property — opened in 2024 and was named Golf Digest's 'Best New Course in America' on its first ballot, the same year Cabot acquired the Highlands sister property in Cape Breton.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [1, 2, 3, 4, 11, 12],
  },

  "williamsburg-historic": {
    oneLiner: "Colonial history by day, four heritage public courses including RTJ Sr.'s personal favorite design.",
    bestFor: ["couples", "weekend", "architecture", "value"],
    primaryAirport: { code: "RIC", name: "Richmond International", driveMinutes: 55, note: "Closest mid-size hub." },
    alternateAirport: { code: "PHF", name: "Newport News/Williamsburg", driveMinutes: 20, note: "Tiny but on the doorstep." },
    lodging: {
      luxury: "Williamsburg Inn — Colonial Williamsburg's flagship, restored 18th-century elegance.",
      value: "Colonial Houses — Colonial Williamsburg historic-rentals program, lower-rate authenticity.",
      group: "Williamsburg vacation rental — central to all four courses and the colonial sites.",
    },
    whatToRemember: "Walking Golden Horseshoe Gold's 16th — the par-3 over a ravine — and remembering Robert Trent Jones Sr. called this his favorite hole he ever designed.",
    skipIf: "You want fast tee times. Williamsburg is leisurely by design — historic-pace check-ins, walking pace, sit-down lunches.",
    foodDrink: "King's Arms Tavern for the colonial-period dinner. Fat Canary for the modern. Aroma's Cafe for the morning coffee.",
    funFact: "Royal New Kent — Mike Strantz's links-style fever dream 30 minutes north of Williamsburg — was closed from 2017 to 2021 and was rescued by a group of Strantz devotees who restored it to its 1996 condition.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [4, 5, 9, 10],
  },

  "kentucky-bourbon-trail": {
    oneLiner: "Pete Dye public courses, Bluegrass parkland, bourbon tastings between every round.",
    bestFor: ["buddies", "weekend", "value", "architecture"],
    primaryAirport: { code: "SDF", name: "Louisville Muhammad Ali", driveMinutes: 20 },
    alternateAirport: { code: "LEX", name: "Blue Grass Airport (Lexington)", driveMinutes: 15 },
    lodging: {
      luxury: "21c Museum Hotel Louisville or 21c Lexington — modern art, central to the Bourbon Trail.",
      value: "Embassy Suites Lexington — central, business-class breakfast included.",
      group: "Louisville Highlands Airbnb — walkable nightlife, 30 min to Persimmon Ridge.",
    },
    whatToRemember: "Touring Buffalo Trace at sunrise, playing 18 at Kearney Hill in the afternoon, and arguing in a Lexington bar at night about which Old Fitzgerald rye is best.",
    skipIf: "It's July or August. Kentucky humidity is the East Coast at its worst.",
    foodDrink: "610 Magnolia in Louisville for the Edward Lee dinner. Holly Hill Inn in Midway for the Ouita Michel splurge. Yacht Club Brasserie in Lexington for the consistent.",
    funFact: "Kearney Hill Golf Links — a $35-a-round Lexington municipal course — hosted four PGA Tour Champions events in the 1990s, making it the only city-owned facility ever to host a senior major.",
    walkingFriendly: true,
    rentalCarNeeded: true,
    bestMonths: [4, 5, 6, 9, 10],
  },

  "biloxi-gulf-coast-casino": {
    oneLiner: "Four Gulf Coast rounds, casino dinners every night, half the price of Vegas.",
    bestFor: ["buddies", "bachelor", "value"],
    primaryAirport: { code: "GPT", name: "Gulfport-Biloxi International", driveMinutes: 20 },
    alternateAirport: { code: "MSY", name: "New Orleans Louis Armstrong", driveMinutes: 90, note: "Add a night in NOLA if the group's down." },
    lodging: {
      luxury: "Beau Rivage Resort & Casino — the headliner, Tom Fazio's Fallen Oak shuttle requires a stay here.",
      value: "Hard Rock Biloxi — beachfront, half the rate midweek, same casino access.",
      group: "Gulfport beach rental — 4-6BR houses for less than 4 hotel rooms.",
    },
    whatToRemember: "Walking off Fallen Oak's 18th green having just played a $400 Tom Fazio bucket-list course, and realizing it came with a $150 Beau Rivage room.",
    skipIf: "You want family vibes. Gulf Coast casino golf is built around the casino floor.",
    foodDrink: "BR Prime at Beau Rivage for the steakhouse classic. Mary Mahoney's Old French House for the regional institution. Half Shell Oyster House for the Gulf raw bar.",
    funFact: "Fallen Oak Golf Course is exclusively open to overnight guests of Beau Rivage, IP Casino, or Gold Strike — Tom Fazio designed it in 2005 as MGM's bucket-list draw to compete with Wynn's Las Vegas course.",
    walkingFriendly: false,
    rentalCarNeeded: true,
    bestMonths: [3, 4, 10, 11],
  },

  "mesquite-wolf-creek": {
    oneLiner: "America's most photographed public course and two cheaper desert siblings around it — bring the camera.",
    bestFor: ["buddies", "bachelor", "value", "weekend"],
    primaryAirport: { code: "LAS", name: "Las Vegas Harry Reid", driveMinutes: 80, note: "Drive 80 min northeast on I-15." },
    alternateAirport: { code: "SGU", name: "St. George Regional (UT)", driveMinutes: 45, note: "Tiny but closer if it has the route." },
    lodging: {
      luxury: "CasaBlanca Resort & Casino — Mesquite's nicest, walking to the casino floor.",
      value: "Eureka Resort Casino — $65 midweek rooms, same downtown.",
      group: "Mesquite vacation rental — 4BR homes with hot tubs for less than 4 casino rooms.",
    },
    whatToRemember: "Standing on Wolf Creek's 14th tee — a 100-foot elevation drop with red-rock canyon walls on three sides — and realizing the design fee was 'just don't move dirt.'",
    skipIf: "It's June-September. Mesquite summer afternoons hit 110°. Spring and late fall are the windows.",
    foodDrink: "Katherine's at CasaBlanca for the casino-steakhouse. The Garlic Press for the affordable date-night.",
    funFact: "Wolf Creek's land was originally a discarded section of Mesquite, NV, that was deemed too topographically extreme to develop residentially — designer Dennis Rider routed 18 holes through it instead, opening in 2000.",
    walkingFriendly: false,
    rentalCarNeeded: true,
    bestMonths: [3, 4, 5, 10, 11],
  },

  "tucson-desert": {
    oneLiner: "Saguaro silhouettes, Catalina mountain backdrops, four desert layouts at half Scottsdale prices.",
    bestFor: ["buddies", "couples", "value", "hidden-gem"],
    primaryAirport: { code: "TUS", name: "Tucson International", driveMinutes: 20 },
    alternateAirport: { code: "PHX", name: "Phoenix Sky Harbor", driveMinutes: 110, note: "Bigger flight options but a real drive." },
    lodging: {
      luxury: "Loews Ventana Canyon Resort — on-property, walk to first tee, two Tom Fazio courses out the door.",
      value: "JW Marriott Starr Pass — same on-property model, slightly lower rate.",
      group: "Foothills vacation rental — 4BR mountain-view homes, central to all four.",
    },
    whatToRemember: "Standing on Ventana Canyon's 3rd tee — the par-3 with a saguaro forest backdrop — at 7 AM when the sun is just hitting the Catalinas.",
    skipIf: "It's June-September. Tucson summer is 105°+; everyone golfs at sunrise or skips.",
    foodDrink: "El Charro Cafe (the original Sonoran-style downtown). Cafe Poca Cosa for the Sonoran upscale. Maynards for the train-depot brunch.",
    funFact: "The Boulders Resort's two courses were designed by Jay Morrish in 1985 around a 12-million-year-old natural rock formation — the resort's namesake boulders were never moved during construction, and the routing weaves between them.",
    walkingFriendly: false,
    rentalCarNeeded: true,
    bestMonths: [1, 2, 3, 4, 10, 11],
  },

  "lake-of-the-ozarks": {
    oneLiner: "Boat to lunch, golf between, the Midwest's quietly excellent lake-resort scene at Wisconsin-level value.",
    bestFor: ["buddies", "weekend", "value", "hidden-gem"],
    primaryAirport: { code: "STL", name: "St. Louis Lambert", driveMinutes: 180, note: "Cheapest, longest drive." },
    alternateAirport: { code: "MCI", name: "Kansas City International", driveMinutes: 170 },
    lodging: {
      luxury: "Old Kinderhook villas — on-property, golf-out-the-door, lake views.",
      value: "Osage Beach Holiday Inn — central to all three courses, half the resort rate.",
      group: "Lake of the Ozarks 4BR rental with boat dock — boat to lunch, drive to golf, no logistics.",
    },
    whatToRemember: "Pulling into the dock at H. Toad's after 18 at Old Kinderhook, ordering a bushwacker before the bag was even out of the cart.",
    skipIf: "It's not summer. Lake of the Ozarks closes hard from November through March.",
    foodDrink: "H. Toad's Bar & Grill for the on-water classic. Bentley's Restaurant for the steakhouse. Hippie Fish in Camdenton for the local rule-breaker.",
    funFact: "Lake of the Ozarks was created in 1931 when Bagnell Dam was built across the Osage River — at completion it was the largest man-made lake in the world and remains the largest in Missouri at 92 miles of length.",
    walkingFriendly: false,
    rentalCarNeeded: true,
    bestMonths: [5, 6, 7, 8, 9],
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
