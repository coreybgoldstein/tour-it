// PGA Championship 2026 feature — anchors Aronimink Golf Club to the top of
// the Tour It home feed and decorates the card during tournament week.
//
// To add a future major, copy this file. Each tournament needs:
//   - the Course.id in our DB
//   - the start/end dates (start of day on `start`, end of day on `end`)
//   - the tournament label + short date range pill text

export type FeaturedTournament = {
  courseId: string;
  label: string;        // "PGA Championship"
  yearLabel: string;    // "2026"
  datesPill: string;    // "MAY 14–17"
  logoSrc: string;      // /public path to the tournament logo
};

const PGA_2026: FeaturedTournament & { start: Date; end: Date } = {
  courseId: "bef620c6-48f3-456e-a1c4-7d096303bb34", // Aronimink Golf Club, Newtown Township PA
  label: "PGA Championship",
  yearLabel: "2026",
  datesPill: "MAY 14–17",
  logoSrc: "/pga-aronimink-2026.png", // optional asset; card falls back to a text badge if missing
  start: new Date("2026-05-12T00:00:00-04:00"), // ramps up tournament week (Mon)
  end:   new Date("2026-05-17T23:59:59-04:00"), // through Sunday final round
};

const TOURNAMENTS = [PGA_2026];

export function activeFeaturedTournament(now: Date = new Date()): FeaturedTournament | null {
  for (const t of TOURNAMENTS) {
    if (now >= t.start && now <= t.end) {
      const { start: _s, end: _e, ...rest } = t;
      return rest;
    }
  }
  return null;
}
