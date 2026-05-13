// Bayonne Golf Club (Bayonne, NJ) — modern links design by Eric Bergstol
// built on a reclaimed waste dump, opened 2006. Cavalier tour 2019/07.

import { seedCourseImagery } from "./lib/seed-course-imagery.mjs";
const gog = (p) => `https://i0.wp.com/geekedongolf.com/wp-content/uploads/${p}`;

await seedCourseImagery({
  courseId: "16a07e12-a20a-4d2d-a0cd-37d3f59723c6",
  courseDescription: "Eric Bergstol's audacious 2006 links built on a reclaimed Hudson River landfill, with Manhattan as the most spectacular skyline backdrop in American golf. Pure links character — firm, windy, ground-game-friendly — three miles from Wall Street.",
  courseYear: 2006,
  holes: [
    { holeNumber: 1, imageUrl: gog("2019/07/Bayonne1-Tee.jpg"),     description: "Opening par 4 with the Statue of Liberty over your shoulder. Wide fairway; the green slopes toward the wind line." },
    { holeNumber: 2, imageUrl: gog("2019/07/Bayonne2-TeeZoom.jpg"), description: "Long par 4. Position over distance — the fairway funnels toward fescue down the right." },
    { holeNumber: 3, imageUrl: gog("2019/07/Bayonne3-Tee.jpg"),     description: "Par 3 with the Hudson behind. Pick your number and trust it; the wind is rarely calm here." },
    { holeNumber: 4, imageUrl: gog("2019/07/Bayonne4-TeeZoom.jpg"), description: "Bergstol's bold use of mounding shapes the entire hole. Aim at the windmill marker; the green is partly hidden from the fairway." },
    { holeNumber: 5, imageUrl: gog("2019/07/Bayonne5-Tee.jpg"),     description: "Short par 4 — reachable in the right wind. The defenders are the deep links bunkers, not the length." },
    { holeNumber: 6, imageUrl: gog("2019/07/Bayonne6-TeeZoom.jpg"), description: "Mid-length par 4 with significant elevation change. The green sits down in a hollow; play one less club than the yardage suggests." },
    { holeNumber: 7, imageUrl: gog("2019/07/Bayonne7-TeeZoom.jpg"), description: "Par 5 along the water. Two great shots can put you on; lay up to a comfortable wedge if not." },
    { holeNumber: 8, imageUrl: gog("2019/07/Bayonne8-TeeZoom.jpg"), description: "Par 3 with a brutal angle from the back tees. Take more club than you think." },
    { holeNumber: 9, imageUrl: gog("2019/07/Bayonne9-TeeZoom.jpg"), description: "Long par 4 closing the front. The fairway is bigger than it looks from the tee; commit to the line." },
    { holeNumber: 10, imageUrl: gog("2019/07/Bayonne10-TeeZoom.jpg"), description: "Par 4 starting the back. Skyline of NYC dead ahead — try not to get distracted." },
    { holeNumber: 11, imageUrl: gog("2019/07/Bayonne11-Tee.jpg"),    description: "Par 3 with bunkers wrapping the front. Center pin is always the play; long is a guaranteed bogey." },
    { holeNumber: 12, imageUrl: gog("2019/07/Bayonne12-Tee.jpg"),    description: "Reachable par 5 — chance to make a move. The fairway humps and rolls; pick your line carefully." },
    { holeNumber: 13, imageUrl: gog("2019/07/Bayonne13-Tee.jpg"),    description: "Short par 4 with risk-reward potential. Driver in close brings out-of-bounds; safe play leaves a wedge." },
    { holeNumber: 14, imageUrl: gog("2019/07/Bayonne14-Tee.jpg"),    description: "Long par 4 — one of the toughest holes on the course. Position over power; the green has multiple levels." },
    { holeNumber: 15, imageUrl: gog("2019/07/Bayonne15-TeeZoom.jpg"), description: "Par 3 with the water as backdrop. Wind off the harbor swings the ball; take the club, swing easy." },
    { holeNumber: 16, imageUrl: gog("2019/07/Bayonne16-Tee.jpg"),    description: "Par 4 climbing back toward the clubhouse. The cross bunker forces a decision off the tee." },
    { holeNumber: 17, imageUrl: gog("2019/07/Bayonne17-TeeZoom.jpg"), description: "Short par 4 with a deceptive green. Position the drive; the approach plays one club longer than it looks." },
    { holeNumber: 18, imageUrl: gog("2019/07/Bayonne18-Tee.jpg"),    description: "Closing par 5 along the water. Reachable for the bombers; pick your number on the layup and finish strong." },
  ],
});
