// Home dispatcher. Two completely separate home-screen implementations
// live side by side; this file picks one based on NEXT_PUBLIC_NEW_HOME.
//
// - "1" (default for now): Concept A — the Tour-loop home in
//   src/components/home/HomeTour.tsx (hero next-course, group + tee
//   time, scout-and-game action row, Where-to-next rail, Feed tease).
// - anything else: the classic feed home preserved at
//   src/components/home/HomeClassic.tsx — the 2700-line vertical
//   feed page that shipped through beta.
//
// Flip back is one Vercel env-var change + redeploy. No code edits
// required if the Tour-loop version misses.

import HomeTour from "@/components/home/HomeTour";
import HomeClassic from "@/components/home/HomeClassic";

export default function Page() {
  if (process.env.NEXT_PUBLIC_NEW_HOME === "1") {
    return <HomeTour />;
  }
  return <HomeClassic />;
}
