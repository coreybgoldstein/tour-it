// Run: node seed-courses-boca.mjs
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://awlbxzpevwidowxxvuef.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bGJ4enBldndpZG93eHh2dWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxODQ5OSwiZXhwIjoyMDg4NTk0NDk5fQ.TU53et5QL6MwLmcv1wQNwDMLtjp62xaLSrElrCpGV0I'
);

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function mapAccess(access) {
  if (access === 'Private') return 'PRIVATE';
  if (access === 'Semi-Private') return 'SEMI_PRIVATE';
  return 'PUBLIC';
}

const courses = [
  {
    name: "Broken Sound Club",
    city: "Boca Raton",
    state: "FL",
    zipCode: "33496",
    yearEstablished: 1978,
    access: "Private",
    description: "Broken Sound Club is one of South Florida's most decorated private clubs — two championship courses on nearly 1,000 acres in north-central Boca Raton, including the Old Course that hosted the PGA Tour Champions season opener for 15 consecutive years. Joe Lee laid out the original in 1978, Rees Jones overhauled it in 2022, and players voted the greens best on the Champions Tour year after year. The Club Course was designed to be a hard par and an easy bogey — generous fairways, elevated greens, and a layout that quietly exposes every weakness in your game.",
    coverImageUrl: "https://media.agentaprd.com/sites/485/Broken-Sound-Club-Boca-Raton-—-The-Complete-Community-Guide.webp",
    logoUrl: "https://clubandresortbusiness.com/wp-content/uploads/2023/12/BrokenSoundLogoWEBMain-300x110.png",
  },
  {
    name: "Woodfield Country Club",
    city: "Boca Raton",
    state: "FL",
    zipCode: "33496",
    yearEstablished: 1988,
    access: "Private",
    description: "Woodfield Country Club is a family-first private club that takes its golf seriously — the Kipp Schulties redesign stretches to 7,200 yards with water on fifteen holes, dramatic bunkers, and an island green on the 17th that you will either love or despise. A $7.9 million course renovation produced one of the sharpest layouts in Palm Beach County, and the men's and ladies' leagues draw 80 to 120 players weekly. It is a Platinum Club of America with over 1,000 kids in the community — an actual family club, not just a tagline.",
    coverImageUrl: "https://www.woodfield.org/getmedia/5bb78a8b-ba95-45a6-a726-cf161e0c43bc/Golf_12.aspx",
    logoUrl: "https://www.woodfield.org/getmedia/a0a76255-96b4-4951-b970-5b1cdf09e488/Woodfield_New_Logo.aspx?width=362&height=124&ext=.png",
  },
  {
    name: "Osprey Point Golf Course",
    city: "Boca Raton",
    state: "FL",
    zipCode: "33498",
    yearEstablished: 2010,
    access: "Public",
    description: "Osprey Point is Palm Beach County's flagship public course — 27 holes of Seashore Paspalum built on what used to be abandoned farmland turned shellrock mine, transformed by the county into the first Audubon International Classic Signature Golf Course in Florida. Designed by Roy Case and Jeff Grossman and opened in 2010, the three nine-hole loops (Hawk, Falcon, Raven) can be combined into three different 18-hole configurations, each with its own personality. If you're playing public golf in South Florida and skipping Osprey Point, you made a mistake.",
    coverImageUrl: "https://www.pbcospreypointgolf.com/images/slideshows/sub_banner_2.jpg",
    logoUrl: "https://www.pbcospreypointgolf.com/images/default/logo.png",
  },
  {
    name: "Boca Greens Country Club",
    city: "Boca Raton",
    state: "FL",
    zipCode: "33498",
    yearEstablished: 1979,
    access: "Semi-Private",
    description: "Boca Greens started as a private club in 1979 — a Joe Lee design on 175 acres with 7,000+ yards of water-heavy, bunker-guarded Florida golf — and has since opened to public tee times, making it one of the best-value rounds in Boca. Lee built it on his signature philosophy that a golfer should always leave with a sense of well-being regardless of score, but the par-5 17th — nearly surrounded by water — will test that theory every time. Splash-faced bunkering and generous landing areas reward smart play over power.",
    coverImageUrl: "https://www.bocagreenscountryclub.com/images/slider3/slideshow1.jpg",
    logoUrl: "https://www.bocagreenscountryclub.com/images/logo/logo-sticky.png",
  },
  {
    name: "Boca Raton Golf & Racquet Club",
    city: "Boca Raton",
    state: "FL",
    zipCode: "33487",
    yearEstablished: 1982,
    access: "Public",
    description: "Boca Raton's city-owned championship course was designed by Charles Ankrom in 1982 and has been a staple for South Florida golfers for over four decades. The slope of 131 and hidden water hazards on several holes mean it plays tougher than it looks, but wide fairways and four tee options keep it accessible for all levels. The city has invested over $7 million in recent improvements — new course upgrades, clubhouse renovations, and a golf simulator — making it one of the best-maintained munis in Palm Beach County.",
    coverImageUrl: "https://www.myboca.us/ImageRepository/Document?documentID=30359",
    logoUrl: null,
  },
  {
    name: "Southwinds Golf Course",
    city: "Boca Raton",
    state: "FL",
    zipCode: "33434",
    yearEstablished: 1977,
    access: "Public",
    description: "Southwinds is a Palm Beach County-operated public course that leans hard into its natural setting — water comes into play on 16 of 18 holes, and the wildlife roster on any given round includes Canadian geese, otters, foxes, and iguanas sharing the fairways with your group. A certified Audubon International Cooperative Sanctuary, the tree-lined layout plays to 6,018 yards at par 70, which sounds manageable until the water keeps showing up and shot placement stops being optional.",
    coverImageUrl: "https://www.pbcsouthwindsgolf.com/images/slideshows/banner-slideshow-new-1.jpg",
    logoUrl: "https://www.pbcsouthwindsgolf.com/images/default/logo.png",
  },
];

async function run() {
  let inserted = 0;
  let skipped = 0;

  for (const c of courses) {
    const slug = slugify(c.name);
    const courseType = mapAccess(c.access);
    const isPublic = c.access !== 'Private';

    // Check if already exists by slug
    const { data: existing } = await supabase
      .from('Course')
      .select('id, name')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      console.log(`SKIP  ${c.name} (slug "${slug}" already exists as "${existing.name}")`);
      skipped++;
      continue;
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from('Course').insert({
      id: crypto.randomUUID(),
      name: c.name,
      slug,
      city: c.city,
      state: c.state,
      country: 'US',
      zipCode: c.zipCode,
      yearEstablished: c.yearEstablished,
      description: c.description,
      coverImageUrl: c.coverImageUrl,
      logoUrl: c.logoUrl,
      courseType,
      isPublic,
      holeCount: 18,
      isVerified: true,
      uploadCount: 0,
      saveCount: 0,
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    if (error) {
      console.error(`ERROR ${c.name}:`, error.message);
    } else {
      console.log(`OK    ${c.name} (${courseType})`);
      inserted++;
    }
  }

  console.log(`\nDone — ${inserted} inserted, ${skipped} skipped.`);
}

run().catch(console.error);
