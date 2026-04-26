// Enriches existing Delray Beach course records with web-sourced data.
// Only updates — never inserts. Run: node enrich-courses-delray.mjs
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://awlbxzpevwidowxxvuef.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3bGJ4enBldndpZG93eHh2dWVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxODQ5OSwiZXhwIjoyMDg4NTk0NDk5fQ.TU53et5QL6MwLmcv1wQNwDMLtjp62xaLSrElrCpGV0I'
);

const enrichments = [

  {
    id: '911e65a5-2ae8-4c8e-bef3-c37ac177ee79', // Villa Del Ray Golf Club — PERMANENTLY CLOSED 2016
    courseType: 'PUBLIC',
    isPublic: true,
    yearEstablished: 1973,
    zipCode: '33484',
    state: 'FL',
    description: "Designed by Frank Batto and opened in 1973, Villa Del Ray was a par-71 public layout stretching 6,511 yards through the western reaches of Delray Beach — Old Florida character earned through decades of subtropical growth. Generous fairways wound around lakes and elevated greens that gave the layout more visual interest than its modest pedigree suggested. The course drew a loyal local following for its affordable rates and relaxed atmosphere before the Vitale family permanently shuttered the operation in September 2016. The 120-acre site was subsequently purchased by 13th Floor Homes and redeveloped into Delray Trails, a 436-unit active adult residential community.",
    coverImageUrl: null,
    logoUrl: null,
    isVerified: true,
  },

  {
    id: '36cfa6c2-dbc4-460f-b582-1537e04625ee', // The Seagate Country Club
    courseType: 'SEMI_PRIVATE',
    isPublic: true,
    yearEstablished: 1973,
    zipCode: '33445',
    state: 'FL',
    description: "Originally opened in 1973 as The Hamlet of Delray Beach — one of Florida's earliest private clubs, where Peter Kostis served as head pro, Jim Flick launched the first Golf Digest School, and Jack Nicklaus held a charter membership — this 7,103-yard, par-72 Joe Lee design is now one of Palm Beach County's most ambitious semi-private operations. Acquired in 2012 and rebranded as The Seagate Country Club (affiliated with The Seagate Hotel & Spa), the course underwent a $14 million renovation by Gene Bates in 2013 and a second full rebuild completed in early 2024 under architect J. Drew Rogers. Rogers restored the dignity of Lee's original parkland routing while adding genuine undulation, rebuilt bunkers, and the kind of greens complexity that rewards precision over brute force. Access is limited to members and Seagate Hotel guests, maintaining an exclusive feel despite the semi-private designation.",
    coverImageUrl: null,
    logoUrl: null,
    isVerified: true,
  },

  {
    id: 'c687ba41-f176-4a76-b3f4-01e0cb097f8e', // Sherwood Park Golf Club
    courseType: 'SEMI_PRIVATE',
    isPublic: true,
    yearEstablished: 1959,
    zipCode: '33445',
    state: 'FL',
    description: "Designed by Bill Amick and opened in 1959, Sherwood Park is one of Palm Beach County's oldest executive-length layouts — an 18-hole, par-62 course playing 3,733 yards from 170 Sherwood Forest Drive. Amick threaded the routing through tree-lined corridors that have matured into genuine obstacles, asking golfers to shape shots rather than simply overpower a layout that rewards precision over distance. The course has long served as a short-game laboratory for the Delray Beach community, offering a legitimate and affordable test for players working on their iron game at one of the county's most accessible and historically rooted tracks.",
    coverImageUrl: null,
    logoUrl: null,
    isVerified: true,
  },

  {
    id: 'd5724ecc-9c3f-4c31-954a-f5d9d8d60625', // Addison Reserve Country Club
    courseType: 'PRIVATE',
    isPublic: false,
    yearEstablished: 1996,
    zipCode: '33446',
    state: 'FL',
    description: "Named in deliberate homage to Addison Mizner, the Mediterranean Revival architect who reimagined Palm Beach in the 1920s, Addison Reserve opened in 1996 with 27 holes of championship golf by Arthur Hills laid across what had been flat South Florida farmland — Hills' team created the wetlands, lakes, and mounding that give the property its visual identity. A $24 million reimagination by Rees Jones and Steve Weisser regrassed the three nines with Platinum TE paspalum, rebuilt the green complexes, and added definition that Hills' original routing lacked, producing a layout that reaches 7,001 yards and carries a 74.9 rating from the tips. The three nines — Redemption, Salvation, and Trepidation — each offer a distinct strategic personality, and no homes border the fairways, preserving an uninterrupted playing experience rare in a Florida residential club. Ranked #5 among the Platinum Clubs of America.",
    coverImageUrl: null,
    logoUrl: null,
    isVerified: true,
  },

  {
    id: '285776be-d767-4099-b25c-384cfdc811b6', // Gleneagles Country Club
    courseType: 'PRIVATE',
    isPublic: false,
    yearEstablished: 1984,
    zipCode: '33446',
    state: 'FL',
    description: "Established in 1984 with a concept as audacious as it was effective — recruiting six PGA Tour legends (Gay Brewer, Billy Casper, Doug Ford, Bob Goalby, Doug Sanders, and Sam Snead) as resident touring professionals — Gleneagles quickly became one of South Florida's most storied private clubs, hosting a 1986 Senior PGA Tour event that drew Gary Player and Arnold Palmer. Karl Litten designed both 18-hole layouts: the Legends Course (renovated by Kipp Schulties in 2011 to 7,047 yards, rated 74.3, slope 141) and the Victory Course at 6,043 yards par 71. The club transitioned to full member ownership in 1989 and today serves a 55-plus residential community of 1,082 homes anchored by 36 holes of championship golf — one of the best-equipped age-restricted private clubs in Palm Beach County.",
    coverImageUrl: null,
    logoUrl: 'https://static.clubessential.com/CEFED/_Axis-Website/Sites/GleneaglesCountryClub2023/images/Logo2x.png',
    isVerified: true,
  },

  {
    id: 'aad5299c-9a47-4909-bd49-4a26eaaa50b1', // Mizner Country Club
    courseType: 'PRIVATE',
    isPublic: false,
    yearEstablished: 1999,
    zipCode: '33446',
    state: 'FL',
    description: "Developed by Toll Brothers and opened in 1999 with an Arnold Palmer/Ed Seay Signature design, Mizner Country Club draws its identity — and its name — from Addison Mizner, the early 20th-century architect whose Mediterranean Revival style still defines the visual language of coastal Palm Beach County. The original Palmer/Seay layout was substantially reimagined by Kipp Schulties in a 2016 renovation that produced a 6,909-yard, par-72 course with a 74.2 rating and slope of 142, dressed in Bermuda fairways and Tifteagle greens. Six sets of tees make the course genuinely accessible at all levels while the back markers offer a genuine championship examination. The gated community of 596 homes surrounds the course, and members enjoy the rarity of a private club where course management is as attentive as the residential programming.",
    coverImageUrl: null,
    logoUrl: null,
    isVerified: true,
  },

  {
    id: 'cce0e1dd-c81f-47a3-9139-8a8b1d11d446', // Delray Beach Golf Club
    courseType: 'PUBLIC',
    isPublic: true,
    yearEstablished: 1926,
    zipCode: '33445',
    state: 'FL',
    description: "One of the most historically significant municipal golf courses in the American South, Delray Beach Golf Club opened on January 1, 1926 with nine holes drawn up by Donald Ross — seven of which remain in active use today as the heart of the current back nine. The front nine was added in 1950 by Dick Wilson, Ross's contemporary and protégé, completing an 18-hole, par-72 layout that stretches to 6,907 yards from the tips and earned recognition from Golf Magazine as one of America's 100 Best Value Courses. Listed on Delray Beach's Register of Historic Places in 2023, the course closed in November 2025 for a $30 million city-funded restoration that will rebuild drainage, irrigation, and practice facilities while honoring the original Ross and Wilson design visions — with reopening expected November 2026.",
    coverImageUrl: 'https://www.delraybeachgolfclub.com/wp-content/uploads/sites/6575/2017/08/home_pic2.jpg',
    logoUrl: 'https://www.delraybeachgolfclub.com/wp-content/uploads/sites/6575/2022/04/cropped-renditionDownload.jpg',
    isVerified: true,
  },

  {
    id: '74272859-3b4f-4276-9303-e07ad84a0fb0', // Delaire Country Club
    courseType: 'PRIVATE',
    isPublic: false,
    yearEstablished: 1979,
    zipCode: '33445',
    state: 'FL',
    description: "Carved from 340 acres of inland Florida woodland, Delaire Country Club is a study in deliberate restraint — 326 residences, 27 holes of golf, and a members-only culture that prizes walkability and spontaneous play over tee sheet management. Joe Lee designed all three nines (Woods, Lakes, Hills) in 1979, and the property has since been reshaped twice — by Brian Bowles in 2002 and Kipp Schulties in 2016 — preserving Lee's strategic intent while modernizing surfaces and drainage. Playing combinations reach approximately 6,644 yards from the tips, with the strategic water hazards and generous contouring that characterize Lee's best Florida work. A Five-Star Platinum Club of America, Delaire competes with South Florida's most celebrated private clubs on the basis of intimacy rather than scale, and walk-on golf without tee times remains its signature luxury.",
    coverImageUrl: null,
    logoUrl: 'https://static.clubessential.com/CEFED/_Axis-Website/Sites/DelaireCC-2022/images/LogoWhite.svg',
    isVerified: true,
  },

  {
    id: 'a4c47098-4256-44f8-b91a-6c017acb4f6b', // Gulf Stream Golf Club — city correction to Gulf Stream
    courseType: 'PRIVATE',
    isPublic: false,
    yearEstablished: 1924,
    zipCode: '33483',
    state: 'FL',
    city: 'Gulf Stream',
    description: "Founded in March 1924 by a consortium of Palm Beach's most prominent names — E.F. Hutton, Paris Singer, Edward Stotesbury, and Howard and Jay Phipps among them — Gulf Stream Golf Club is one of Florida's oldest and most genuinely exclusive private clubs, built around a Donald Ross course that opened in 1926 and an Addison Mizner Mediterranean Revival clubhouse that Architectural Forum called 'the most attractive Mediterranean design in America.' Pete Dye, a longtime member, renovated the course across 2013–2014, rebuilding bunkers, extending the layout to approximately 7,100 yards, replacing Paspalum with Celebration Bermuda, and opening ocean views along the 18th. The result is a course of rare coastal intimacy — Ross's original ridge routing still visible beneath Dye's interventions — playing to a par of 71 with invitation-only access that has never wavered in a century of operation.",
    coverImageUrl: null,
    logoUrl: null,
    isVerified: true,
  },

  {
    id: '52c2c3ed-4352-443f-b18a-bcf6d415ad04', // Polo Trace Golf Club — PERMANENTLY CLOSED 2018
    courseType: 'PUBLIC',
    isPublic: true,
    yearEstablished: 1990,
    zipCode: '33446', // corrected from 33498 (Boca Raton zip)
    state: 'FL',
    description: "Karl Litten designed Polo Trace in 1989 (opened 1990) as a bold links-influenced layout in western Delray Beach, playing 7,068 yards from the championship tees with water on 13 of 18 holes and elevation changes uncommon in flat South Florida. The course earned a slope of 139 and a strong local following among players seeking a genuine test at a public price — Litten's long, rolling fairways and exposed greenside bunkers made it one of western Palm Beach County's most demanding public tracks. The club closed in 2018 when GL Homes purchased the property for residential development, ending nearly three decades of one of the area's most challenging public-access rounds.",
    coverImageUrl: null,
    logoUrl: null,
    isVerified: true,
  },

  {
    // Seagate Country Club — duplicate of 'The Seagate Country Club' above.
    // Updating with correct data; both records refer to the same course.
    id: '8ad1be53-b367-44ad-b61c-916f819d0635',
    courseType: 'SEMI_PRIVATE',
    isPublic: true,
    yearEstablished: 1973,
    zipCode: '33445', // corrected from 33498 (Boca Raton zip)
    state: 'FL',
    description: "Originally opened in 1973 as The Hamlet of Delray Beach — one of Florida's earliest private clubs, where Peter Kostis served as head pro, Jim Flick launched the first Golf Digest School, and Jack Nicklaus held a charter membership — this 7,103-yard, par-72 Joe Lee design is now one of Palm Beach County's most ambitious semi-private operations. Acquired in 2012 and rebranded as The Seagate Country Club (affiliated with The Seagate Hotel & Spa), the course underwent a $14 million renovation by Gene Bates in 2013 and a second full rebuild completed in early 2024 under architect J. Drew Rogers. Rogers restored the dignity of Lee's original parkland routing while adding genuine undulation, rebuilt bunkers, and the kind of greens complexity that rewards precision over brute force.",
    coverImageUrl: null,
    logoUrl: null,
    isVerified: true,
  },

  {
    // Village Golf Club — wrong city (Royal Palm Beach, not Delray Beach)
    // Updating with correct data and city correction.
    id: '2a059f1f-6eb9-46c5-9daf-73782a52f219',
    courseType: 'PUBLIC',
    isPublic: true,
    yearEstablished: 1973,
    zipCode: '33411', // corrected from 33498 (Boca Raton zip)
    state: 'FL',
    city: 'Royal Palm Beach',
    description: "Designed by Mark Mahannah and opened in 1973, Village Golf Club is an 18-hole, par-72 public championship layout spread across 175 acres in Royal Palm Beach. Premium Jones Dwarf Bermuda greens anchor a parkland-style routing that has hosted numerous PGA of America chapter events and local charity tournaments, building a loyal following in western Palm Beach County for its uninterrupted natural terrain and accessibility. The course plays to approximately 6,800 yards from the back tees and has remained a consistent community asset through five decades of South Florida golf.",
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
