"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type SavedCourse = {
  id: string;
  courseId: string;
  saveType: "PLAYED" | "BUCKET_LIST";
  course: {
    id: string;
    name: string;
    city: string;
    state: string;
    uploadCount: number;
    logoUrl: string | null;
  };
};

type Trip = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  createdBy: string;
  imageUrl: string | null;
  courseCount: number;
  memberCount: number;
  role: string;
};

export default function ListsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"BUCKET_LIST" | "PLAYED" | "TRIPS">("BUCKET_LIST");
  const [saves, setSaves] = useState<SavedCourse[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      // Load saves
      const { data: savesData } = await supabase
        .from("Save")
        .select("id, courseId, saveType")
        .eq("userId", user.id)
        .not("courseId", "is", null);

      if (savesData && savesData.length > 0) {
        const courseIds = savesData.map((s: any) => s.courseId);
        const { data: coursesData } = await supabase
          .from("Course")
          .select("id, name, city, state, uploadCount, logoUrl")
          .in("id", courseIds);

        setSaves(savesData.map((s: any) => ({
          ...s,
          course: coursesData?.find((c: any) => c.id === s.courseId) || { id: s.courseId, name: "Unknown", city: "", state: "", uploadCount: 0, logoUrl: null },
        })));
      }

      // Load trips (where user is a member)
      const { data: memberData } = await supabase
        .from("GolfTripMember")
        .select("tripId, role")
        .eq("userId", user.id);

      if (memberData && memberData.length > 0) {
        const tripIds = memberData.map((m: any) => m.tripId);
        const { data: tripsData } = await supabase
          .from("GolfTrip")
          .select("id, name, startDate, endDate, createdBy, imageUrl")
          .in("id", tripIds)
          .order("createdAt", { ascending: false });

        if (tripsData) {
          // Get course + member counts for each trip
          const [{ data: tcData }, { data: tmData }] = await Promise.all([
            supabase.from("GolfTripCourse").select("tripId").in("tripId", tripIds),
            supabase.from("GolfTripMember").select("tripId").in("tripId", tripIds),
          ]);

          const roleMap = new Map(memberData.map((m: any) => [m.tripId, m.role]));
          const courseCountMap = new Map<string, number>();
          const memberCountMap = new Map<string, number>();
          (tcData || []).forEach((tc: any) => courseCountMap.set(tc.tripId, (courseCountMap.get(tc.tripId) || 0) + 1));
          (tmData || []).forEach((tm: any) => memberCountMap.set(tm.tripId, (memberCountMap.get(tm.tripId) || 0) + 1));

          setTrips(tripsData.map((t: any) => ({
            ...t,
            courseCount: courseCountMap.get(t.id) || 0,
            memberCount: memberCountMap.get(t.id) || 0,
            role: roleMap.get(t.id) || "member",
          })));
        }
      }

      setLoading(false);
    }

    load();
  }, [router]);

  const bucketList = saves.filter(s => s.saveType === "BUCKET_LIST");
  const played = saves.filter(s => s.saveType === "PLAYED");

  const formatDate = (d: string | null) => {
    if (!d) return "";
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff", fontFamily: "'Outfit', sans-serif", paddingBottom: 100 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; }
        .list-card { display: flex; align-items: center; gap: 14px; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: background 0.15s; }
        .list-card:active { background: rgba(255,255,255,0.03); }
        .list-card:last-child { border-bottom: none; }
        .trip-card { padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: background 0.15s; }
        .trip-card:active { background: rgba(255,255,255,0.03); }
        .trip-card:last-child { border-bottom: none; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "56px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 4 }}>My Lists</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
          {bucketList.length} bucket list · {played.length} played · {trips.length} {trips.length === 1 ? "trip" : "trips"}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", padding: "12px 20px", gap: 8 }}>
        <button
          onClick={() => setTab("BUCKET_LIST")}
          style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: tab === "BUCKET_LIST" ? "rgba(77,168,98,0.18)" : "rgba(255,255,255,0.05)", color: tab === "BUCKET_LIST" ? "#4da862" : "rgba(255,255,255,0.45)" }}
        >
          ⛳ Bucket List {bucketList.length > 0 && <span style={{ fontSize: 10, fontWeight: 400 }}>({bucketList.length})</span>}
        </button>
        <button
          onClick={() => setTab("PLAYED")}
          style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: tab === "PLAYED" ? "rgba(77,168,98,0.18)" : "rgba(255,255,255,0.05)", color: tab === "PLAYED" ? "#4da862" : "rgba(255,255,255,0.45)" }}
        >
          ✓ Played {played.length > 0 && <span style={{ fontSize: 10, fontWeight: 400 }}>({played.length})</span>}
        </button>
        <button
          onClick={() => setTab("TRIPS")}
          style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: tab === "TRIPS" ? "rgba(77,168,98,0.18)" : "rgba(255,255,255,0.05)", color: tab === "TRIPS" ? "#4da862" : "rgba(255,255,255,0.45)" }}
        >
          ✈️ Trips {trips.length > 0 && <span style={{ fontSize: 10, fontWeight: 400 }}>({trips.length})</span>}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>Loading...</div>
      ) : tab === "TRIPS" ? (
        trips.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✈️</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 8 }}>No golf trips yet</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, marginBottom: 28 }}>
              Find a course you want to play and add it to a Golf Trip.
            </div>
            <button onClick={() => router.push("/search")} style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "12px 28px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
              Browse courses
            </button>
          </div>
        ) : (
          <div style={{ padding: "4px 0" }}>
            {trips.map(trip => (
              <div key={trip.id} className="trip-card" onClick={() => router.push(`/trips/${trip.id}`)}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  {/* Trip avatar */}
                  <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, overflow: "hidden", background: "linear-gradient(135deg, rgba(77,168,98,0.25), rgba(45,122,66,0.15))", border: "1px solid rgba(77,168,98,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {trip.imageUrl
                      ? <img src={trip.imageUrl} alt={trip.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#4da862" }}>{trip.name.split(" ").filter((w: string) => w.length > 0).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{trip.name}</div>
                      {(trip.role === "owner" || trip.createdBy) && (
                        <span style={{ fontSize: 9, fontWeight: 600, color: "#4da862", background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.25)", borderRadius: 99, padding: "1px 6px", flexShrink: 0 }}>Owner</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
                      {trip.startDate && formatDate(trip.startDate)}{trip.startDate && trip.endDate ? " → " : ""}{trip.endDate && formatDate(trip.endDate)}
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>⛳ {trip.courseCount} {trip.courseCount === 1 ? "course" : "courses"}</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>👤 {trip.memberCount} {trip.memberCount === 1 ? "golfer" : "golfers"}</span>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="m9 18 6-6-6-6"/></svg>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        (() => {
          const current = tab === "BUCKET_LIST" ? bucketList : played;
          return current.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>{tab === "BUCKET_LIST" ? "⛳" : "🏌️"}</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 8 }}>
                {tab === "BUCKET_LIST" ? "No bucket list courses yet" : "No courses marked as played"}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, marginBottom: 28 }}>
                {tab === "BUCKET_LIST" ? "Find a course you want to play and save it to your bucket list." : "Mark courses you've played while browsing them."}
              </div>
              <button onClick={() => router.push("/search")} style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "12px 28px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>Browse courses</button>
            </div>
          ) : (
            <div style={{ padding: "4px 0" }}>
              {current.map(s => (
                <div key={s.id} className="list-card" onClick={() => router.push(`/courses/${s.course.id}`)}>
                  <div style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0, overflow: "hidden", background: tab === "BUCKET_LIST" ? "linear-gradient(135deg,#1a3d4d,#2d5a7a)" : "linear-gradient(135deg,#1a4d22,#2d7a42)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
                    {s.course.logoUrl
                      ? <img src={s.course.logoUrl} alt={s.course.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : s.course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase()
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.course.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                      {s.course.city}, {s.course.state}
                      {s.course.uploadCount > 0 && <span style={{ color: "#4da862", marginLeft: 8 }}>{s.course.uploadCount} clips</span>}
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
                </div>
              ))}
            </div>
          );
        })()
      )}

      <BottomNav />
    </main>
  );
}
