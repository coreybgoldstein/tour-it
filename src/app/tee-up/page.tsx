"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type TripRow = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  imageUrl: string | null;
  courseCount: number;
  totalHoles: number;
  memberCount: number;
  gameCount: number;
  firstCourseLogo: string | null;
  isRound: boolean;       // 1 day, 1 course-stop
  isPast: boolean;
};

type RoundRow = {
  id: string;
  courseId: string;
  date: string;
  totalScore: number | null;
  courseName: string;
  courseLogoUrl: string | null;
};

type Tab = "rounds" | "trips" | "archive";

function fmtDateRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const s = new Date(start);
  if (Number.isNaN(s.getTime())) return null;
  const mo = (d: Date) => d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = (d: Date) => d.getUTCDate();
  if (!end || start === end) return `${mo(s)} ${day(s)}`;
  const e = new Date(end);
  if (Number.isNaN(e.getTime())) return `${mo(s)} ${day(s)}`;
  if (mo(s) === mo(e)) return `${mo(s)} ${day(s)}–${day(e)}`;
  return `${mo(s)} ${day(s)} – ${mo(e)} ${day(e)}`;
}

function fmtSingleDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function TeeUpPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [pastRounds, setPastRounds] = useState<RoundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("rounds");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace("/login"); return; }
      const uid = data.user.id;

      // 1) Trip IDs where user is a member
      const { data: memberRows } = await supabase
        .from("GolfTripMember")
        .select("tripId")
        .eq("userId", uid);
      const tripIds = Array.from(new Set((memberRows ?? []).map((r: any) => r.tripId)));

      // 2) Enrich each trip with course/member/game counts
      let built: TripRow[] = [];
      if (tripIds.length > 0) {
        const [{ data: tripRows }, { data: tcRows }, { data: memberCounts }, { data: gameRows }] = await Promise.all([
          supabase.from("GolfTrip").select("id, name, startDate, endDate, imageUrl").in("id", tripIds),
          supabase.from("GolfTripCourse").select("tripId, courseId, secondaryCourseId, sortOrder").in("tripId", tripIds),
          supabase.from("GolfTripMember").select("tripId").in("tripId", tripIds),
          supabase.from("TripGame").select("tripId").in("tripId", tripIds),
        ]);
        const memberByTrip = new Map<string, number>();
        for (const r of (memberCounts ?? []) as any[]) memberByTrip.set(r.tripId, (memberByTrip.get(r.tripId) ?? 0) + 1);
        const gameByTrip = new Map<string, number>();
        for (const r of (gameRows ?? []) as any[]) gameByTrip.set(r.tripId, (gameByTrip.get(r.tripId) ?? 0) + 1);
        const tcByTrip = new Map<string, any[]>();
        for (const r of (tcRows ?? []) as any[]) {
          if (!tcByTrip.has(r.tripId)) tcByTrip.set(r.tripId, []);
          tcByTrip.get(r.tripId)!.push(r);
        }
        const courseIds = Array.from(new Set(((tcRows ?? []) as any[]).flatMap(r => [r.courseId, r.secondaryCourseId]).filter(Boolean)));
        const courseInfo = new Map<string, { logoUrl: string | null; holeCount: number | null }>();
        if (courseIds.length > 0) {
          const { data: courseRows } = await supabase.from("Course").select("id, logoUrl, holeCount").in("id", courseIds);
          for (const c of (courseRows ?? []) as any[]) courseInfo.set(c.id, { logoUrl: c.logoUrl, holeCount: c.holeCount });
        }
        const today = new Date().toISOString().slice(0, 10);
        built = ((tripRows ?? []) as any[]).map(t => {
          const tcs = (tcByTrip.get(t.id) ?? []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          const totalHoles = tcs.reduce((sum, tc) => {
            const a = courseInfo.get(tc.courseId)?.holeCount ?? 18;
            const b = tc.secondaryCourseId ? (courseInfo.get(tc.secondaryCourseId)?.holeCount ?? 0) : 0;
            return sum + a + b;
          }, 0);
          const firstCourseLogo = tcs.length > 0 ? (courseInfo.get(tcs[0].courseId)?.logoUrl ?? null) : null;
          const endRef = t.endDate || t.startDate;
          const isPast = !!endRef && endRef < today;
          const isRound = tcs.length === 1 && t.startDate && t.endDate && t.startDate === t.endDate;
          return {
            id: t.id, name: t.name, startDate: t.startDate, endDate: t.endDate, imageUrl: t.imageUrl,
            courseCount: tcs.length, totalHoles,
            memberCount: memberByTrip.get(t.id) ?? 0,
            gameCount: gameByTrip.get(t.id) ?? 0,
            firstCourseLogo, isRound, isPast,
          };
        });
      }

      // 3) Past logged rounds (from Round table, scored play)
      const { data: roundRows } = await supabase
        .from("Round")
        .select("id, courseId, date, totalScore")
        .eq("userId", uid)
        .order("date", { ascending: false });
      const courseIdsForRounds = Array.from(new Set((roundRows ?? []).map((r: any) => r.courseId)));
      const roundCourses = new Map<string, { name: string; logoUrl: string | null }>();
      if (courseIdsForRounds.length > 0) {
        const { data: cs } = await supabase.from("Course").select("id, name, logoUrl").in("id", courseIdsForRounds);
        for (const c of (cs ?? []) as any[]) roundCourses.set(c.id, { name: c.name, logoUrl: c.logoUrl });
      }
      const rounds: RoundRow[] = (roundRows ?? []).map((r: any) => ({
        id: r.id,
        courseId: r.courseId,
        date: r.date,
        totalScore: r.totalScore,
        courseName: roundCourses.get(r.courseId)?.name ?? "Course",
        courseLogoUrl: roundCourses.get(r.courseId)?.logoUrl ?? null,
      }));

      setTrips(built);
      setPastRounds(rounds);
      setLoading(false);
    });
  }, [router]);

  const futureRounds = trips.filter(t => t.isRound && !t.isPast).sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
  const futureTrips = trips.filter(t => !t.isRound && !t.isPast).sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
  const pastTrips = trips.filter(t => t.isPast).sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));

  const counts: Record<Tab, number> = {
    rounds: futureRounds.length,
    trips: futureTrips.length,
    archive: pastTrips.length + pastRounds.length,
  };

  return (
    <main style={{ background: "#07100a", minHeight: "100vh", color: "#fff", fontFamily: "'Outfit', sans-serif", paddingBottom: 100 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600;700&display=swap'); * { box-sizing: border-box; }`}</style>

      {/* Header */}
      <div style={{ padding: "12px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>Tee Up</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", marginTop: 2 }}>What you're playing next</div>
        </div>
        <button
          onClick={() => router.push("/trips")}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.45)", borderRadius: 99, padding: "6px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#4da862", cursor: "pointer" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {([
          { key: "rounds" as const, label: "Future Rounds" },
          { key: "trips" as const, label: "Future Trips" },
          { key: "archive" as const, label: "Archive" },
        ]).map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{ flex: 1, padding: "12px 4px", background: "none", border: "none", borderBottom: `2px solid ${active ? "#4da862" : "transparent"}`, cursor: "pointer", marginBottom: -1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
            >
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: active ? "#fff" : "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {t.label}
              </span>
              {counts[t.key] > 0 && (
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)", background: active ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)", borderRadius: 10, padding: "1px 6px" }}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Body */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.3)", borderTopColor: "#4da862", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <div style={{ padding: "16px 20px" }}>
          {tab === "rounds" && (
            futureRounds.length === 0
              ? <EmptyState title="No future rounds scheduled" subtitle="Plan a single-day round, add friends, attach a game." ctaLabel="Schedule a round" onCta={() => router.push("/trips")} />
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {futureRounds.map(t => <TripCard key={t.id} trip={t} onClick={() => router.push(`/trips/${t.id}`)} />)}
                </div>
          )}
          {tab === "trips" && (
            futureTrips.length === 0
              ? <EmptyState title="No trips planned" subtitle="Plan a multi-day buddy trip with multiple courses." ctaLabel="Plan a trip" onCta={() => router.push("/trips")} />
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {futureTrips.map(t => <TripCard key={t.id} trip={t} onClick={() => router.push(`/trips/${t.id}`)} />)}
                </div>
          )}
          {tab === "archive" && (
            pastTrips.length === 0 && pastRounds.length === 0
              ? <EmptyState title="Nothing in the archive yet" subtitle="Past trips and logged rounds will appear here." />
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pastTrips.map(t => <TripCard key={t.id} trip={t} onClick={() => router.push(`/trips/${t.id}`)} />)}
                  {pastRounds.map(r => (
                    <button key={r.id} onClick={() => router.push(`/courses/${r.courseId}`)} style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "12px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: r.courseLogoUrl ? "#fff" : "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.2)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {r.courseLogoUrl ? <img src={r.courseLogoUrl} alt={r.courseName} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.6"><path d="M4 21h16M7 21c0-3.5 2.5-6 5-6s5 2.5 5 6M12 15V2M12 2 L19 5 L12 8Z"/></svg>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.courseName}</div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                          {fmtSingleDate(r.date)} {r.totalScore != null && <>· <span style={{ color: "#4da862", fontWeight: 600 }}>{r.totalScore}</span></>}
                        </div>
                      </div>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0 }}>Logged</span>
                    </button>
                  ))}
                </div>
          )}
        </div>
      )}

      <BottomNav />
    </main>
  );
}

function EmptyState({ title, subtitle, ctaLabel, onCta }: { title: string; subtitle: string; ctaLabel?: string; onCta?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "48px 24px", textAlign: "center" }}>
      <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(77,168,98,0.08)", border: "1px solid rgba(77,168,98,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Golf ball on a tee — silhouette */}
        <svg width="26" height="26" viewBox="0 0 24 24" fill="rgba(77,168,98,0.55)">
          <circle cx="12" cy="7" r="5.2"/>
          <path d="M8.2 12.6 H15.8 L14.8 14.4 H9.2 Z"/>
          <path d="M10.6 14.4 L13.4 14.4 L12 22 Z"/>
        </svg>
      </div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{title}</div>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, maxWidth: 260 }}>{subtitle}</div>
      {ctaLabel && onCta && (
        <button onClick={onCta} style={{ marginTop: 6, background: "#2d7a42", border: "none", borderRadius: 12, padding: "11px 22px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

function TripCard({ trip, onClick }: { trip: TripRow; onClick: () => void }) {
  const date = fmtDateRange(trip.startDate, trip.endDate);
  const meta: string[] = [];
  if (trip.courseCount > 0) meta.push(`${trip.courseCount} ${trip.courseCount === 1 ? "course" : "courses"}`);
  if (trip.totalHoles > 0) meta.push(`${trip.totalHoles} holes`);
  if (trip.memberCount > 0) meta.push(`${trip.memberCount} ${trip.memberCount === 1 ? "golfer" : "golfers"}`);
  return (
    <button onClick={onClick} style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "12px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: trip.imageUrl || trip.firstCourseLogo ? "transparent" : "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.2)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {trip.imageUrl
          ? <img src={trip.imageUrl} alt={trip.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : trip.firstCourseLogo
            ? <img src={trip.firstCourseLogo} alt={trip.name} style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "#fff" }} />
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.6"><path d="M4 21h16M7 21c0-3.5 2.5-6 5-6s5 2.5 5 6M12 15V2M12 2 L19 5 L12 8Z"/></svg>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{trip.name}</div>
          {date && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: trip.isPast ? "rgba(255,255,255,0.4)" : "#4da862", flexShrink: 0 }}>{date}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          <span>{meta.join(" · ")}</span>
          {trip.gameCount > 0 && (
            <>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#4da862", fontWeight: 600 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>
                {trip.gameCount} {trip.gameCount === 1 ? "game" : "games"}
              </span>
            </>
          )}
        </div>
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
    </button>
  );
}
