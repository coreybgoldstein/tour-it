"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingReset() {
  const router = useRouter();

  useEffect(() => {
    // Clear all flags that gate the onboarding flow
    localStorage.removeItem("tour-it-onboarded");
    localStorage.removeItem("tour-it-splash-date");
    router.replace("/onboarding/intro");
  }, [router]);

  return (
    <main style={{ background: "#07100a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, fontFamily: "'Outfit', sans-serif" }}>Resetting…</div>
    </main>
  );
}
