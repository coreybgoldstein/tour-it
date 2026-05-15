// Seed Boca Raton Golf & Racquet Club (Boca Raton, FL — public muni, par 72).
// Course exists in DB at id 74ca1ea2-2550-4c22-89d7-cc522f170393 with par +
// handicap rank already populated, missing yardages + intel. Yardages here
// come from the Black (back) tees per 18Birdies' current published
// scorecard — total 6,714 / par 72 / rating 73.2 / slope 148.
//
// Note: there's a second duplicate Course row (9502af16-…) with no holes /
// uploads / rounds — orphan from a prior import. Cleanup task later; not
// touched by this script.
//
// Photo coverage: SKIPPED on this run. The muni course doesn't have a
// curated, attribution-clean hole-by-hole gallery the way Sleepy Hollow had
// via geekedongolf.com. The course already has a cover + logo in the DB, so
// the surface looks complete; intel descriptions carry the round-prep value.
// Future pass: if user uploads + tags hole photos, those'll populate
// naturally. Or a follow-up script can attempt photo sourcing.
//
// Usage: node src/scripts/seed-boca-grc.mjs

import "dotenv/config";
import { seedCourseImagery } from "./lib/seed-course-imagery.mjs";

const COURSE_ID = "74ca1ea2-2550-4c22-89d7-cc522f170393";

const HOLES = [
  // FRONT 9 — par 36, 3,364y
  { holeNumber: 1,  yardage: 318, description: "Soft 318-yard opener (handicap 15). Driver isn't necessary — a fairway club to the corner sets up a wedge in. Use the first hole to settle into the round, not to make a number." },
  { holeNumber: 2,  yardage: 568, description: "568-yard par 5 — the hardest hole on the course (HC 1). Three-shotter for most. Position over distance off the tee; a 230-yard layup that finds the short grass beats a 280-yard miss." },
  { holeNumber: 3,  yardage: 375, description: "Mid-length par 4 at 375. Watch the wind crossing through here off the back of the property — it can subtly push your ball offline both off the tee and on the approach." },
  { holeNumber: 4,  yardage: 385, description: "Standard mid-length par 4. HC 11 underrates the difficulty — long approach to a defended green. Take an extra club if the wind's against." },
  { holeNumber: 5,  yardage: 184, description: "184-yard par 3 — mid-iron for most. Center of the green is the smart play; the pin location is what determines whether to flag-hunt or take the fat part." },
  { holeNumber: 6,  yardage: 561, description: "Second par 5 on the front at 561 yards (HC 3). Driver, fairway wood, wedge for big hitters; otherwise three solid shots. Staying in play matters more than the extra 20 off the tee." },
  { holeNumber: 7,  yardage: 408, description: "Long par 4 at 408 (HC 5) — the longest two-shotter on the front. A solid tee shot leaves a mid-iron approach over real trouble. Miss it long, you'll be fine; miss short, you won't." },
  { holeNumber: 8,  yardage: 192, description: "192-yard par 3. The 'easy' HC 17 ranking is a setup — long iron over palms and sand isn't a gimme. Take enough club." },
  { holeNumber: 9,  yardage: 373, description: "Birdie-able finishing hole on the front at 373. Position the tee shot so you have a flat lie for the wedge in — the green's small enough that spin matters." },

  // BACK 9 — par 36, 3,350y
  { holeNumber: 10, yardage: 394, description: "394-yard opener on the back. Mid-length two-shotter to start. Settle in, hit the fairway, give yourself a clean look at the green — momentum coming out of the turn matters." },
  { holeNumber: 11, yardage: 431, description: "Longest par 4 on the course at 431 (HC 4). Driver mandatory for most. The approach is the test — long iron or hybrid into a green that doesn't release; favor short over long." },
  { holeNumber: 12, yardage: 368, description: "Friendlier mid-back-nine par 4 at 368 (HC 14). Your scoring opportunity on the back nine — wedge approach if you keep it in the short grass." },
  { holeNumber: 13, yardage: 163, description: "Easiest hole on the course (HC 18) — 163-yard par 3. Short iron or wedge for most. Just commit to a number and make a smart swing; don't waste the freebie." },
  { holeNumber: 14, yardage: 514, description: "Reachable par 5 at 514 for big hitters. Risk/reward second shot — fairway wood at a tucked pin can be the play if the lie and wind cooperate; otherwise lay up to a comfortable wedge." },
  { holeNumber: 15, yardage: 388, description: "Mid-back-nine 388-yard par 4. Left misses get punished here. Commit to a target on the right half of the fairway off the tee." },
  { holeNumber: 16, yardage: 383, description: "Standard par 4 at 383. The course is asking harder questions as you approach the finish — keep the ball in front of you." },
  { holeNumber: 17, yardage: 193, description: "Final par 3 at 193. Long iron over trouble. Don't leave it short — center-back is the smart miss with most pin positions." },
  { holeNumber: 18, yardage: 516, description: "Closing par 5 at 516 (HC 2 — second-hardest on the course). Three-shotter with everything between you and the green meaningful. Make it count: bogey here costs you the round." },
];

const TOTAL_PAR = 72;
const TOTAL_YARDS = HOLES.reduce((s, h) => s + h.yardage, 0);

async function main() {
  console.log(`\n🏌️  Seeding Boca Raton Golf & Racquet Club intel + yardages`);
  console.log(`   Par ${TOTAL_PAR} · ${TOTAL_YARDS} yards (Black tees) · 18 holes\n`);

  await seedCourseImagery({
    courseId: COURSE_ID,
    courseDescription: "Boca Raton's public muni — par 72 over 6,714 yards from the tips with a 73.2 rating and 148 slope. Mature Florida layout: water in play on 14 of 18, generous fairways framed by palmettos, and Bermuda greens that get firm fast in the South Florida heat. The city's invested over $7M in course + clubhouse upgrades, and tee times go fast on weekends — book early.",
    holes: HOLES,
  });

  console.log("\n✅ Done.\n");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
