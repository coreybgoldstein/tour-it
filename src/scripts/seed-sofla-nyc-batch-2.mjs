// Phase 2 SoFla + NYC batch — intel-only (no photos).
// Each course already has par + yardage + handicap rank in the DB; this
// script writes the missing hole descriptions (the strategic "what to do
// on this hole" intel that lives in the Intel panel on the clip card).
//
// Courses in this batch:
//   1. Birchwood Country Club   (Westport, CT) — Corey plays here 5/22
//   2. Boca Grove               (Boca Raton, FL) — Corey's home course
//   3. Bethpage Black           (Bethpage, NY)   — Tillinghast 1936, US Open / PGA / Ryder Cup venue
//   4. Winged Foot Golf Club    (Mamaroneck, NY) — Tillinghast 1923, multiple US Opens
//
// All scorecard data confirmed against the live DB rows; intel keyed off
// each hole's actual yardage / par / handicap rank so the advice is
// specific, not generic.
//
// Photos skipped this pass for the same reason as the Boca G&RC seed —
// no curated attribution-clean hole gallery available for these courses
// without manual sourcing. Future pass can add photos.
//
// Usage: node src/scripts/seed-sofla-nyc-batch-2.mjs

import "dotenv/config";
import { seedCourseImagery } from "./lib/seed-course-imagery.mjs";

// ─────────────────────────────────────────────────────────────────────────
// 1. BIRCHWOOD COUNTRY CLUB — Westport, CT (id: c467b374-0019-416b-ad55-5d258e7a4fd1)
//    9-hole routing played twice. Par 36 each nine, 72 total, 5,694 yards
//    composite. Holes 1-9 and 10-18 share yardages (same holes, second loop).
// ─────────────────────────────────────────────────────────────────────────
const BIRCHWOOD_ID = "c467b374-0019-416b-ad55-5d258e7a4fd1";
const BIRCHWOOD_HOLES = [
  { holeNumber: 1,  description: "399-yard opener (HC 11). Standard mid-length par 4 to get the round started. Fairway is the priority — give yourself a clean look at the green and settle into the day's rhythm." },
  { holeNumber: 2,  description: "537-yard par 5, third-hardest hole on the course (HC 3). Most won't reach in two — focus on putting your layup in wedge range. The green's modest size means spin matters on the approach." },
  { holeNumber: 3,  description: "Short 349-yard par 4 (HC 13). Position over power — driver isn't necessary if you can hit a 220-yard fairway club. A wedge approach from the short grass is the smart play." },
  { holeNumber: 4,  description: "165-yard par 3 (HC 17 — easiest hole on the course). Short iron for most. Don't get cute with pin hunting; center of the green leaves a makeable look." },
  { holeNumber: 5,  description: "396 yards (HC 9). Standard mid-length par 4. Fairway hit puts a 9-iron or wedge in your hand. Watch where the trouble lives off the tee — bail out, not hero." },
  { holeNumber: 6,  description: "413-yard par 4 — the hardest hole at Birchwood (HC 1). Long enough that a missed fairway turns it into a real card-wrecker. Driver, swing easy, find the short grass at any cost." },
  { holeNumber: 7,  description: "194-yard par 3 (HC 15). Long iron or hybrid for most. The longest par 3 here — take enough club and aim center. Don't leave it short." },
  { holeNumber: 8,  description: "383 yards (HC 7). Mid-length par 4. The approach is where the hole is won — a controlled mid-iron beats a wedge from the rough." },
  { holeNumber: 9,  description: "499-yard par 5, reachable for big hitters (HC 5). Birdie chance — keep the tee shot in play and the green opens up in two. Closing the front under par is the goal." },
  // Back nine = same 9 holes, second loop. Intel mostly mirrors but adjusts for "now you know" awareness.
  { holeNumber: 10, description: "399 yards (HC 6) — same hole as #1, second loop. You've seen the line now; commit. Driver to the fairway, mid-iron to center." },
  { holeNumber: 11, description: "537-yard par 5 (HC 14) — same hole as #2. Easier handicap rank this time because you know what's coming. Position the layup for the wedge that matters." },
  { holeNumber: 12, description: "349-yard par 4 (HC 12) — same hole as #3. Short par 4. A controlled fairway club + wedge is the higher-percentage play than driver + flip." },
  { holeNumber: 13, description: "165-yard par 3 (HC 18 — easiest on the back). Same hole as #4. Short iron, center of green, walk to the next tee." },
  { holeNumber: 14, description: "396 yards (HC 2 — second-hardest on the course on the back nine). Same hole as #5 but the pressure's different now. Stay aggressive, keep the ball in front of you." },
  { holeNumber: 15, description: "413 yards (HC 10) — same hole as #6. The HC drops because you've already paid your dues here. Driver, find the fairway, smart approach." },
  { holeNumber: 16, description: "194-yard par 3 (HC 16) — same hole as #7. Long iron. Aim center, take a smart number, walk off with par." },
  { holeNumber: 17, description: "383 yards (HC 8) — same hole as #8. Penultimate hole. Don't get clever with the line — fairway, then green, then putt." },
  { holeNumber: 18, description: "499-yard par 5 (HC 4) — same hole as #9. Closing hole on the round. Reachable for big hitters — take the chance if the lie and wind are right; this is your last birdie window." },
];

// ─────────────────────────────────────────────────────────────────────────
// 2. BOCA GROVE — Boca Raton, FL (id: 3a15e7df-e7f6-49ce-8038-e08296cedb7b)
//    Private CC, par 72, 6,469y. Joe Lee design opened 1983. Corey's home
//    course (per his profile pills — 8.1 HC, home course Boca Grove).
// ─────────────────────────────────────────────────────────────────────────
const BOCA_GROVE_ID = "3a15e7df-e7f6-49ce-8038-e08296cedb7b";
const BOCA_GROVE_HOLES = [
  { holeNumber: 1,  description: "Short 354-yard opener (HC 13). Driver isn't required — a fairway club to the corner sets up a wedge. Ease into the round; the harder holes come later." },
  { holeNumber: 2,  description: "517-yard par 5 (HC 5). Reachable for big hitters but the trouble lining the second-shot zone makes a calculated layup the smarter play more often than not." },
  { holeNumber: 3,  description: "Short 173-yard par 3 (HC 15). Wedge to mid-iron for most. Pick a number, commit to the swing, take what the pin gives you." },
  { holeNumber: 4,  description: "439-yard par 4 — the hardest hole at Boca Grove (HC 1). The course's longest two-shotter. Driver into the fairway is non-negotiable; the approach is a mid-iron at minimum." },
  { holeNumber: 5,  description: "Short 351-yard par 4 (HC 9). Birdie chance — position the tee shot for a flat wedge lie and attack." },
  { holeNumber: 6,  description: "353-yard par 4 (HC 17 — easiest par 4 on the course). The 'breather' between the gauntlet of #4 and the par 5 ahead. Take advantage." },
  { holeNumber: 7,  description: "576-yard par 5 — the longest hole on the course (HC 7). Three-shotter for nearly everyone. Patience and position win this hole; aggressive tee shots get punished." },
  { holeNumber: 8,  description: "Long 243-yard par 3 (HC 11). The bear of a par 3 — practically a par 3.5. Hybrid or fairway wood for most. Don't fight it; aim for the front of the green and putt up." },
  { holeNumber: 9,  description: "418-yard par 4 (HC 3 — third-hardest on the course). Long two-shotter to close the front. Driver, swing easy, mid-iron approach." },
  { holeNumber: 10, description: "376-yard par 4 (HC 4) opens the back. Mid-length but the HC is honest — the approach defends. Fairway-finder off the tee, then take what the pin gives." },
  { holeNumber: 11, description: "401-yard par 4 (HC 12). Standard mid-back-nine par 4 — the kind of hole where pars feel like quiet wins. Position, position, position." },
  { holeNumber: 12, description: "507-yard par 5 (HC 6). Reachable for big hitters. The risk/reward second shot is where the hole is won or lost — know your number, commit." },
  { holeNumber: 13, description: "208-yard par 3 (HC 14). Long iron for most. The longer of the back-nine par 3s — take more club than your gut says when the wind kicks." },
  { holeNumber: 14, description: "377-yard par 4 (HC 2 — second-hardest on the course). Don't let the modest yardage fool you; the approach is the test. Smart miss is short, not long." },
  { holeNumber: 15, description: "Short 174-yard par 3 (HC 18 — easiest hole at Boca Grove). Mid-iron or short iron. Pick a number, take what the pin gives you, walk off with par or better." },
  { holeNumber: 16, description: "Short 318-yard par 4 (HC 16). Drivable for big hitters with the right wind. Otherwise a controlled fairway club + wedge is the higher-percentage play." },
  { holeNumber: 17, description: "533-yard par 5 (HC 8). Three-shotter for most, reachable for the long-and-straight. Sets up the closing hole — don't bleed strokes here." },
  { holeNumber: 18, description: "358-yard finishing par 4 (HC 10). Short enough that a clean tee shot sets up wedge to the home green. Make a number, shake hands, head to the clubhouse." },
];

// ─────────────────────────────────────────────────────────────────────────
// 3. BETHPAGE BLACK — Bethpage, NY (id: ceb95a05-d039-4f2d-ae01-6bdd954d00c1)
//    A.W. Tillinghast 1936. Famous warning sign at the first tee:
//    "The Black Course is an extremely difficult course which we recommend
//    only for highly skilled golfers." US Open 2002, 2009. PGA Champ 2019.
//    Ryder Cup 2025. Par 71, 7,468y from the tips.
// ─────────────────────────────────────────────────────────────────────────
const BETHPAGE_BLACK_ID = "ceb95a05-d039-4f2d-ae01-6bdd954d00c1";
const BETHPAGE_BLACK_HOLES = [
  { holeNumber: 1,  description: "430-yard opener (HC 8). The hole drops off the elevated first tee — one of the most photographed tee shots in public golf. Aim down the fairway slope; the green is back uphill." },
  { holeNumber: 2,  description: "389-yard par 4 (HC 16). The 'easy' hole here is still a Tillinghast par 4. Bunkers right, trees left — find the fairway and a mid-iron approach to a defended green." },
  { holeNumber: 3,  description: "230-yard par 3 (HC 18 ranked easy, plays HARD). Long iron or hybrid to a deep, narrow green guarded by deep bunkers. The intimidating opening par 3 the muni is known for." },
  { holeNumber: 4,  description: "517-yard par 5 (HC 2 — second-hardest on the course). Tillinghast called it 'one of the most exacting three-shotters I know of anywhere.' Cross-bunker complex — the legendary 'Glacier Bunker' — angles across the fairway. Position over power." },
  { holeNumber: 5,  description: "478-yard par 4 (HC 4). Long two-shotter playing uphill. Driver to the corner; a long iron in. Bunkers and tilt protect a green that doesn't accept anything but a confident strike." },
  { holeNumber: 6,  description: "408-yard par 4 (HC 10). The closest thing to a 'short' par 4 on the front. Fairway is the priority — the green has serious slope and the bunkers around it punish missed shots." },
  { holeNumber: 7,  description: "553-yard par 5 (HC 6). Reachable in two for elite players but most should treat it as a three-shotter. The 'leave-it' miss off the tee is right — left is dead." },
  { holeNumber: 8,  description: "210-yard par 3 (HC 14). Long iron to a perched green protected by sand on all sides. One of three par 3s over 200 — bring the lower-lofted clubs." },
  { holeNumber: 9,  description: "460-yard par 4 (HC 12). The longest closing front-nine par 4. Driver mandatory; the approach is a long iron into a smaller green than it looks. Bail-out is right." },
  { holeNumber: 10, description: "502-yard par 4 (HC 9). One of the longest par 4s in championship golf — plays every inch of 500. Driver, fairway wood, putt is a realistic line for most amateurs." },
  { holeNumber: 11, description: "435-yard par 4 (HC 11). Bunkers right and a green tilted away from you. Aim left side of the fairway, leave a full mid-iron rather than the half-shot from the right rough." },
  { holeNumber: 12, description: "501-yard par 4 (HC 7). Another monster two-shotter. The course's defining stretch — 10/11/12 are three par 4s averaging 480 yards. Survival is the play." },
  { holeNumber: 13, description: "608-yard par 5 (HC 3). The course's longest hole. Three-shotter for everybody. Position the layup so you have a full wedge; the green has plenty of tilt to send misses off." },
  { holeNumber: 14, description: "158-yard par 3 (HC 17). The shortest hole on the course — finally a breather. Short iron to a green ringed by deep bunkers. Don't get fancy; center of green." },
  { holeNumber: 15, description: "478-yard par 4 (HC 1 — hardest hole at Bethpage Black). Uphill, bunkers everywhere, a green that rejects everything but the perfect strike. Make bogey and move on." },
  { holeNumber: 16, description: "490-yard par 4 (HC 5). The penultimate par 4 in the brutal closing stretch. By now you're tired; the hole isn't. Find the fairway, take an extra club into the green." },
  { holeNumber: 17, description: "207-yard par 3 (HC 13). The last par 3, and a brute. Long iron over Tillinghast bunkers to a perched green. Center is fine — pin chasing here is how good rounds turn into bogeys." },
  { holeNumber: 18, description: "411-yard finishing par 4 (HC 15). Uphill all the way home to the iconic clubhouse. Driver to the fairway, mid-iron up the hill, take in the view. Make your number and tip the starter." },
];

// ─────────────────────────────────────────────────────────────────────────
// 4. WINGED FOOT GOLF CLUB (West Course) — Mamaroneck, NY (id: 17354ad2-8cf4-48c7-a529-b27c06b0a186)
//    A.W. Tillinghast 1923; Gil Hanse restoration 2017-2018. Hosted six US
//    Opens — most recently 2020 (DeChambeau). Returns 2028. Par 72, 7,477y.
// ─────────────────────────────────────────────────────────────────────────
const WINGED_FOOT_ID = "17354ad2-8cf4-48c7-a529-b27c06b0a186";
const WINGED_FOOT_HOLES = [
  { holeNumber: 1,  description: "451-yard opening par 4 (HC 3 — third-hardest on the course). Tillinghast doesn't ease you in. The green has a famous trough that snakes through its middle — pin location dictates where to land it." },
  { holeNumber: 2,  description: "475-yard par 4 (HC 9). 'Pinnacle' — when Billy Casper won the '59 US Open here he intentionally laid up short all four rounds to avoid the severe green. That's the hole." },
  { holeNumber: 3,  description: "243-yard par 3 (HC 11). The course's longest par 3 — hybrid or fairway wood for most. Tillinghast bunkers ring a green that doesn't accept anything but a precise strike." },
  { holeNumber: 4,  description: "461-yard par 4 (HC 7). Long two-shotter into one of the most contoured greens on the West. Position the tee shot to leave a clean mid-iron — short of the trouble is fine." },
  { holeNumber: 5,  description: "516-yard par 5 (HC 5). The only short par 5 on the course (and the easier of the two). Reachable for elite players; for most a layup + wedge is the smarter percentage play." },
  { holeNumber: 6,  description: "Short 321-yard par 4 (HC 13). The course's drivable hole. Risk/reward: bunker complex in driver range, but a perfect tee shot leaves a tap-in eagle look. Most should play short iron + wedge." },
  { holeNumber: 7,  description: "Short 167-yard par 3 (HC 17 — easiest hole at Winged Foot West). Wedge to short iron. Pick a number and trust it; the green is small but the trouble isn't extreme." },
  { holeNumber: 8,  description: "493-yard par 4 (HC 1 — hardest hole on the course). Long, uphill, demanding. Driver, long iron, pray. Even the pros average over par here." },
  { holeNumber: 9,  description: "572-yard par 5 (HC 15). Long but reachable for big hitters. The famous Tillinghast par 3 came one hole earlier — this is the closing-front par 5 in the original routing. Take what's given." },
  { holeNumber: 10, description: "194-yard par 3 (HC 14). Ben Hogan called it 'a 3-iron into some guy's bedroom.' The most recognizable par 3 here — the green is perched on a landform and protected by deep Tillinghast bunkers." },
  { holeNumber: 11, description: "Short 384-yard par 4 (HC 12). A 'breather' on the back — only by Winged Foot standards. Position the tee shot, wedge in, putt smart. The green still has plenty of slope." },
  { holeNumber: 12, description: "633-yard par 5 (HC 6) — by far the longest hole on the course. A genuine three-shotter for everybody. Patience wins; trying to get there in two is how cards go sideways." },
  { holeNumber: 13, description: "219-yard par 3 (HC 16). Long iron over Tillinghast bunkers to another perched green. Standard formula: take enough club, aim center, putt up." },
  { holeNumber: 14, description: "452-yard par 4 (HC 10). Mid-back-nine two-shotter. By now you know the rhythm — driver to the short grass, mid-iron to a green that's bigger in pictures than in person." },
  { holeNumber: 15, description: "426-yard par 4 (HC 4). The course's penultimate scoring test. Driver in play, long approach, smart miss is short and right. Don't let it go long." },
  { holeNumber: 16, description: "490-yard par 5 (HC 18 — easiest hole on the back). The shortest par 5 on the course. Reachable for nearly everyone — birdie chance before the closing two two-shotters." },
  { holeNumber: 17, description: "469-yard par 4 (HC 2 — second-hardest on the course). The hole that broke fields in the 2006 and 2020 US Opens. Driver, long approach, fingers crossed. Bogey here is a good number." },
  { holeNumber: 18, description: "460-yard finishing par 4 (HC 8). Uphill to the famous clubhouse. Driver to the corner, mid-to-long iron home. The 18th green at Winged Foot has decided championships — walk it like you mean it." },
];

async function main() {
  console.log("\n🏌️  Phase 2 batch — SoFla + NYC intel seeding");
  console.log("===============================================");

  const courses = [
    { name: "Birchwood Country Club (Westport CT)", id: BIRCHWOOD_ID, holes: BIRCHWOOD_HOLES },
    { name: "Boca Grove (Boca Raton FL)",           id: BOCA_GROVE_ID, holes: BOCA_GROVE_HOLES },
    { name: "Bethpage Black (Bethpage NY)",         id: BETHPAGE_BLACK_ID, holes: BETHPAGE_BLACK_HOLES },
    { name: "Winged Foot Golf Club (Mamaroneck NY)", id: WINGED_FOOT_ID, holes: WINGED_FOOT_HOLES },
  ];

  for (const c of courses) {
    console.log(`\n→ ${c.name}`);
    await seedCourseImagery({ courseId: c.id, holes: c.holes });
  }

  console.log("\n✅ All four courses seeded.\n");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
