"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Stop = { courseId: string | undefined; sortOrder: number };

type Props = {
  itinerary: {
    id: string;
    slug: string;
    name: string;
    tagline: string;
    durationDays: number;
    costBand: string;
    heroImageUrl: string | null;
    stops: Stop[];
  };
  budgetRange: string | null;
  siteUrl: string;
  isAuthenticated: boolean;
};

export default function ActionZone({ itinerary, budgetRange, siteUrl, isAuthenticated }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const shareUrl = `${siteUrl}/trip-ideas/${itinerary.slug}?utm_source=share&utm_medium=native_share&utm_campaign=dart_trip`;
  const shareText = [
    `${itinerary.name} 👀`,
    "",
    `${itinerary.durationDays} days — ${itinerary.tagline}`,
    budgetRange ? `~${budgetRange} per person` : null,
    "",
    "who's in?",
    "",
    shareUrl,
  ].filter(Boolean).join("\n");

  async function handleShare() {
    const payload = { title: itinerary.name, text: shareText };
    // Web Share API: present on iOS Safari + most mobile browsers, often missing on desktop
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share(payload);
        return;
      } catch (e: any) {
        // User cancelled — silent
        if (e?.name === "AbortError") return;
      }
    }
    // Fallback: clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      showToast("Copied to clipboard — paste it in the group chat");
    } catch {
      showToast("Couldn't copy automatically. Long-press to copy manually.");
    }
  }

  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleStartPlanning() {
    if (!isAuthenticated) {
      router.push(`/login?next=${encodeURIComponent(`/trip-ideas/${itinerary.slug}`)}`);
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(`/trip-ideas/${itinerary.slug}`)}`);
        return;
      }

      const tripId = crypto.randomUUID();
      const now = new Date().toISOString();

      const { error: tripErr } = await supabase.from("GolfTrip").insert({
        id: tripId,
        name: itinerary.name,
        description: itinerary.tagline,
        imageUrl: itinerary.heroImageUrl,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      });
      if (tripErr) throw tripErr;

      const { error: memberErr } = await supabase.from("GolfTripMember").insert({
        id: crypto.randomUUID(),
        tripId,
        userId: user.id,
        role: "owner",
        createdAt: now,
      });
      if (memberErr) throw memberErr;

      const stopRows = itinerary.stops
        .filter((s) => !!s.courseId)
        .map((s) => ({
          id: crypto.randomUUID(),
          tripId,
          courseId: s.courseId!,
          sortOrder: s.sortOrder,
          createdAt: now,
        }));
      if (stopRows.length) {
        const { error: courseErr } = await supabase.from("GolfTripCourse").insert(stopRows);
        if (courseErr) throw courseErr;
      }

      // +50 pts for creating a trip from a curated itinerary
      fetch("/api/points/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_trip", referenceId: tripId }),
      }).catch(() => {});

      // Route into the new trip with ?welcome=1 so the trip page
      // can fire the post-creation onboarding sheet (dates, members,
      // notes). The trip lives in the user's Tee Up "Trips" tab
      // permanently from here on.
      router.push(`/trips/${tripId}?welcome=1`);
    } catch (e: any) {
      console.error("Start Planning failed", e);
      showToast(`Couldn't start planning: ${e?.message ?? "unknown error"}`);
      setSaving(false);
    }
  }

  function handleThrowAgain() {
    router.push("/map?dart=true");
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          left: 0, right: 0, bottom: 0,
          padding: "12px 16px",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          background: "linear-gradient(to top, rgba(7,16,10,0.97) 70%, rgba(7,16,10,0))",
          zIndex: 80,
          display: "flex", flexDirection: "column", gap: 8,
        }}
      >
        {toast && (
          <div style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 12.5,
            color: "#fff",
            background: "rgba(45,122,66,0.95)",
            border: "1px solid rgba(77,168,98,0.4)",
            padding: "9px 14px",
            borderRadius: 10,
            textAlign: "center",
          }}>{toast}</div>
        )}

        <button
          onClick={handleShare}
          style={{
            width: "100%",
            padding: "13px 16px",
            background: "#2d7a42",
            color: "#fff",
            border: "1px solid #4da862",
            borderRadius: 12,
            fontFamily: "'Outfit', sans-serif",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            letterSpacing: "0.02em",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          Send to Group Chat
        </button>

        <button
          onClick={() => setConfirmOpen(true)}
          disabled={saving}
          style={{
            width: "100%",
            padding: "13px 16px",
            background: "linear-gradient(135deg, #2d7a42 0%, #4da862 100%)",
            color: "#fff",
            border: "1px solid rgba(77,168,98,0.7)",
            borderRadius: 12,
            fontFamily: "'Outfit', sans-serif",
            fontSize: 14,
            fontWeight: 700,
            cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            letterSpacing: "0.02em",
            boxShadow: "0 4px 16px rgba(45,122,66,0.35)",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 21h16M12 15V2"/>
          </svg>
          {saving ? "Building your trip…" : "Start Planning"}
        </button>

        {/* Confirmation sheet — sets expectations before we drop them
            into the real trip. "We'll spin up a baseline with these
            courses, then ask the rest." */}
        {confirmOpen && (
          <>
            <div onClick={() => !saving && setConfirmOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 200 }} />
            <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 201, background: "#0d2318", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "20px 22px calc(28px + env(safe-area-inset-bottom))", borderTop: "1px solid rgba(77,168,98,0.3)", boxShadow: "0 -8px 32px rgba(0,0,0,0.4)" }}>
              <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 99, margin: "0 auto 18px" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21h16M12 15V2"/></svg>
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", lineHeight: 1.15 }}>
                  Let&apos;s build {itinerary.name}
                </div>
              </div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: 18 }}>
                We&apos;ll spin up a baseline trip with the recommended courses already attached. Then we&apos;ll ask you about dates, who&apos;s coming, and the rest — and the trip lives in your Tee Up tab from here on.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={handleStartPlanning}
                  disabled={saving}
                  style={{
                    width: "100%",
                    padding: "13px",
                    background: "linear-gradient(135deg, #2d7a42 0%, #4da862 100%)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 12,
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: saving ? "wait" : "pointer",
                    boxShadow: "0 4px 16px rgba(45,122,66,0.35)",
                  }}
                >
                  {saving ? "Building…" : "Let's go"}
                </button>
                <button
                  onClick={() => setConfirmOpen(false)}
                  disabled={saving}
                  style={{
                    width: "100%",
                    padding: "11px",
                    background: "transparent",
                    color: "rgba(255,255,255,0.5)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Not yet
                </button>
              </div>
            </div>
          </>
        )}

        {/* BOOK_TEE_TIMES_AFFILIATE — Phase 6 */}
        {/* BOOK_STAY_AFFILIATE — Phase 6 */}

        <button
          onClick={handleThrowAgain}
          style={{
            width: "100%",
            padding: "10px 16px",
            background: "transparent",
            color: "rgba(255,255,255,0.65)",
            border: "none",
            fontFamily: "'Outfit', sans-serif",
            fontSize: 12.5,
            fontWeight: 500,
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          Throw Again
        </button>
      </div>
    </>
  );
}
