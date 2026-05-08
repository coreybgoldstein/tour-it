"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerPush } from "@/lib/registerPush";
import { Suspense } from "react";

function NotificationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/?welcome=1";

  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Parse course name from next param for personalised CTA
  const isCourseDest = next.startsWith("/courses/");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
    });
  }, [router]);

  async function handleAllow() {
    if (!userId || loading) return;
    setLoading(true);
    await registerPush(userId);
    fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enable_notifications" }),
    }).catch(() => {});
    router.push(next);
  }

  return (
    <main style={{ minHeight: "100svh", background: "#07100a", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 28px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        {/* Bell icon */}
        <div style={{ width: 88, height: 88, borderRadius: "50%", background: "rgba(77,168,98,0.1)", border: "1.5px solid rgba(77,168,98,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 32px" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>

        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 900, lineHeight: 1.2, marginBottom: 14 }}>
          Stay in the loop
        </div>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 32 }}>
          Get notified when someone likes your clips, follows you, or when you hit a milestone. Turn these off any time.
        </div>

        {/* Points nudge */}
        <div style={{ background: "rgba(77,168,98,0.08)", border: "1px solid rgba(77,168,98,0.2)", borderRadius: 12, padding: "14px 16px", marginBottom: 28, textAlign: "left" }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#4da862", marginBottom: 8, letterSpacing: "0.04em" }}>⚡ Points you&apos;re picking up today</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { label: "Signed up", pts: 50 },
              { label: "Completed your profile", pts: 25 },
              { label: "Turn on notifications", pts: 10 },
            ].map(({ label, pts }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{label}</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#4da862" }}>+{pts} pts</div>
              </div>
            ))}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: 4, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Total today</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff" }}>+85 pts</div>
            </div>
          </div>
        </div>

        <button
          onClick={handleAllow}
          disabled={loading}
          style={{ width: "100%", padding: "15px", borderRadius: 14, background: loading ? "rgba(45,122,66,0.4)" : "#2d7a42", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff", cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 2px 16px rgba(45,122,66,0.35)", marginBottom: 12 }}
        >
          {loading ? "Setting up..." : "Turn on notifications — +10 pts"}
        </button>
        <button
          onClick={() => router.push(next)}
          style={{ width: "100%", padding: "13px", background: "none", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", cursor: "pointer" }}
        >
          {isCourseDest ? "Skip — take me to my home course" : "Maybe later"}
        </button>
      </div>
    </main>
  );
}

export default function OnboardingNotificationsPage() {
  return (
    <Suspense>
      <NotificationsContent />
    </Suspense>
  );
}
