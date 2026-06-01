// Home dispatcher. Two completely separate home-screen implementations
// live side by side; this file picks one based on NEXT_PUBLIC_HOME_MODE.
//
// - unset / "tour" (default): Concept A — the Tour-loop home in
//   src/components/home/HomeTour.tsx (hero next-course, group + tee
//   time, scout-and-game action row, Where-to-next rail, Feed tease).
// - "classic": the classic feed home preserved at
//   src/components/home/HomeClassic.tsx — the 2700-line vertical feed
//   page that shipped through beta.
//
// Revert is one Vercel env-var change + redeploy: set
// NEXT_PUBLIC_HOME_MODE=classic and the next deploy returns to the
// classic feed home. No code edits required.

import HomeSkinSwitch from "@/components/home/HomeSkinSwitch";

export default function Page() {
  // Both home modes now route through the skin switch, which picks the
  // base layout (tour vs classic) and then the aesthetic on top of it.
  // Flip the look with ?skin=original | ?skin=editorial (see HomeSkinSwitch).
  const mode =
    process.env.NEXT_PUBLIC_HOME_MODE === "classic" ? "classic" : "tour";
  return <HomeSkinSwitch mode={mode} />;
}
