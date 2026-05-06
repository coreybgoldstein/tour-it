#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "tour-it-photos";

// Duplicate / incorrect records — hide from public
const DUPLICATES = [
  "0089d1f7-336b-4b97-9d0b-8627ea855718", // Quaker Ridge (Mamaroneck) — dup of 444a627b (Scarsdale)
  "16e9dd33-0d7b-4958-93f3-5063fa122144", // Saxon Woods (Scarsdale) — dup of e4de2fa4 (Mamaroneck)
  "f90a8422-b5e4-4540-9950-1904bd95daf1", // Sunningdale CC (Greenville) — dup of 3b5d99e5 (Scarsdale)
];

const COURSES = [
  {
    id: "b3e36983-05d5-4440-a453-df5b736c970c",
    description: "One of Connecticut's oldest clubs, the Country Club of New Canaan traces its origins to 1893 when Willie Park Jr. laid out the original nine holes across Fairfield County farmland; Alfred Tull completed the current 18-hole layout in 1947, producing a par-71 that rewards precision over power. The course plays through mature tree-lined corridors with push-up greens that carry the unhurried character of a classic New England layout. It carries the quiet authority of a club that has never needed to announce itself.",
    yearEstablished: 1893, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/92/7c/c3b52433388a36020103a23a48b7/75757.jpg", logoUrl: null,
  },
  {
    id: "f000d4fd-2a18-4a76-9c27-cdc4a036990a",
    description: "Doral Arrowwood's nine-hole par-35 course was a resort track designed by Robert von Hagge and opened in 1990 on the 114-acre Doral Arrowwood Conference Center property in Rye Brook. Set amid manicured grounds connected to the hotel's sports complex, the layout offered a compact and playable executive test suited to its conference clientele. The course and hotel ceased operations in December 2019.",
    yearEstablished: 1990, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/33/c3/d19df655b47a27fbd9814edaa88c/90461.jpg", logoUrl: null,
  },
  {
    id: "44f31f77-79b4-4195-a748-5f733741cd1c",
    description: "Dunwoodie is among the oldest public courses in Westchester County, having opened in 1903 atop Dunwoodie Heights in Yonkers on terrain that demands accuracy and nerve in equal measure. The par-70 layout at just under 5,800 yards plays longer than its scorecard suggests thanks to dramatic elevation changes and tight, tree-lined corridors. Operated by Westchester County, it rewards regulars who learn its idiosyncratic grades and compensates with some of the better-maintained greens among the county's municipal tracks.",
    yearEstablished: 1903, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/e0/57/519ea9a716f8bbb06d386c5cdc6f/66389.jpg", logoUrl: null,
  },
  {
    id: "33b38812-2c4a-46ed-9a6a-9596796a4473",
    description: "E. Gaynor Brennan opened in 1922 as the privately owned Hubbard Heights Golf Club, designed by Maurice McCarthy Sr., before the City of Stamford purchased it in 1949 and opened it to the public — where locals still call it 'The Heights.' The par-71 at 6,316 yards rolls across a forested Fairfield County hillside with tree-lined fairways and a slope of 124 that makes it a fair and honest test for a wide range of handicaps. It has the worn-in charm of a course that has been a community anchor for more than 75 years.",
    yearEstablished: 1922, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/ec/0b/ed630dcf496fc8facdc43f26d301/15520.jpg", logoUrl: null,
  },
  {
    id: "9f082302-0427-499e-ad4f-769abd18350a",
    description: "Fairview Country Club relocated from Westchester to its current Greenwich site in 1968, when Robert Trent Jones Sr. designed the sweeping 6,915-yard par-72 through wooded Connecticut countryside with his characteristic boldness. The course carries a slope of 139 and rating of 73.6, numbers that reflect Jones's insistence on precise approach angles and large, undulating greens. It plays with the unhurried authority of a classic Trent Jones layout — demanding ball-striking rewarded, sloppy play penalized.",
    yearEstablished: 1968, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/e3/b9/13d4e493b5f4fb9f114ae9d6c624/94713.jpg", logoUrl: null,
  },
  {
    id: "b282b957-1db5-43bd-a798-bf571d0a7c54",
    description: "Glen Cove Golf Club occupies a prominent stretch of Long Island's Gold Coast, its 18-hole public layout designed by William F. Mitchell and opened in 1972 on terrain that delivers elevated views toward Long Island Sound. The course plays 6,400 yards through a mix of open and wooded holes that use the property's natural contours effectively. It's a well-maintained and accessible municipal track that consistently punches above its weight class.",
    yearEstablished: 1972, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/0c/51/c3f2b98a8de3ebd43a1319eb64f0/57613.jpg", logoUrl: null,
  },
  {
    id: "7f30e7e6-fb59-4ebb-860a-d75d0665c9ff",
    description: "Griffith E. Harris is Greenwich's only public golf course, a Robert Trent Jones Sr. design that opened in 1965 on 158 acres along King Street — built with highway land-swap funds championed by First Selectman Griffith Harris, whose name the course took upon his death in 1998. The par-71 at 6,352 yards delivers a genuine Trent Jones experience at public-course pricing, with bold bunkering and approach shots that demand precision. Well-maintained and underrated, it gives everyday golfers access to a credentialed designer in one of Connecticut's wealthiest communities.",
    yearEstablished: 1965, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/ef/c5/e8b786065b187250805c710df5c4/130411.jpg", logoUrl: null,
  },
  {
    id: "3041ecb7-cd57-4c1f-b72b-640e0fdac1cb",
    description: "Hackensack Golf Club is a Golden Age treasure founded in 1899 and relocated to Emerson in the late 1920s, where Charles Banks — a disciple of Seth Raynor — completed his first solo design in 1928, complete with template holes including a Redan, Short, and Biarritz. Rees Jones led a meticulous restoration beginning in 2007 after the original Banks plans were discovered in the clubhouse basement, returning the course to its intended strategic character with raised greens and natural bunkering. The result is one of New Jersey's most architecturally significant private clubs — demanding, intelligent, and deeply satisfying.",
    yearEstablished: 1899, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/a2/eb/fff36c21378a7adbb0132c0d5fbba/38634.jpg", logoUrl: null,
  },
  {
    id: "4142a87e-3462-4aa2-a44a-bb7b6c83402f",
    description: "Harrison Meadows opened in 1917 as Green Meadow Country Club on a Maurice McCarthy design that evolved through renovations by Alfred Tull and Ken Dye into the semi-private 18-hole track it is today, now owned by the Town of Harrison. The par-71 at roughly 6,500 yards navigates tree-lined fairways with elevation changes and small, undulating greens — the same grounds used for filming The Wolf of Wall Street and the Amazon series Red Oaks. It delivers classic Westchester character at an accessible price point for both members and public players.",
    yearEstablished: 1917, courseType: "SEMI_PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/39/e6/d0dab387bb554fe044477f8653db/93650.jpg", logoUrl: null,
  },
  {
    id: "ea600117-3774-4097-958f-2059bb1fe911",
    description: "Haworth Country Club is a private Bergen County club whose current 18-hole layout was substantially overhauled by Robert Trent Jones Jr. in 2000, extending the course to over 7,000 yards with bentgrass surfaces maintained to a consistently high standard. The course carries a rating of 73.8 and slope of 136, and has hosted NJSGA championships including the State Amateur. It plays with the polished confidence of a club that invested seriously in its infrastructure — generous off the tee, demanding at the green.",
    yearEstablished: 1965, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/70/e3/895c13a37c167695b7ba65d5c661/38617.jpg", logoUrl: null,
  },
  {
    id: "20664aae-92b7-4d7c-83c8-b94ef05dcb34",
    description: "Hudson Hills is a Westchester County public course opened in 2004 on land with a layered history — a former IBM campus that was itself home to Rising Sun Golf & Country Club, established in 1936 as the premier Black-owned golf facility in the Tri-State area. Architect Mark Mungeam carved an 18-hole layout through dense woodlands and hillside terrain, producing a par-72 that delivers a genuine challenge from its elevated, wooded corridors. It's one of the more interesting public tracks in the lower Hudson Valley, rewarding golfers who embrace rather than resist its mountain character.",
    yearEstablished: 2004, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/15/4a/97c894f713cd9f9aee3e43f022e8/66391.jpg", logoUrl: null,
  },
  {
    id: "6c5c2a35-c00d-4a8f-97a0-6e8cd5b71e25",
    description: "Innis Arden is one of the oldest private clubs in Connecticut, formally organized in 1899 on the nine-hole course built by J. Kennedy Tod on his Greenwich Point estate, with the full 18-hole A.W. Tillinghast layout opening in 1908 across 147 wooded acres in Old Greenwich. The compact strategic design carries Tillinghast's early-period fingerprints — thoughtful bunkering, natural green contours, and angles that reward proper positioning off the tee. It feels unmistakably rooted in its Old Greenwich setting, where history and golf have coexisted for well over a century.",
    yearEstablished: 1899, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/35/d2/a494ff6860334d722d2db7078307/102426.jpg", logoUrl: null,
  },
  {
    id: "720e7538-1323-48ec-8b19-282899629312",
    description: "Knickerbocker Country Club was founded in Tenafly in 1914 by Malcolm Mackay, with Donald Ross designing both nines that opened in 1915 — making it one of New Jersey's most intact Ross layouts at a par-72 stretching 6,726 yards. Rees Jones led a careful restoration in 2008 and 2009, working from Ross's original plans to reclaim the course's strategic character with raised crowned greens and natural bunkering. The result is a private club of genuine architectural merit — not long by modern standards, but consistently rewarding for golfers who understand what Ross was asking of them.",
    yearEstablished: 1914, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/fe/f8/26464607c01f5ad65205475f36d2/38560.jpg", logoUrl: null,
  },
  {
    id: "a4a6390f-474d-4975-80f0-40ed9cb85e17",
    description: "Lake Isle Country Club is a town-owned public facility in Eastchester built on a 1926 Devereux Emmet design, originally a private club before Eastchester purchased the 116-acre property in 1979 and opened it to the public. The par-70 at 6,009 yards makes efficient use of Emmet's rolling routing, with short but strategically demanding holes that reward course management over distance. The addition of pools and tennis courts makes it one of the most complete municipal recreation complexes in Westchester County.",
    yearEstablished: 1926, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/b6/d5/b81ffb93e0b81f0d12824b6f9dee/72051.jpg", logoUrl: null,
  },
  {
    id: "e5dc080f-b1eb-4e87-aa1d-aa8429b00fae",
    description: "Maple Moor is the oldest of Westchester County's six public courses, a Tom Winton design that began as a nine-hole private layout on the former Griffen family farm before the county took it over in 1925 and expanded it to 18 holes. The par-71 at 6,371 yards takes its name from the maple trees dense across the property and delivers the honest, tree-lined character of a classic county track. It rewards regulars who learn the rhythms of a course that has been serving the community for a century.",
    yearEstablished: 1923, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/eb/20/aaba1bb0743afd73107169dcd2b8/66386.jpg", logoUrl: null,
  },
  {
    id: "3ec4004c-00f7-4dd7-9ef7-b888e3bdef28",
    description: "Mohansic is widely considered the most demanding of Westchester County's six public courses, a Tom Winton design from 1926 set on rolling hills in Yorktown Heights that plays to a par-70 at over 6,550 yards from the back tees. The layout features sustained elevation change, tight tree-lined corridors, and greens that require disciplined approach play to hold. Among the county's public offerings, Mohansic earns its difficult reputation through terrain that simply does not let up.",
    yearEstablished: 1926, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/e3/9b/2213c107e9b71f45c267b59ff269/66387.jpg", logoUrl: null,
  },
  {
    id: "0a3d70e4-5a2b-4dd8-a1bf-fe9b5aa21100",
    description: "Old Oaks Country Club was organized in 1925 on a Purchase estate with grounds designed by Beatrix Farrand — the landscape architect behind the White House Rose Garden — giving the club a sense of setting that most courses cannot claim. The 18-hole course was routed by A.W. Tillinghast in 1925 and built by Charles Alison and Harry Colt, producing a par-72 that rewards careful strategy over gently rolling Westchester terrain. It's a club of genuine architectural pedigree that carries an understated elegance suited to its Purchase address.",
    yearEstablished: 1925, courseType: "PRIVATE",
    coverUrl: null, logoUrl: null,
  },
  {
    id: "42716cbc-83a8-4297-be1e-a32e202b9181",
    description: "Old Tappan Golf Course is a compact nine-hole par-35 layout designed by Hal Purdy and opened in 1970 for residents of Old Tappan, New Jersey, earning the local nickname 'Jewel of Bergen County' for its walkable, well-maintained character. The course plays just under 3,000 yards through tree-lined fairways and has attracted a loyal following that values intimacy and accessibility over the pretension of larger facilities. It's a community-rooted track that has quietly served Bergen County golfers for over five decades.",
    yearEstablished: 1970, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/90/69/e28862459740ff6722e0035fb4c3/38734.jpg", logoUrl: null,
  },
  {
    id: "40d2f921-407d-4266-9b07-1630f25710fa",
    description: "Orchard Hills began as an A.W. Tillinghast-designed 18-hole private club in 1925 before being reconfigured as a nine-hole public track in the late 1960s to accommodate the development of Bergen Community College, on whose grounds it now sits. Renovations in 2011 and 2012 rebuilt bunkers, greens, and two holes while improving pace of play and aesthetics. It's a sporty public nine with better bones than its campus setting might suggest.",
    yearEstablished: 1925, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/1a/21/b19889c2aeb4d0f5fb29cadc3db4/38510.jpg", logoUrl: null,
  },
  {
    id: "d68496af-28b3-4f56-ab48-8c42ba7669f3",
    description: "Overpeck Golf Course is an 18-hole Bergen County public facility designed by Nicholas Psiahas and opened in 1967, playing 6,584 yards to a par-72 across open terrain with strategic water hazards and bunkers distributed throughout. Operated by the county and consistently maintained, the course delivers a fair and approachable test accessible to a wide range of handicaps. It serves the dense northeastern New Jersey golf market with the reliability of a well-run municipal operation.",
    yearEstablished: 1967, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/ee/8e/09dd7cc4d2cf20b192990e194cde/38539.jpg", logoUrl: null,
  },
  {
    id: "738c2906-2b9b-42f8-b16c-6ff837b31330",
    description: "Paramus Golf Course has anchored public golf in the borough since 1939, a par-71 at 6,173 yards that Stephen Kay improved in 1991 with three redesigned holes and rebuilt greens that added variety to the classic layout. Elevated putting surfaces and tree-lined fairways give the course a classically proportioned character, and as one of the most-played tracks in Bergen County, it benefits from consistent conditioning. It's an honest, accessible layout that serves its community with the reliability of a facility that has never needed to be more than what it is.",
    yearEstablished: 1939, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/8a/6f/6f060475026e9e8055c184bda86e/38615.jpg", logoUrl: null,
  },
  {
    id: "24358327-4176-479e-bcde-82eab600462c",
    description: "Patriot Hills is a public course carved into the Ramapo Mountains of Rockland County by architect Rick Jacobson and opened in 2003 on the site of the former Letchworth Village, where the first human polio vaccine trials were conducted in 1950. The par-71 at 6,502 yards navigates dramatically rolling terrain with sustained elevation change — the 2nd hole descends over 200 feet from tee to fairway — earning recognition as one of New York's top-20 public courses. It's an immersive layout that rewards golfers willing to embrace rather than resist the mountain character of the land.",
    yearEstablished: 2003, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/33/27/c35549c7a8a33d2967f51f54d1d6/126626.jpg", logoUrl: null,
  },
  {
    id: "d696746e-93c2-4d39-b13a-2ddc778455df",
    description: "Pehquenakonck Country Club is a semi-private nine-hole course nestled in the rural northeast corner of Westchester, built in 1923 on terrain that offers genuine elevation change across a compact routing. Two sets of tees allow the course to play as an 18-hole round with meaningfully different looks at each hole. Affordable, accessible, and unpretentious, it draws a loyal local membership that values good golf over grand amenity.",
    yearEstablished: 1923, courseType: "SEMI_PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/63/e2/639979c223079c7c97432e14f2b6/36806.jpg", logoUrl: null,
  },
  {
    id: "9aae2c60-7b17-45f7-af57-5ee435dc9a04",
    description: "Pelham Country Club has one of the deepest pedigrees in American golf, with Devereux Emmet completing the 18-hole course in 1921 for an opening that drew British Open Champion Jock Hutchinson and international stars before a large gallery. The club secured its permanent historical legacy in 1923 when it hosted the PGA Championship, where Gene Sarazen defeated Walter Hagen in 38 holes. At par-71 and 6,388 yards with a slope of 138, the Emmet design — refined by Alfred Tull and Roger Rulewich — retains its fundamental difficulty.",
    yearEstablished: 1908, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/b9/a8/efa43a434bdd617d66d9a6d15408/38494.jpg", logoUrl: null,
  },
  {
    id: "5efa2f9f-aff8-4d67-87ba-d3bd76f0585e",
    description: "Philip J. Rotella Memorial Golf Course is a public municipal layout in Thiells designed by Hal Purdy on former Letchworth Village state land acquired by the Town of Haverstraw and named in honor of longtime supervisor Philip Rotella. The par-72 at 6,517 yards received a comprehensive redesign by Stephen Kay in 1999–2003, with new bunkers, tees, and rebuilt holes that raised the course's playing standard considerably. It's well-regarded for its conditioning among Rockland County public courses and provides a genuine test through open terrain with water in play on multiple holes.",
    yearEstablished: 1984, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/47/a9/8342623e32d4dcbc8095e01a5144/28734.jpg", logoUrl: null,
  },
  {
    id: "3ce6e462-85de-4de7-96f5-74446b7d23f5",
    description: "Piping Rock Club was founded in 1911 by a group led by Manhattan lawyer Paul Cravath, with Charles Blair Macdonald designing the 18-hole course under Seth Raynor's supervision and debuting what became his most imitated creation: the Biarritz hole, introduced here before spreading to courses across the country. The Gold Coast layout also features the Short, Eden, and Redan templates executed with Raynor's characteristic precision, and Bruce Hepner led a restoration beginning in 2008 that preserved the integrity of the Macdonald-Raynor design. It remains one of the finest examples of template-hole architecture still played in the Northeast.",
    yearEstablished: 1911, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/c1/17/1e50436219ef9a7370047b8b62db/97970.jpg", logoUrl: null,
  },
  {
    id: "b76eb7ac-c90a-4c48-be6c-f8bc6b9b4e51",
    description: "Pleasantville Country Club is a private nine-hole club in Westchester laid out by A.W. Tillinghast in 1926, featuring narrow tree-lined fairways and the contoured, closely bunkered greens that characterize his signature style. The course plays 2,116 yards at par-32 — compact in numbers but demanding in execution, as Tillinghast's bunkering and approach angles still require thoughtful shot selection to score well. It's an intimate and architecturally interesting club carrying the DNA of one of American golf's most consequential designers.",
    yearEstablished: 1926, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/11/6a/4d772a7add596fff1dceeb25551f/67549.jpg", logoUrl: null,
  },
  {
    id: "d315465a-d97c-4174-9dd6-2468765926c0",
    description: "Putnam County Golf Course opened as Putnam National in 1959, with William F. Mitchell designing the 6,800-yard par-71 across scenic lower Hudson Valley terrain before Putnam County purchased the property in 2004 and opened it to the public. The layout delivers legitimate challenge from the back tees — Mitchell's routing uses elevation and doglegs to keep every club in the bag in play — and the panoramic Hudson Valley surroundings add a genuinely picturesque dimension. It's among the better public-access values in the greater New York region for golfers willing to make the drive.",
    yearEstablished: 1959, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/8d/4a/fc89881f94609333047fb2eb6e12/105289.jpg", logoUrl: null,
  },
  {
    id: "04e0bef0-51a7-43f9-ba28-9f4eb4643637",
    description: "Ramsey Golf and Country Club took shape in 1940 on the former DeWyckoff estate, a 220-acre property that had been carefully cultivated over three decades before Hal Purdy designed the golf course through its mature grounds. The par-69 at 5,540 yards is compact but well-structured, with a Ron Cutlip renovation in 2005 refining conditions while preserving the pastoral, estate-rooted character of the facility. It's an intimate semi-private club with a genuine sense of place in northern Bergen County.",
    yearEstablished: 1940, courseType: "SEMI_PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/6a/c4/3fb1dad98637e24b062cd9c7d2f8/38788.jpg", logoUrl: null,
  },
  {
    id: "cab347ba-300b-4d3c-bb9f-cc7e429b966b",
    description: "Richter Park is consistently ranked among the top public courses in New England, an Edward Ryder design opened in 1972 on land donated to the City of Danbury by Stanley and Irene Richter, where the West Lake Reservoir borders seven front-nine holes and water comes into play on 14 of 18 total holes. The par-72 at 6,744 yards has earned rankings as high as top-25 nationally among public courses, with course conditions and strategic variety that justify repeated recognition. It's a genuine destination track that happens to sit in a Connecticut municipal park.",
    yearEstablished: 1972, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/ef/4d/ec33fc26da9e07fe95d799b0681b/124880.jpg", logoUrl: null,
  },
  {
    id: "b660a533-bd2b-4b9e-8396-542332dbda76",
    description: "Ridgefield Golf Club is a public course designed by George and Tom Fazio that opened in 1975 on rolling Connecticut terrain, playing to a par-71 at 6,444 yards for a town-owned facility managed cooperatively with a 300-member club. The Fazio routing takes full advantage of the natural grades and varied elevation to deliver a course with genuine strategic interest at an accessible price point. It's a well-run public track that benefits from the Fazio pedigree and the natural assets of the Ridgefield landscape.",
    yearEstablished: 1975, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/38/59/79c1b6e37f7765c389c274a1d149/69174.jpg", logoUrl: null,
  },
  {
    id: "569a9194-01b6-45b5-aa3f-958f1c74639f",
    description: "Ridgewood Country Club in Danbury is a private nine-hole club established in the 1920s on wooded Connecticut hillside terrain, playing through tree-lined fairways that reward accurate ball placement over length. Two sets of tees allow members to play an 18-hole round with varied looks on each hole across the intimate layout. It's a quietly traditional club that has served the Danbury golf community for nearly a century.",
    yearEstablished: 1925, courseType: "PRIVATE",
    coverUrl: null, logoUrl: null,
  },
  {
    id: "5ca32e25-0498-4819-b8c2-14290bb87872",
    description: "Rockland Country Club is a private club in Sparkill incorporated in 1906, with a course history that runs through some of the 20th century's most notable designers — Robert White's full 18 opening in 1930, a Robert Trent Jones Sr. redesign in 1965, and more recent work by Stephen Kay. The par-71 at 6,703 yards plays with the layered complexity that comes from decades of careful evolution, with a slope of 141 that places it among the more demanding private clubs in the lower Hudson Valley. Its Route 9W setting and long history give it a quiet prestige that speaks for itself.",
    yearEstablished: 1906, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/ae/07/2bace8d6304cfaef4868ae462bfa/75204.jpg", logoUrl: null,
  },
  {
    id: "8799547f-a7b7-4bfe-abf1-d0f33e9273cf",
    description: "Rockland Lake Championship is an 18-hole public course in the New York State Park system, designed by David Gordon and opened in 1969 above the Hudson River in Congers. The par-72 at 6,864 yards features narrow, sloped fairways and greens with subtle breaks that reward course knowledge and disciplined iron play — a slope of 133 confirming the layout's sustained difficulty. Among the Hudson Valley's public state park courses, it's the most demanding and consistently surprises golfers who underestimate it.",
    yearEstablished: 1969, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/71/b9/8dd3317e288c4f873d22e45f2b79/64560.jpg", logoUrl: null,
  },
  {
    id: "59669cc6-1711-4b6f-bcd7-dceedf7a08c6",
    description: "Rockland Lake Executive is the companion 18-hole par-3 layout to the Championship course at Rockland Lake State Park, designed by David Gordon and opened in 1969 within the same scenic Hudson Valley setting. The course provides an accessible and well-maintained test for golfers developing their short game or seeking a quicker round in a public park environment. It plays a distinct and complementary role alongside the Championship course at one of the region's busiest golf destinations.",
    yearEstablished: 1969, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/02/43/7d1de0eb1ae0f893d02fc8036a15/64563.jpg", logoUrl: null,
  },
  {
    id: "f46153cc-86dd-4641-b096-f24cb49cd8a7",
    description: "Rockleigh Golf Course was the first public golf facility in Bergen County, designed by Alfred H. Tull and opened on April 1, 1959, after Tull laid out the Red and White 18-hole combination over the rolling pastures of former 18th-century Dutch farms. A nine-hole Blue course followed in 1961, giving golfers multiple routing combinations across a naturally varied landscape. Tull's clean, accessible design has served the dense golf population of northeastern New Jersey for more than six decades without pretense.",
    yearEstablished: 1959, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/c1/38/b8d513b4fbeb55250c7bba8dae50/27777.jpg", logoUrl: null,
  },
  {
    id: "83686c0a-afda-4513-a9e3-2ef7b640afab",
    description: "Rockrimmon Country Club was conceived at a 1947 dinner party among Stamford residents and built by Robert Trent Jones Sr. on 218 acres spanning the Connecticut-New York state line, with Jones declaring the finished course one of the most beautiful he had designed along the eastern seaboard. The layout's original signature feature was a golfalator — a small tram that carried players up the steep grade from the 9th green to the 10th tee — and the course retains that dramatic terrain through a par-72 with a slope of 133. It's a well-regarded private club of genuine character that commands loyalty from its Stamford membership.",
    yearEstablished: 1947, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/da/8b/6fdc8d74a0550ea92765291bf5f1/58119.jpg", logoUrl: null,
  },
  {
    id: "197542bc-3cc4-45f3-a360-2bab79a441c2",
    description: "Round Hill Club in Greenwich was founded in 1922 with a course routed by Walter Travis — one of the most influential American-born golfers turned course designers — opening in 1924 with push-up greens that Gil Hanse carefully restored to their intended character in 2016. The par-71 plays 6,525 yards with a signature 178-yard par-3 11th requiring a full carry over water that has settled many a member match. It plays with the refined restraint that defines the best of Connecticut's Gold Coast private clubs.",
    yearEstablished: 1922, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/e9/1f/26acd30195fdc92b0bf4b5fe39d6/75793.jpg", logoUrl: null,
  },
  {
    id: "6ff37168-4155-4406-a648-82d79cd2e4dd",
    description: "Sanctuary Country Club was a semi-private 18-hole course in Yorktown Heights designed by Nat Squire and opened in 1955 on 180 acres that included a catering facility used by Gerald Ford during his time as Vice President. The par-71 at 5,810 yards closed permanently in 2006, and subsequent redevelopment efforts by the Town of Yorktown did not result in a reopening.",
    yearEstablished: 1955, courseType: "PUBLIC",
    coverUrl: null, logoUrl: null,
  },
  {
    id: "1a23ac60-2038-4e68-a971-bc8b4a8eec55",
    description: "Sands Point Golf Club occupies a prized North Shore Long Island location with an A.W. Tillinghast design from the late 1920s, when Tillinghast was invited to expand an existing nine-hole layout into a full 18 on the Sands Point peninsula. The par-71 at 6,823 yards has been carefully maintained through a Rees Jones renovation in 1991 that reclaimed Tillinghast's original bunkering features and strategic angles. It's a private club of genuine pedigree whose course rewards intelligent rather than powerful play.",
    yearEstablished: 1927, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/50/00/34cc262e3a4b330f514d2406565f/38669.jpg", logoUrl: null,
  },
  {
    id: "9a646e78-4dd2-44da-ad02-c7794c8210b0",
    description: "Silver Spring Country Club is a private Fairfield County club anchored by a Robert White design that opened in 1930 — White was the first president of the PGA of America and co-founder of the ASGCA — across a 300-acre Ridgefield property that has grown more refined with each decade. Arthur Tull extended the layout in 1968 and the Roger Rulewich Group completed a 2006 renovation, producing a par-71 at 6,636 yards with a slope of 135. It delivers more architectural depth than its modest reputation suggests, with a course that rewards members who take time to understand its angles.",
    yearEstablished: 1930, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/52/6f/962a2e23f824663c5b837d3294a3/94719.jpg", logoUrl: null,
  },
  {
    id: "2685a2d3-8eb8-4759-8281-28f6f3da9909",
    description: "Siwanoy Country Club is one of the most historically significant clubs in American golf, hosting the inaugural PGA Championship in 1916 on a Donald Ross course completed in 1913 — the first major professional championship held in the United States, won by Jim Barnes. Founded in 1901, the course has been refined by Robert Trent Jones Sr. and plays to a par-71 at 6,388 yards with a slope of 138, retaining the strategic complexity that Ross built into its Eastchester hillside. Few clubs anywhere can claim both a Ross pedigree and a pioneering major championship on the same grounds.",
    yearEstablished: 1901, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/0b/7d/c409fd2a4538c7d0fed80bb78ec9/38664.jpg", logoUrl: null,
  },
  {
    id: "d620d1ba-b3dc-4b61-a956-203b0c756bda",
    description: "Spook Rock Golf Course is an award-winning 150-acre public course in Montebello designed by Frank Duane, with the front nine opening in 1969 and the full 18 completing in 1970 on the former site of the first Boy Scout camp in the United States. The par-72 at 6,807 yards features water on seven holes, over 50 bunkers, and sloping greens that challenge consistent scoring at every level. It's one of the better-run municipal tracks in the lower Hudson Valley, earning repeated recognition for its conditioning and layout quality.",
    yearEstablished: 1969, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/b6/d7/e6f5687e203a0399e15bbcf5e908/60902.jpg", logoUrl: null,
  },
  {
    id: "d6090ea1-78ad-41f7-b7ee-77b7e14e026f",
    description: "Sterling Farms Golf Course is Stamford's publicly accessible complement to the private clubs of Fairfield County, a Geoffrey Cornish design that opened in 1972 across 144 acres of a former working dairy farm — the original farm buildings still visible from several fairways. Robert McNeil led a 2005 renovation that sharpened the par-72 at 6,423 yards without altering its fundamentally open, pastoral character. It's a municipal course that manages to feel more spacious and historically grounded than most, with a genuine sense of place rooted in its agricultural past.",
    yearEstablished: 1972, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/f6/73/c95f9f278e940a833a4925f9dbf4/13667.jpg", logoUrl: null,
  },
  {
    id: "fe029162-8332-4850-853b-1b1ecc14d218",
    description: "Storm King Golf Club is one of New York's oldest golf venues, tracing its origins to 1894 when Willy Norton and George Low designed a nine-hole course in the Hudson Highlands of Cornwall. The club has been reimagined by designer David Gang, who transformed the 63-acre property into an inclusive format serving veterans, people with intellectual disabilities, and traditional golfers alongside one another. The Storm King Mountain backdrop and Hudson Valley setting remain as compelling as they were in the 19th century.",
    yearEstablished: 1894, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/5c/f0/67f9a57db58dd6168926090ac83e/67751.jpg", logoUrl: null,
  },
  {
    id: "26bd67a6-fd24-4edf-9da5-8af4c0cf811b",
    description: "Tamarack Country Club relocated from Port Chester to its current Greenwich property in 1928, where Charles Banks — a protégé of Seth Raynor and C.B. Macdonald — completed the 18-hole layout in 1929 with template holes that include Raynor-style Biarritz and Eden designs woven into a challenging back nine. Ron Forse and Mike DeVries led a 2016 restoration that returned the Banks architecture to its intended playing characteristics. It's one of the most underappreciated Golden Age designs in the region, combining architectural depth with the intimate character of a genuinely private club.",
    yearEstablished: 1928, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/fa/98/c1029a00340600046bd6ec869732/67893.jpg", logoUrl: null,
  },
  {
    id: "ced2040e-0043-4b92-9cab-f3fc948a0ad2",
    description: "The Links at Valley Fields is a nine-hole par-3 course that opened in 2023 on a Yorktown property that had sat dormant since the original Shallow Creek Golf Course closed in 2007. The compact 1,155-yard test at par-27 is approachable for beginners while offering enough pin variation to engage experienced players practicing their short game. It represents a community-driven second life for a long-neglected parcel of Westchester town parkland.",
    yearEstablished: 2023, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/00/8b/0612d099c4b169ecb9fc947426d5/124093.jpg", logoUrl: null,
  },
  {
    id: "0713a183-adf2-41cf-9906-7fdf76433092",
    description: "The Milbrook Club is a compact nine-hole private club in Greenwich established in 1923 in the gated Milbrook district, its course designed by Geoffrey Cornish through mature tree-lined grounds that reflect the old-money discretion of the neighborhood. Played from two sets of tees for an 18-hole round, the layout reaches 6,287 yards at par-70 and rewards placement and control over distance. Its intimacy and understatement make it one of the more distinctive among Greenwich's collection of private clubs.",
    yearEstablished: 1923, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/12/09/bc233eca57866f23e088cb488a91/73982.jpg", logoUrl: null,
  },
  {
    id: "017532ed-e8b8-4c13-87a0-ffe7e7674450",
    description: "The Saint Andrew's Golf Club is the oldest golf club in the United States, founded in 1888 by Scottish immigrant John Reid in Yonkers before settling at its current Hastings-on-Hudson home in 1897 — and one of the five founding members of the USGA in 1895. The 18-hole course was designed by William H. Tucker and Harry Tallmadge, with Jack Nicklaus leading a significant refurbishment in 1983 that modernized conditions while respecting the club's foundational role in American golf. Playing here is as much a walk through the origin of the American game as it is a round of golf.",
    yearEstablished: 1888, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/cf/9c/0bb69e1be7719f93651a8fee7bad/93006.jpg", logoUrl: null,
  },
  {
    id: "d5d25ae7-cd21-4a57-aa83-fc76b84c10e8",
    description: "The Stanwich Club is one of the most technically demanding private courses in the metropolitan area, a William and David Gordon design from 1964 that plays to a par-72 at 7,445 yards with a slope of 145 and a course rating of 76.6 — among the highest in the region. Gordon's signature raised greens, canted severely from back to front and bunkered at their front corners, are the layout's defining challenge, with water coming into play on eight holes across the expansive Greenwich property. A Tom Fazio renovation in 2005 softened some conditions without diminishing the course's deserved reputation as a genuine examination of ball-striking.",
    yearEstablished: 1962, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/de/ed/a8b11c9ee20a948b8a5f8db172cc/75677.jpg", logoUrl: null,
  },
  {
    id: "b75832b7-592d-4066-b49c-fdcbbda400f3",
    description: "Trump National Golf Club Westchester occupies a 140-acre site in Briarcliff Manor originally home to Devereux Emmet's Briar Hall Country Club before Donald Trump rebuilt it entirely, reopening in 2002 with a Jim Fazio course measuring 7,300 yards to a par-72. The layout's signature is the par-3 13th, where a 101-foot waterfall frames the approach shot in a manner that makes subtlety impossible — a design choice that defines the course's theatrical personality. It's a high-service private club that delivers a polished experience without sacrificing genuine challenge from the back tees.",
    yearEstablished: 2002, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/49/ac/85a05a782132be636615c63a9929/109071.jpg", logoUrl: null,
  },
  {
    id: "458746ed-f4ed-4f24-a195-c69f573a71ca",
    description: "Valley Brook Golf Course opened in 1962 and was acquired by Bergen County in 2006, becoming part of the county's public golf system alongside Overpeck, Paramus, Rockleigh, and Orchard Hills. The 18-hole layout along the Pascack Valley was renovated by Robert McNeil in 2012, maintaining its accessibility as a flat, walkable public course in River Vale. It serves western Bergen County as the county system's most pastoral option.",
    yearEstablished: 1962, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/62/b0/983bc126902f8571293271edb168/27542.jpg", logoUrl: null,
  },
  {
    id: "7da0e250-294f-4b72-ac72-9ee77b493db9",
    description: "Waccabuc Country Club was established in 1912 on the shores of Lake Waccabuc in the rural northeast corner of Westchester, growing from a modest nine-hole layout to a private 18-hole course that now plays 6,489 yards at par-70. Alfred Tull is credited with refining the course through the wooded, lakeside terrain, and the combination of golf, beach access on the lake, tennis, and paddle gives it one of the most complete private club environments in the county. It's a club defined as much by its natural setting as by its golf.",
    yearEstablished: 1912, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/07/3f/9db08b85f5f16858462dd3c09be0/105357.jpg", logoUrl: null,
  },
  {
    id: "ffafdfcd-54b0-4273-8a9e-4a0c7b9678e5",
    description: "Wee Burn Country Club in Darien carries one of the more charming origin stories in American golf — its name was suggested by Andrew Carnegie, who proposed the stony brook winding through the property be called Wee Burn as it would in Scotland. The club was formally organized in 1896 and now plays to a par-72 at over 7,000 yards after a Ron Forse renovation, the result of more than a century of careful evolution from George Strath's original nine-hole layout. Its longevity, community roots, and genuine personality set it apart among the competitive private clubs of Fairfield County.",
    yearEstablished: 1896, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/df/96/b74327a3afa7cc944826eb918a9b/46668.jpg", logoUrl: null,
  },
  {
    id: "58e5299b-f0f9-497a-a82e-474957a73c5c",
    description: "West Point Golf Course is a Robert Trent Jones Sr. design opened in 1948 — its construction assisted by German prisoners of war — set on the dramatic terrain of the U.S. Military Academy campus above the Hudson River. The par-70 at 6,007 yards plays on mountain-course terrain with narrow fairways, significant elevation change, and tee markers that trace American military history from the Revolution through present day. Open to the public, it offers one of the most historically resonant rounds available in the Hudson Valley.",
    yearEstablished: 1948, courseType: "PUBLIC",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/94/fb/2f1f73f2be663bd67d3dad6cc4b8/124487.jpg", logoUrl: null,
  },
  {
    id: "40cc5e09-a186-4597-a210-868c42607e74",
    description: "Westchester Country Club was established in 1922 by hotelier John McEntee Bowman on a 650-acre estate in Rye, with Walter Travis designing both the West and South championship courses alongside Warren and Wetmore's landmark Italian villa-style clubhouse. The West Course — a par-72 at 6,718 yards — has hosted multiple major professional events and was built as a deliberately demanding championship track with severe bunkering and small, contoured greens. It remains one of the most complete and historically significant private clubs in the metropolitan area.",
    yearEstablished: 1922, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/dd/b2/45ce4acf95debf0f641c90a50e22/75784.jpg", logoUrl: null,
  },
  {
    id: "d8e0e0db-d574-46ef-927d-3b08d8b3a129",
    description: "Whippoorwill Club was established in the mid-1920s on the second-highest point in Westchester County, with Donald Ross designing the original layout and Charles Banks completing a significant redesign in 1928 that shifted six holes across Whippoorwill Road. Tripp Davis led restorations in 2003 and 2006 that have kept the course competitive, and Golfweek ranked it 73rd among classic American courses — a slope of 142 confirming its sustained difficulty. The split-property design across Armonk and Chappaqua and the elevated, wooded terrain give it a secluded character that distinguishes it from flatter Westchester clubs.",
    yearEstablished: 1925, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/bd/65/08d414135542906ef3220bc4562d/93326.jpg", logoUrl: null,
  },
  {
    id: "1a7afbc7-3764-47a3-b10c-419f5f1ee287",
    description: "White Beeches Golf and Country Club has operated in Haworth since 1918, with Walter Travis overseeing a substantial redesign in 1920 that shaped the par-72 at 6,556 yards into one of New Jersey's better private courses — one that has hosted U.S. Open sectional qualifiers and the Metropolitan Open. Named for the beech trees that once defined the grounds, the course carries a slope of 138 that demands sustained precision and makes approach play to well-guarded greens the decisive element of every round. The Travis influence is evident throughout in the placement and severity of bunkers that continue to test players a century after his redesign.",
    yearEstablished: 1918, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/d4/b8/85f122dc7d80b5dd0c5ac3e1a91a/38604.jpg", logoUrl: null,
  },
  {
    id: "17354ad2-8cf4-48c7-a529-b27c06b0a186",
    description: "Winged Foot Golf Club is one of the defining addresses in American golf, founded in 1921 by members of the New York Athletic Club and opened in 1923 with twin 18-hole A.W. Tillinghast courses on a 280-acre Mamaroneck site, with Clifford Wendehack's Jacobethan Revival clubhouse completed in 1925. The West Course has hosted the U.S. Open six times beginning in 1929 — most recently Bryson DeChambeau's victory in 2020 — and is widely ranked among the ten best courses in the country, a par-72 defined by Tillinghast's Sahara bunkers and small, fiercely contoured greens. Playing Winged Foot West is a genuine examination of every shot in the bag, with virtually no margin for error on its demanding par-4s.",
    yearEstablished: 1921, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/18/11/1653509d050c03f76fe88b22ce4e/38738.jpg", logoUrl: null,
  },
  {
    id: "4b77b4d6-9fb8-47d0-ae11-cff3fb1208a9",
    description: "Woodway Country Club was founded in 1916 by a group of Wee Burn members who selected Willie Park Jr. to design their new course — Walter Travis had declared the Darien farm property one of the finest sites he had ever evaluated for golf. The course opened in 1918 as Connecticut's longest at 6,470 yards, and Mark Mungeam and Roger Rulewich have refined the par-71 at 6,906 yards and a slope of 140, maintaining a course that still plays with the authority of a design made to last. George Duncan, fresh from his 1920 Open Championship victory, proclaimed it the best course on a national tour that included Merion and The Country Club.",
    yearEstablished: 1916, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/f7/cc/4963952385fc61f368495eacea75/112490.jpg", logoUrl: null,
  },
  {
    id: "ec0ca974-d44e-42af-b11f-86dce317bb64",
    description: "Wykagyl Country Club has been called the Cradle of the PGA — it was at a Wykagyl luncheon in January 1916 that Rodman Wanamaker convened the gathering that set the agenda for the PGA's formal organization the following month. The course was designed by Lawrence Van Etten in 1905, with Donald Ross adding holes in 1919 and A.W. Tillinghast reshaping others in the 1930s, producing a par-72 at 6,690 yards with a slope of 138 that carries the fingerprints of three of America's most consequential course designers. It's a private club of exceptional historical depth and genuine architectural interest in New Rochelle.",
    yearEstablished: 1898, courseType: "PRIVATE",
    coverUrl: "https://golf-pass-brightspot.s3.amazonaws.com/47/71/21766d8d72622d9946ea7513009d/100766.jpg", logoUrl: null,
  },
  // Year/type-only updates
  { id: "742d55cc-cb56-4f79-b966-d2db2ce18b4f", description: null, yearEstablished: 1890, courseType: "PRIVATE", coverUrl: null, logoUrl: null }, // The Ridgewood CC (Paramus)
];

async function tryFetch(url) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) { console.log(`    HTTP ${r.status} for ${url.slice(0, 60)}`); return null; }
    const ct = r.headers.get("content-type") || "";
    if (!ct.startsWith("image/") && !ct.includes("svg")) { console.log(`    not image: ${ct}`); return null; }
    return { buffer: Buffer.from(await r.arrayBuffer()), contentType: ct };
  } catch (e) { console.log(`    fetch error: ${e.message}`); return null; }
}

async function upload(courseId, type, url) {
  if (!url) return null;
  console.log(`  fetching ${type}...`);
  const result = await tryFetch(url);
  if (!result) return null;
  const ext = result.contentType.includes("png") ? "png" : result.contentType.includes("svg") ? "svg" : result.contentType.includes("webp") ? "webp" : "jpg";
  const path = `course-images/${courseId}-${type}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, result.buffer, { contentType: result.contentType, upsert: true });
  if (error) { console.log(`  ✗ upload error: ${error.message}`); return null; }
  const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(path);
  console.log(`  ✅ ${type} uploaded`);
  return publicUrl;
}

async function main() {
  const now = new Date().toISOString();

  // Hide duplicates
  console.log("── Hiding duplicates ──");
  for (const id of DUPLICATES) {
    const { error } = await sb.from("Course").update({ isPublic: false }).eq("id", id);
    console.log(error ? `  ✗ ${id}: ${error.message}` : `  ✓ hidden ${id}`);
  }

  // Seed courses
  for (const c of COURSES) {
    const { data: existing } = await sb.from("Course").select("name, description, coverImageUrl, logoUrl, yearEstablished, courseType").eq("id", c.id).single();
    console.log(`\n── ${existing?.name ?? c.id} ──`);

    const update = { updatedAt: now };

    if (!existing?.description && c.description) update.description = c.description;
    if (!existing?.yearEstablished && c.yearEstablished) update.yearEstablished = c.yearEstablished;
    if (!existing?.courseType && c.courseType) update.courseType = c.courseType;

    if (!existing?.coverImageUrl) {
      const url = await upload(c.id, "cover", c.coverUrl);
      if (url) update.coverImageUrl = url;
    } else {
      console.log("  ✓ cover already set");
    }

    if (!existing?.logoUrl && c.logoUrl) {
      const url = await upload(c.id, "logo", c.logoUrl);
      if (url) update.logoUrl = url;
    } else if (existing?.logoUrl) {
      console.log("  ✓ logo already set");
    }

    if (Object.keys(update).length > 1) {
      const { error } = await sb.from("Course").update(update).eq("id", c.id);
      if (error) console.log(`  ✗ DB: ${error.message}`);
      else console.log("  ✅ DB updated");
    } else {
      console.log("  ✓ already complete");
    }
  }

  console.log("\n✅ Done.");
}

main().catch(e => { console.error(e); process.exit(1); });
