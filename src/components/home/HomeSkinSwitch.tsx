"use client";

import { useEffect, useState } from "react";
import HomeClassic from "@/components/home/HomeClassic";
import HomeClassicEditorial from "@/components/home/HomeClassicEditorial";

// Temporary A/B switch between the live "classic" home and the new
// "editorial" aesthetic (sharp corners, flat #4da862 buttons, bracketed
// labels, grain). One of the two will be deleted once Corey picks.
//
// Resolution order:
//   1. URL ?skin=classic | ?skin=editorial  → flips instantly, no
//      redeploy, and persists to localStorage for the session.
//   2. localStorage "homeSkin"               → sticky after a manual flip.
//   3. NEXT_PUBLIC_HOME_AESTHETIC=classic    → makes classic the default
//      before a deploy (permanent revert lever).
//   4. default                               → editorial (the new look).
type Skin = "classic" | "editorial";

const envDefault: Skin =
  process.env.NEXT_PUBLIC_HOME_AESTHETIC === "classic" ? "classic" : "editorial";

export default function HomeSkinSwitch() {
  // Start from the build-time default so SSR + first client render agree
  // (no hydration mismatch); a URL/localStorage override is applied on
  // mount and swaps the variant client-side.
  const [skin, setSkin] = useState<Skin>(envDefault);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("skin");
    if (q === "classic" || q === "editorial") {
      localStorage.setItem("homeSkin", q);
      setSkin(q);
      return;
    }
    const stored = localStorage.getItem("homeSkin");
    if (stored === "classic" || stored === "editorial") setSkin(stored);
  }, []);

  return skin === "classic" ? <HomeClassic /> : <HomeClassicEditorial />;
}
