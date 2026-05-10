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

  async function handleSave() {
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

      showToast("Trip saved — find it in your Trips tab");
    } catch (e: any) {
      console.error("Save trip failed", e);
      showToast(`Couldn't save trip: ${e?.message ?? "unknown error"}`);
    } finally {
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
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "transparent",
            color: "#4da862",
            border: "1px solid rgba(77,168,98,0.6)",
            borderRadius: 12,
            fontFamily: "'Outfit', sans-serif",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Save Trip"}
        </button>

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
