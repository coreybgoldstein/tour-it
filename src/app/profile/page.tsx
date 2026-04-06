"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(`/profile/${user.id}`);
      else router.replace("/login");
    });
  }, [router]);

  return (
    <main style={{ background: "#07100a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", fontFamily: "'Outfit', sans-serif" }}>Loading...</div>
    </main>
  );
}
