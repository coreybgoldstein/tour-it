// Enriches existing DB course records with web-sourced data.
// Only updates — never inserts. Run: node enrich-courses.mjs
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://awlbxzpevwidowxxvuef.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bGJ4enBldndpZG93eHh2dWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxODQ5OSwiZXhwIjoyMDg4NTk0NDk5fQ.TU53et5QL6MwLmcv1wQNwDMLtjp62xaLSrElrCpGV0I'
);

// Each entry maps a DB course ID to the enrichment data to apply.
const enrichments = [

  // ── Boca Raton ────────────────────────────────────────────────────────────

  {
    id: 'e1a433fa-3951-4cf1-bb56-c6e467d7ad8d', // Boca Rio Golf Club
    courseType: 'PRIVATE',
    isPublic: false,
    yearEstablished: 1966,
    zipCode: '33433',
    description: "Boca Rio is the most discreet and coveted private golf club in Boca Raton — 200 acres of native Florida wilderness with no developed real estate, no real estate sales pitch, just golf. Founded in 1966 by a group of seven men, the club became Boca's sanctuary for billionaires, movie stars, and executives who wanted a world-class round without an audience. Robert Von Hagge designed the par-72 layout at 7,100 yards, and Ron Forse led a greens, tee boxes, and bunker renovation in 2017. Arnold Palmer once offered $6 million for the club after his first round there. The owners said no.",
    coverImageUrl: null,
    logoUrl: null,
    isVerified: true,
  },

  {
    id: '99addd27-ac12-4b77-b39c-10d3d79725f0', // Boca Lago Country Club
    courseType: 'PRIVATE',
    isPublic: false,
    yearEstablished: 1975,
    zipCode: '33434',
    description: "Boca Lago is a 27-hole championship club sprawling across 225 acres of lush fairways, sparkling lakes, and manicured Bermuda grass — one of South Florida's most comprehensive golf facilities. Originally designed by Von Hagge & Devlin in 1975, the club underwent an $8 million redesign in 2018 that earned recognition as the Best New Course Design by the Golf Course Superintendents Association of America. Three championship routing configurations, a Golf Academy-level practice facility, and a full fleet of Club Car carts make it one of the most complete private golf experiences in Palm Beach County.",
    coverImageUrl: null,
    logoUrl: null,
    isVerified: true,
  },

  {
    id: 'ddc3f7f3-a9c3-49bb-8a98-9d5984016349', // Club at Boca Pointe
    courseType: 'PRIVATE',
    isPublic: false,
    yearEstablished: 1982,
    zipCode: '33432',
    description: "The Club at Boca Pointe is the centerpiece of a 1,000-acre master-planned community just outside Boca Raton's city limits — one of the first of its kind in South Florida when it opened in 1982. The championship golf course was designed by Robert E. Cupp and Jay Morrish, with an 80,000-square-foot clubhouse, 13 Har-Tru tennis courts, pickleball, padel, and a 28,000-square-foot sports center completing the facility. Acquired by Heritage Golf Group in 2021 after a 90% member vote, the club continues to operate as a private membership.",
    coverImageUrl: null,
    logoUrl: null,
    isVerified: true,
  },

  {
    id: 'fd9032cd-607b-4f62-857e-4ac6c685a5ad', // Royal Palm Yacht & Country Club
    courseType: 'PRIVATE',
    isPublic: false,
    yearEstablished: 1959,
    zipCode: '33432',
    description: "Royal Palm Yacht & Country Club has been a fixture of Boca Raton's social landscape since 1959 — a premium waterfront enclave bounded by the Intracoastal Waterway, the Hillsboro River, and Federal Highway. Sam Snead was the club's first golf professional, and Robert Trent Jones designed the original course. In 2003, Jack Nicklaus completely redesigned the layout, then returned in 2022 for a second renovation that added a double green, conjoined fairways, and dramatic sightlines across more than 7,000 yards. Seven tee configurations make it accessible for all levels, but it plays like a championship course every time.",
    coverImageUrl: 'https://www.rpycc.org/cms/lib/Ext/US01908032/Centricity/Domain/66/golf-hero.jpg',
    logoUrl: null,
    isVerified: true,
  },

  {
    id: 'f6e7e11e-65de-418d-ab58-9031a3789cdf', // Boca Woods Country Club
    courseType: 'PRIVATE',
    isPublic: false,
    yearEstablished: 1981,
    zipCode: '33428',
    description: "Boca Woods Country Club is a 660-acre private community with two championship 18-hole courses, 530 golf members, and a layout that has been rebuilt by two of golf's best architects. Joe Lee designed the original Woods Course; Rees Jones completed a major redesign of it in December 2023. The Lakes Course, designed by Karl Litten (apprentice to Robert Von Hagge), was subsequently redesigned by Kipp Schulties and brings water into play on 15 of 18 holes. With only 530 golf members across two courses and an expansive estate setting, Boca Woods delivers one of the least-crowded private golf experiences in Palm Beach County.",
    coverImageUrl: null,
    logoUrl: null,
    isVerified: true,
  },

  {
    id: '831cc2b3-bd61-4598-98fc-276c49ef1c07', // St. Andrews Country Club
    courseType: 'PRIVATE',
    isPublic: false,
    yearEstablished: 1982,
    zipCode: '33496',
    description: "St. Andrews Country Club is one of South Florida's most decorated private clubs — 36 holes of championship golf across 718 acres with 70 acres of sparkling lakes, consistently ranked among the top 100 country clubs in America by Platinum Clubs of America. The Arnold Palmer Signature Course (renovated by the Palmer Design Company in 2003) plays through a tropical landscape of majestic palms and manicured fairways. A second course designed by Tom Fazio II adds a starkly different challenge. Recognized as an Elite Distinguished Club of the World and 2019 North America Best Day Spa by World Spa Awards.",
    coverImageUrl: null,
    logoUrl: null,
    isVerified: true,
  },

  {
    // Boca Green Country Club — likely a duplicate of Boca Greens CC.
    // Update with same data and mark for review.
    id: '63fde18c-dbec-4f79-81ed-3c294a575367',
    courseType: 'SEMI_PRIVATE',
    isPublic: true,
    yearEstablished: 1979,
    zipCode: '33498',
    description: "Boca Greens is a Joe Lee design on 175 acres — 7,000+ yards of water-heavy, bunker-guarded Florida golf that opened in 1979 as a private club and later opened to public tee times, making it one of the best-value rounds in Boca. Lee built it on his philosophy that golfers should leave feeling good regardless of score, but the par-5 17th — nearly surrounded by water — tests that theory every round. Splash-faced bunkering and generous landing areas reward positioning over power.",
    coverImageUrl: 'https://www.bocagreenscountryclub.com/images/slider3/slideshow1.jpg',
    logoUrl: 'https://www.bocagreenscountryclub.com/images/logo/logo-sticky.png',
    isVerified: true,
  },

  {
    id: 'ec267197-c761-4e91-a09f-00bc697effff', // Boca West (city was "Boca West", fix to Boca Raton)
    courseType: 'PRIVATE',
    isPublic: false,
    yearEstablished: 1974,
    zipCode: '33434',
    city: 'Boca Raton',
    description: "Boca West is one of the largest private residential golf communities in the United States — over 1,400 acres with four championship 18-hole courses, more than 1,800 residences, and a world-class country club at its center. The four courses each have distinct personalities: the Preserve Course winds through natural Florida wetlands, the Indian Course plays along the C-15 canal, the Grande and Resort Courses offer classic South Florida parkland golf. The club has hosted PGA and LPGA events and offers members one of the most complete private golf programs in Palm Beach County.",
    coverImageUrl: null,
    logoUrl: null,
    isVerified: true,
  },

  // ── Scarsdale / Hartsdale ─────────────────────────────────────────────────

  {
    // Scarsdale Country Club — same physical club as Scarsdale Golf Club.
    // Update with correct data; may be a duplicate record from original import.
    id: '380076bc-1dbb-4117-ac48-dbf461e17840',
    courseType: 'PRIVATE',
    isPublic: false,
    yearEstablished: 1898,
    zipCode: '10530',
    description: "One of Westchester County's oldest private clubs, founded in 1898 on land in Hartsdale. Willie Dunn designed the original nine holes; A.W. Tillinghast rebuilt the course in the early 1920s, and his layout — 6,322 yards at par 72 — remains the backbone of what members play today. Harry Vardon, Ted Ray, Walter Hagen, and Bobby Jones all played exhibitions here in the club's early years. The facility includes six tennis courts, platform tennis, pickleball, six bowling lanes, swimming, and a fitness center within its historic 1922 clubhouse.",
    coverImageUrl: null,
    logoUrl: null,
    isVerified: true,
  },
];

async function run() {
  let updated = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const entry of enrichments) {
    const { id, ...fields } = entry;

    // Verify the record exists before updating
    const { data: existing } = await supabase.from('Course').select('id, name').eq('id', id).maybeSingle();
    if (!existing) {
      console.log(`MISS  id=${id} — not found in DB, skipping`);
      failed++;
      continue;
    }

    const { error } = await supabase.from('Course').update({ ...fields, updatedAt: now }).eq('id', id);
    if (error) {
      console.error(`ERROR ${existing.name}:`, error.message);
      failed++;
    } else {
      console.log(`OK    ${existing.name}`);
      updated++;
    }
  }

  console.log(`\nDone — ${updated} updated, ${failed} failed/missed.`);
}

run().catch(console.error);
