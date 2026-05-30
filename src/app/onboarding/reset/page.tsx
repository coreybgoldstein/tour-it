"use client";

/**
 * /onboarding/reset — dev convenience route to walk the new-user
 * journey without creating a throwaway account each time.
 *
 * Clears the gating bits that mark you as "onboarded" + the
 * localStorage flags that suppress the welcome / push prompts, then
 * routes you to the new identity screen so you experience the flow
 * as a brand-new user would.
 *
 * IMPORTANT: this wipes username + firstName + avatarUrl on the
 * currently-signed-in User row. Don't run this on a real account
 * you care about — @mentions, comment attributions, and profile
 * surfaces all depend on those fields. Bookmark this with a
 * dedicated test account.
 *
 * Two-step UI: lands on a confirmation screen with a big red CTA,
 * THEN executes on tap. Direct hits don't auto-wipe anything.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Step = "checking" | "no-session" | "confirm" | "resetting" | "done";

export default function OnboardingReset() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("checking");
  const [user, setUser] = useState<{ id: string; email: string | null; username: string | null; displayName: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setStep("no-session");
        return;
      }
      const { data: profile } = await supabase
        .from("User")
        .select("username, displayName")
        .eq("id", data.user.id)
        .maybeSingle();
      setUser({
        id: data.user.id,
        email: data.user.email ?? null,
        username: profile?.username ?? null,
        displayName: profile?.displayName ?? null,
      });
      setStep("confirm");
    });
  }, []);

  async function doReset() {
    if (!user) return;
    setStep("resetting");
    setError(null);
    const supabase = createClient();

    // Clear the User row fields that drive "already onboarded" + the
    // surfaced identity. Leaving email + id intact so the same auth
    // session keeps working.
    const { error: updErr } = await supabase
      .from("User")
      .update({
        username: null,
        firstName: null,
        lastName: null,
        displayName: null,
        avatarUrl: null,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (updErr) {
      setError(`Couldn't reset User row: ${updErr.message}`);
      setStep("confirm");
      return;
    }

    // Reset progression so the "first earn moment" reveal fires again.
    // Don't delete the row — the broadcast subscription expects it to
    // exist; just zero everything out.
    await supabase
      .from("UserProgression")
      .update({ totalPoints: 0, level: 1, rank: "ROOKIE", streakWeeks: 0, updatedAt: new Date().toISOString() })
      .eq("userId", user.id);

    // Clear every localStorage flag that gates the new-user surfaces.
    try {
      localStorage.removeItem("tour-it-onboarded");
      localStorage.removeItem("tour-it-splash-date");
      localStorage.removeItem("tour-it-push-prompt-dismissed");
      localStorage.removeItem("tour-it-may-modal-seen");
      localStorage.removeItem("tour-it-feed-hint");
      localStorage.removeItem("tour-it-app-download-banner-dismissed");
      // New flags introduced 2026-05-25 in the v3 onboarding rewrite.
      localStorage.removeItem("tour-it-intro-seen");
      localStorage.removeItem("tour-it-explore-home-course-dismissed");
      localStorage.removeItem("tour-it-complete-profile-dismissed");
      localStorage.removeItem("tour-it-first-earn-seen");
    } catch {}

    setStep("done");
    // Tiny pause so the "done" state can render before the redirect
    // (otherwise the route flashes through invisibly).
    setTimeout(() => router.replace("/onboarding/intro"), 700);
  }

  return (
    <main style={pageStyle}>
      <style>{``}</style>

      <div style={{ maxWidth: 440, margin: "0 auto", padding: "32px 20px", display: "flex", flexDirection: "column", minHeight: "100svh" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32, paddingTop: 32 }}>
          <img src="/tour-it-logo-full.png" alt="Tour It" style={{ height: 36, width: "auto" }} />
        </div>

        {step === "checking" && (
          <div style={centerBlock}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Loading…</div>
          </div>
        )}

        {step === "no-session" && (
          <div style={centerBlock}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 10, textAlign: "center" }}>
              Sign in first
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
              This route resets onboarding for the currently signed-in account. Sign in with a test account, then come back to this URL.
            </div>
            <button onClick={() => router.push("/login?next=/onboarding/reset")} style={primaryBtn}>Sign in</button>
          </div>
        )}

        {step === "confirm" && user && (
          <div style={centerBlock}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#f87171", marginBottom: 12, textAlign: "center" }}>
              Dev tool · destructive
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 10, textAlign: "center", lineHeight: 1.2 }}>
              Re-run the new-user journey
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.55)", textAlign: "center", marginBottom: 24, lineHeight: 1.55 }}>
              Clears username, name, avatar, and progression on{" "}
              <strong style={{ color: "#fff" }}>{user.email}</strong>{" "}
              {user.username && <>(<strong style={{ color: "#fff" }}>@{user.username}</strong>)</>} and drops you back at the identity screen.
              Use a dedicated test account — this wipes your profile.
            </div>

            <div style={{ background: "rgba(200,60,60,0.08)", border: "1px solid rgba(200,60,60,0.25)", borderRadius: 12, padding: "12px 14px", marginBottom: 20 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#f87171", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>What gets wiped</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.65 }}>
                <li>User.username, firstName, lastName, displayName, avatarUrl</li>
                <li>UserProgression (totalPoints → 0, level → 1, rank → ROOKIE)</li>
                <li>localStorage flags (welcome, splash, push prompt, etc.)</li>
              </ul>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 8, lineHeight: 1.5 }}>
                Untouched: your auth session, email, uploaded clips, comments, follows.
              </div>
            </div>

            <button onClick={doReset} style={dangerBtn}>Reset and walk the flow</button>
            <button onClick={() => router.push("/")} style={cancelBtn}>Cancel</button>

            {error && (
              <div style={{ marginTop: 14, background: "rgba(200,60,60,0.12)", border: "1px solid rgba(200,60,60,0.3)", borderRadius: 10, padding: "10px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,120,120,0.9)" }}>
                {error}
              </div>
            )}
          </div>
        )}

        {step === "resetting" && (
          <div style={centerBlock}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Resetting…</div>
          </div>
        )}

        {step === "done" && (
          <div style={centerBlock}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", textAlign: "center" }}>Wiped</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 6 }}>Taking you back to the start…</div>
          </div>
        )}
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100svh",
  background: "linear-gradient(180deg, #07100a 0%, #0d2318 100%)",
  color: "#fff",
  fontFamily: "'Outfit', sans-serif",
};

const centerBlock: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "center",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  background: "#2d7a42",
  border: "none",
  borderRadius: 14,
  padding: "16px",
  fontFamily: "'Outfit', sans-serif",
  fontSize: 15,
  fontWeight: 700,
  color: "#fff",
  cursor: "pointer",
  boxShadow: "0 4px 16px rgba(45,122,66,0.4)",
};

const dangerBtn: React.CSSProperties = {
  width: "100%",
  background: "#c54141",
  border: "none",
  borderRadius: 14,
  padding: "16px",
  fontFamily: "'Outfit', sans-serif",
  fontSize: 15,
  fontWeight: 700,
  color: "#fff",
  cursor: "pointer",
  marginBottom: 10,
  boxShadow: "0 4px 16px rgba(197,65,65,0.32)",
};

const cancelBtn: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 14,
  padding: "13px",
  fontFamily: "'Outfit', sans-serif",
  fontSize: 14,
  fontWeight: 600,
  color: "rgba(255,255,255,0.6)",
  cursor: "pointer",
};
