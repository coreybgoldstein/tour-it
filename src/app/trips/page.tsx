"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type Trip = {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  imageUrl: string | null;
};

export default function TripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace("/login"); return; }
      setUserId(data.user.id);

      // Trips where user is a member
      const { data: memberRows } = await supabase
        .from("TripMember")
        .select("tripId")
        .eq("userId", data.user.id);

      const tripIds = (memberRows || []).map((r: any) => r.tripId);
      if (tripIds.length > 0) {
        const { data: tripData } = await supabase
          .from("Trip")
          .select("id, name, description, startDate, endDate, imageUrl")
          .in("id", tripIds)
          .order("startDate", { ascending: false });
        setTrips(tripData || []);
      }
      setLoading(false);
    });
  }, [router]);

  function formatDateRange(start: string | null, end: string | null) {
    if (!start) return null;
    const s = new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!end) return s;
    const e = new Date(end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${s} – ${e}`;
  }

  return (
    <main style={{ minHeight: "100svh", background: "#07100a", color: "#fff", fontFamily: "'Outfit', sans-serif", paddingBottom: 90 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap'); * { box-sizing: border-box; }`}</style>

      {/* Header */}
      <div style={{ padding: "52px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff" }}>My Trips</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Golf trips you're planning or have taken</div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.3)", borderTopColor: "#4da862", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : trips.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 32px", textAlign: "center" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 20 }}>
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>No trips yet</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>Trips let you plan golf outings with friends, track courses, and share clips from the road.</div>
        </div>
      ) : (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {trips.map(trip => (
            <button
              key={trip.id}
              onClick={() => router.push(`/trips/${trip.id}`)}
              style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "16px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
            >
              <div style={{ width: 52, height: 52, borderRadius: 12, background: trip.imageUrl ? "transparent" : "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.2)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {trip.imageUrl
                  ? <img src={trip.imageUrl} alt={trip.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{trip.name}</div>
                {formatDateRange(trip.startDate, trip.endDate) && (
                  <div style={{ fontSize: 12, color: "#4da862", marginTop: 2 }}>{formatDateRange(trip.startDate, trip.endDate)}</div>
                )}
                {trip.description && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{trip.description}</div>
                )}
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          ))}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
