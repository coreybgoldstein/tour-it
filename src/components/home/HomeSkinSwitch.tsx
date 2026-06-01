"use client";

import { useEffect, useState } from "react";
import HomeTour from "@/components/home/HomeTour";
import HomeTourEditorial from "@/components/home/HomeTourEditorial";
import HomeClassic from "@/components/home/HomeClassic";
import HomeClassicEditorial from "@/components/home/HomeClassicEditorial";

// Temporary A/B switch between the live home and a new "editorial"
// aesthetic (sharp corners, flat #4da862 buttons, bracketed/tracked
// labels, film grain). One of each pair is deleted once Corey picks.
//
// `mode` is the BASE layout chosen by NEXT_PUBLIC_HOME_MODE in the
// dispatcher: "tour" (the live default) or "classic" (revert path).
// `skin` is the aesthetic applied on top of that layout.
//
// Skin resolution order:
//   1. URL ?skin=original | ?skin=editorial → flips instantly, no
//      redeploy, persists to localStorage for the session.
//   2. localStorage "homeSkin"               → sticky after a manual flip.
//   3. NEXT_PUBLIC_HOME_AESTHETIC=original    → makes original the default
//      before a deploy (permanent revert lever).
//   4. default                                → editorial (the new look).
type Skin = "original" | "editorial";

const envDefault: Skin =
  process.env.NEXT_PUBLIC_HOME_AESTHETIC === "original" ? "original" : "editorial";

export default function HomeSkinSwitch({ mode }: { mode: "tour" | "classic" }) {
  // Start from the build-time default so SSR + first client render agree
  // (no hydration mismatch); a URL/localStorage override is applied on
  // mount and swaps the variant client-side.
  const [skin, setSkin] = useState<Skin>(envDefault);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("skin");
    if (q === "original" || q === "editorial") {
      localStorage.setItem("homeSkin", q);
      setSkin(q);
      return;
    }
    const stored = localStorage.getItem("homeSkin");
    if (stored === "original" || stored === "editorial") setSkin(stored);
  }, []);

  if (skin === "editorial") {
    return mode === "classic" ? <HomeClassicEditorial /> : <HomeTourEditorial />;
  }
  return mode === "classic" ? <HomeClassic /> : <HomeTour />;
}
