"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import { DirectionsButton } from "@/components/DirectionsButton";

type CourseSearchRow = { id: string; name: string; city: string | null; state: string | null; logoUrl: string | null };
type FriendRow = { id: string; username: string; displayName: string | null; avatarUrl: string | null };

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
  // Populated for single-course rounds so we can render a Directions button
  // straight from the round card without navigating into the trip first.
  firstCourseName: string | null;
  firstCourseCity: string | null;
  firstCourseState: string | null;
  firstCourseLat: number | null;
  firstCourseLng: number | null;
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
  const [userId, setUserId] = useState<string | null>(null);

  // Quick Round sheet
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickCourse, setQuickCourse] = useState<CourseSearchRow | null>(null);
  const [quickDate, setQuickDate] = useState("");
  const [quickTime, setQuickTime] = useState("");
  const [quickSearch, setQuickSearch] = useState("");
  const [quickResults, setQuickResults] = useState<CourseSearchRow[]>([]);
  const [quickSaving, setQuickSaving] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Friend-invite state for the Quick Round sheet
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState<FriendRow[]>([]);
  const [invitedFriends, setInvitedFriends] = useState<FriendRow[]>([]);
  const friendDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lock body scroll + size the Quick Round overlay to the visualViewport so
  // iOS Safari's keyboard doesn't push the top of the sheet off-screen when an
  // input is focused near the bottom. dvh alone wasn't enough — the layout
  // viewport doesn't shrink with the keyboard, so the sheet anchored to
  // bottom: 0 had its top scrolled out of view.
  useEffect(() => {
    if (!quickOpen) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width, overflow: body.style.overflow };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    const vv = window.visualViewport;
    const sync = () => {
      const el = document.getElementById("quick-round-overlay");
      if (!el || !vv) return;
      el.style.height = `${vv.height}px`;
      el.style.transform = `translateY(${vv.offsetTop}px)`;
    };
    if (vv) {
      sync();
      vv.addEventListener("resize", sync);
      vv.addEventListener("scroll", sync);
    }

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
      if (vv) {
        vv.removeEventListener("resize", sync);
        vv.removeEventListener("scroll", sync);
      }
    };
  }, [quickOpen]);

  // Debounced friend search — match BOTH username and displayName so "Marc"
  // finds the user whose username is "mzl" but displayName is "Marc". Uses
  // Supabase's .or() with two ilike conditions joined with OR.
  useEffect(() => {
    if (!friendSearch.trim()) { setFriendResults([]); return; }
    if (friendDebounce.current) clearTimeout(friendDebounce.current);
    friendDebounce.current = setTimeout(async () => {
      const supabase = createClient();
      const q = friendSearch.trim();
      const { data } = await supabase
        .from("User")
        .select("id, username, displayName, avatarUrl")
        .or(`username.ilike.%${q}%,displayName.ilike.%${q}%`)
        .limit(8);
      const invitedIds = new Set(invitedFriends.map(f => f.id));
      setFriendResults(((data ?? []) as FriendRow[]).filter(u => !invitedIds.has(u.id) && u.id !== userId));
    }, 220);
  }, [friendSearch, invitedFriends, userId]);

  // Debounced course search for the Quick Round sheet
  useEffect(() => {
    if (!quickSearch.trim() || quickCourse) { setQuickResults([]); return; }
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("Course")
        .select("id, name, city, state, logoUrl")
        .ilike("name", `%${quickSearch.trim()}%`)
        .limit(8);
      setQuickResults((data ?? []) as CourseSearchRow[]);
    }, 220);
  }, [quickSearch, quickCourse]);

  async function submitQuickRound() {
    if (!quickCourse || !quickDate || !userId || quickSaving) return;
    setQuickSaving(true);
    const supabase = createClient();
    const tripId = crypto.randomUUID();
    const now = new Date().toISOString();
    const courseLabel = quickCourse.name;
    const niceDate = new Date(quickDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const tripName = `${courseLabel} — ${niceDate}`;

    await supabase.from("GolfTrip").insert({
      id: tripId,
      name: tripName,
      createdBy: userId,
      startDate: quickDate,
      endDate: quickDate,
      createdAt: now,
      updatedAt: now,
    });
    await supabase.from("GolfTripMember").insert({
      id: crypto.randomUUID(),
      tripId,
      userId,
      role: "owner",
      createdAt: now,
    });
    // NOTE: GolfTripCourse has no updatedAt column in the schema. Sending one
    // makes Postgres reject the insert with a "column does not exist" error,
    // which silently fails (no error check) and leaves the trip with zero
    // courses attached — which then misclassifies the round as a trip on the
    // detail page.
    const { error: tcErr } = await supabase.from("GolfTripCourse").insert({
      id: crypto.randomUUID(),
      tripId,
      courseId: quickCourse.id,
      playDate: quickDate,
      teeTime: quickTime || null,
      sortOrder: 0,
      createdAt: now,
    });
    if (tcErr) {
      // Surface the failure so we never silently strand the user on a course-less trip again.
      console.error("Quick Round: failed to attach course", tcErr);
      alert(`Couldn't save the course on this round: ${tcErr.message}`);
      setQuickSaving(false);
      return;
    }

    // Add invited friends as trip members + send each a notification
    if (invitedFriends.length > 0) {
      await supabase.from("GolfTripMember").insert(
        invitedFriends.map(f => ({
          id: crypto.randomUUID(),
          tripId,
          userId: f.id,
          role: "member",
          createdAt: now,
        }))
      );
      const { data: inviterProfile } = await supabase.from("User").select("displayName, username").eq("id", userId).single();
      const inviterName = inviterProfile?.displayName || inviterProfile?.username || "Someone";
      await supabase.from("Notification").insert(
        invitedFriends.map(f => ({
          id: crypto.randomUUID(),
          userId: f.id,
          type: "trip_invite",
          title: "You've been invited!",
          body: `${inviterName} added you to "${tripName}"`,
          linkUrl: `/trips/${tripId}`,
          read: false,
          createdAt: now,
          updatedAt: now,
        }))
      );
    }

    // +50 pts award (same hook the long-form trip create uses)
    fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_trip", referenceId: tripId }),
    }).catch(() => {});

    setQuickSaving(false);
    setQuickOpen(false);
    setQuickCourse(null);
    setQuickDate("");
    setQuickTime("");
    setQuickSearch("");
    setQuickResults([]);
    setInvitedFriends([]);
    setFriendSearch("");
    setFriendResults([]);
    router.push(`/trips/${tripId}`);
  }

  function handleNewClick() {
    // Future Trips → long-form trip create at /trips. Everything else (rounds + archive) → Quick Round.
    if (tab === "trips") {
      router.push("/trips");
    } else {
      setQuickOpen(true);
    }
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace("/login"); return; }
      const uid = data.user.id;
      setUserId(uid);

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
        const courseInfo = new Map<string, { logoUrl: string | null; holeCount: number | null; name: string | null; city: string | null; state: string | null; latitude: number | null; longitude: number | null }>();
        if (courseIds.length > 0) {
          const { data: courseRows } = await supabase.from("Course").select("id, logoUrl, holeCount, name, city, state, latitude, longitude").in("id", courseIds);
          for (const c of (courseRows ?? []) as any[]) courseInfo.set(c.id, { logoUrl: c.logoUrl, holeCount: c.holeCount, name: c.name, city: c.city, state: c.state, latitude: c.latitude, longitude: c.longitude });
        }
        const today = new Date().toISOString().slice(0, 10);
        built = ((tripRows ?? []) as any[]).map(t => {
          const tcs = (tcByTrip.get(t.id) ?? []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          const totalHoles = tcs.reduce((sum, tc) => {
            const a = courseInfo.get(tc.courseId)?.holeCount ?? 18;
            const b = tc.secondaryCourseId ? (courseInfo.get(tc.secondaryCourseId)?.holeCount ?? 0) : 0;
            return sum + a + b;
          }, 0);
          const firstCourse = tcs.length > 0 ? courseInfo.get(tcs[0].courseId) : null;
          const firstCourseLogo = firstCourse?.logoUrl ?? null;
          const endRef = t.endDate || t.startDate;
          const isPast = !!endRef && endRef < today;
          // Round = exactly one stop (no paired secondary course) on a single day.
          // Strip any time component before comparing dates — Postgres can echo
          // back a date string with a timestamp depending on how the row was
          // touched, and "2026-05-20" !== "2026-05-20T00:00:00" would
          // otherwise misclassify a single-day round as a trip.
          const stripDate = (s: string | null | undefined) => s ? s.slice(0, 10) : "";
          const startD = stripDate(t.startDate);
          const endD = stripDate(t.endDate);
          const isRound = tcs.length === 1
            && !tcs[0]?.secondaryCourseId
            && !!startD && !!endD
            && startD === endD;
          return {
            id: t.id, name: t.name, startDate: t.startDate, endDate: t.endDate, imageUrl: t.imageUrl,
            courseCount: tcs.length, totalHoles,
            memberCount: memberByTrip.get(t.id) ?? 0,
            gameCount: gameByTrip.get(t.id) ?? 0,
            firstCourseLogo,
            firstCourseName: firstCourse?.name ?? null,
            firstCourseCity: firstCourse?.city ?? null,
            firstCourseState: firstCourse?.state ?? null,
            firstCourseLat: firstCourse?.latitude ?? null,
            firstCourseLng: firstCourse?.longitude ?? null,
            isRound, isPast,
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
    <main style={{ background: "#07100a", minHeight: "100dvh", color: "#fff", fontFamily: "'Outfit', sans-serif", paddingBottom: 100 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600;700&display=swap'); * { box-sizing: border-box; }`}</style>

      {/* Header */}
      <div style={{ padding: "12px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>Tee Up</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", marginTop: 2 }}>What you're playing next</div>
        </div>
        <button
          onClick={handleNewClick}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.45)", borderRadius: 99, padding: "6px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#4da862", cursor: "pointer" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {tab === "trips" ? "New Trip" : "New Round"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {([
          { key: "rounds" as const, label: "Upcoming Rounds" },
          { key: "trips" as const, label: "Upcoming Trips" },
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
              ? <EmptyState title="No upcoming rounds" subtitle="Plan a single-day round, add friends, attach a game." ctaLabel="Schedule a round" onCta={() => setQuickOpen(true)} />
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {futureRounds.map(t => <TripCard key={t.id} trip={t} onClick={() => router.push(`/trips/${t.id}`)} />)}
                </div>
          )}
          {tab === "trips" && (
            futureTrips.length === 0
              ? <EmptyState title="No upcoming trips" subtitle="Plan a multi-day buddy trip with multiple courses." ctaLabel="Plan a trip" onCta={() => router.push("/trips")} />
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

      {/* Quick Round sheet — single-course, single-date trip
          The overlay's height + translateY track window.visualViewport so the
          sheet sits inside the visible area on iOS Safari even when the
          keyboard is up. Sheet flex-aligns to the bottom of that container. */}
      {quickOpen && (
        <div id="quick-round-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100dvh", zIndex: 200, display: "flex", flexDirection: "column", willChange: "transform" }} onClick={() => { if (!quickSaving) setQuickOpen(false); }}>
          <div onClick={() => { if (!quickSaving) setQuickOpen(false); }} style={{ flex: 1, background: "rgba(0,0,0,0.6)", minHeight: 40 }} />
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d2318", borderRadius: "20px 20px 0 0", padding: "14px 20px calc(28px + env(safe-area-inset-bottom))", maxHeight: "92%", overflowY: "auto", flexShrink: 0 }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 99, margin: "0 auto 16px" }} />

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)", marginBottom: 2 }}>Quick Round</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>Schedule a Round</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>Pick a course, a day, and friends to play with. Games get added on the round's page.</div>
            </div>

            {/* Course picker */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Course</div>
              {quickCourse ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(77,168,98,0.10)", border: "1px solid rgba(77,168,98,0.35)", borderRadius: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: quickCourse.logoUrl ? "#fff" : "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.25)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {quickCourse.logoUrl
                      ? <img src={quickCourse.logoUrl} alt={quickCourse.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, color: "#4da862" }}>{quickCourse.name.split(" ").filter(w => w.length > 2).map(w => w[0]).slice(0, 3).join("").toUpperCase()}</span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{quickCourse.name}</div>
                    {(quickCourse.city || quickCourse.state) && (
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{[quickCourse.city, quickCourse.state].filter(Boolean).join(", ")}</div>
                    )}
                  </div>
                  <button onClick={() => { setQuickCourse(null); setQuickSearch(""); }} aria-label="Change course" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 99, padding: "5px 11px", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>Change</button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 12px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input
                      value={quickSearch}
                      onChange={e => setQuickSearch(e.target.value)}
                      placeholder="Search a course"
                      spellCheck={false}
                      autoCorrect="off"
                      style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff" }}
                    />
                  </div>
                  {quickResults.length > 0 && (
                    <div style={{ marginTop: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, maxHeight: 240, overflowY: "auto" }}>
                      {quickResults.map(c => (
                        <button key={c.id} onClick={() => { setQuickCourse(c); setQuickSearch(""); setQuickResults([]); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", textAlign: "left" }}>
                          <div style={{ width: 30, height: 30, borderRadius: 7, background: c.logoUrl ? "#fff" : "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.18)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {c.logoUrl
                              ? <img src={c.logoUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 8, fontWeight: 700, color: "#4da862" }}>{c.name.split(" ").filter(w => w.length > 2).map(w => w[0]).slice(0, 3).join("").toUpperCase()}</span>
                            }
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{[c.city, c.state].filter(Boolean).join(", ")}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Date + Tee Time */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Date</div>
                <input type="date" value={quickDate} onChange={e => setQuickDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: quickDate ? "#fff" : "rgba(255,255,255,0.3)", outline: "none", colorScheme: "dark" }} />
              </div>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Tee Time <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opt)</span></div>
                <input type="time" value={quickTime} onChange={e => setQuickTime(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: quickTime ? "#fff" : "rgba(255,255,255,0.3)", outline: "none", colorScheme: "dark" }} />
              </div>
            </div>

            {/* Friends (optional) */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>
                Players <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
              </div>

              {/* Selected friends chips */}
              {invitedFriends.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {invitedFriends.map(f => (
                    <button key={f.id} onClick={() => setInvitedFriends(prev => prev.filter(x => x.id !== f.id))} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.4)", borderRadius: 99, padding: "4px 9px 4px 4px", cursor: "pointer" }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.3)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {f.avatarUrl
                          ? <img src={f.avatarUrl} alt={f.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        }
                      </div>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#4da862" }}>{f.username}</span>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.7)" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  ))}
                </div>
              )}

              {/* Friend search input */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 12px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  value={friendSearch}
                  onChange={e => setFriendSearch(e.target.value)}
                  placeholder="Add friends by username"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="none"
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff" }}
                />
              </div>
              {friendResults.length > 0 && (
                <div style={{ marginTop: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, maxHeight: 200, overflowY: "auto" }}>
                  {friendResults.map(f => (
                    <button key={f.id} onClick={() => { setInvitedFriends(prev => [...prev, f]); setFriendSearch(""); setFriendResults([]); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", textAlign: "left" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.3)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {f.avatarUrl
                          ? <img src={f.avatarUrl} alt={f.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.displayName || f.username}</div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>@{f.username}</div>
                      </div>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "#4da862", letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0 }}>Add</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Invite a friend who's not on Tour It */}
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Don't see your friend?</span>
                <button
                  onClick={() => {
                    const msg = `Join me on Tour It! Sign up at touritgolf.com — we're playing${quickCourse ? ` ${quickCourse.name}` : " a round"}${quickDate ? ` on ${new Date(quickDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}.`;
                    if (typeof navigator !== "undefined" && navigator.share) {
                      navigator.share({ title: "Join me on Tour It", text: msg }).catch(() => {});
                    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
                      navigator.clipboard.writeText(msg).catch(() => {});
                    }
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "rgba(77,168,98,0.85)", letterSpacing: "0.04em" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  Invite to Tour It
                </button>
              </div>
            </div>

            {/* Save */}
            <button
              onClick={submitQuickRound}
              disabled={!quickCourse || !quickDate || quickSaving}
              style={{ width: "100%", background: (!quickCourse || !quickDate || quickSaving) ? "rgba(45,122,66,0.4)" : "#2d7a42", border: "none", borderRadius: 14, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", cursor: (!quickCourse || !quickDate || quickSaving) ? "not-allowed" : "pointer", letterSpacing: "0.02em", boxShadow: (!quickCourse || !quickDate || quickSaving) ? "none" : "0 4px 16px rgba(45,122,66,0.4)" }}
            >
              {quickSaving ? "Saving…" : invitedFriends.length > 0 ? `Schedule Round + Invite ${invitedFriends.length}` : "Schedule Round"}
            </button>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.32)", textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
              Games and accommodations get added on the round's page next.
            </div>
          </div>
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
        {/* Golf ball on a tee — bigger ball, distinct tee */}
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.55)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="9" r="6"/>
          <line x1="9.5" y1="15.5" x2="14.5" y2="15.5"/>
          <path d="M10.5 15.5 L12 21 L13.5 15.5"/>
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
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }} style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "12px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, boxSizing: "border-box" }}>
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
      {trip.isRound && !trip.isPast && trip.firstCourseName && (
        <DirectionsButton course={{ name: trip.firstCourseName, city: trip.firstCourseCity, state: trip.firstCourseState, latitude: trip.firstCourseLat, longitude: trip.firstCourseLng }} />
      )}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
    </div>
  );
}
