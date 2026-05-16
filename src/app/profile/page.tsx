"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProfileRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      // Preserve query string (e.g. ?notifications=open) when redirecting to
      // the canonical /profile/[userId] route so the panel can open directly.
      const qs = searchParams.toString();
      const suffix = qs ? `?${qs}` : "";
      if (user) router.replace(`/profile/${user.id}${suffix}`);
      else router.replace("/login");
    });
  }, [router, searchParams]);

  return (
    <main style={{ background: "#07100a", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", fontFamily: "'Outfit', sans-serif" }}>Loading...</div>
    </main>
  );
}
