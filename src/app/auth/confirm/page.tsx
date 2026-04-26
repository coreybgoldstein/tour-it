"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthConfirmPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token_hash = params.get("token_hash");
    const type = params.get("type") as "recovery" | "signup" | "email" | "magiclink" | null;

    if (!token_hash || !type) {
      router.replace("/login");
      return;
    }

    createClient().auth.verifyOtp({ token_hash, type }).then(({ error }) => {
      if (error) {
        router.replace(type === "recovery" ? "/reset-password?invalid=1" : "/login");
        return;
      }
      router.replace(type === "recovery" ? "/reset-password" : "/");
    });
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.3)", borderTopColor: "#4da862", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Verifying your link...</p>
      </div>
    </main>
  );
}
