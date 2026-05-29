"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import { DirectionsButton } from "@/components/DirectionsButton";
import CreateGameSheet from "@/components/CreateGameSheet";
import Toast, { type ToastState } from "@/components/Toast";
import { sendPushToUser } from "@/lib/sendPush";
import { gameFormatLabel } from "@/lib/gameFormats";
import { cdnImage } from "@/lib/cdnImage";
import AirportField from "@/components/AirportField";
import LodgingField from "@/components/LodgingField";

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
  // Members shown as stacked avatars on the card — same shape as TripGame
  // `players` so the same row component renders both.
  members: { userId: string; displayName: string; avatarUrl: string | null }[];
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

// Three top-level tabs. Each tab manages its own archive view via the
// per-tab archiveView state (one boolean per tab). "Games" is new in
// 2026-05-24 — surfaces active games + an empty-state Play-a-Game
// wizard that creates a one-day round + game in a single flow.
type Tab = "games" | "rounds" | "trips";

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

// iOS WKWebView renders <input type="date"> and <input type="time"> with
// native controls whose width is decided by the OS, not by our CSS — empty
// time inputs collapse to a small pill that doesn't fill the container,
// and on some iOS versions the picker chip overflows its grid cell. We
// stack an invisible native input on top of a visible custom-styled div
// that we control completely. Tapping the area still opens the iOS picker
// (the input is hit-target-sized), but the visual is consistent across
// platforms regardless of empty/filled state.
function DateField({ value, onChange, min, max }: { value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  const display = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Select date";
  return (
    <div style={{ position: "relative", width: "100%", height: 44 }}>
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "0 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: value ? "#fff" : "rgba(255,255,255,0.42)" }}>
        {display}
      </div>
      <input type="date" value={value} min={min} max={max} onChange={e => onChange(e.target.value)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, border: 0, padding: 0, margin: 0, cursor: "pointer", background: "transparent", colorScheme: "dark" }} />
    </div>
  );
}

function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const display = value
    ? (() => {
        const [h, m] = value.split(":").map(Number);
        const period = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, "0")} ${period}`;
      })()
    : "Tee time";
  return (
    <div style={{ position: "relative", width: "100%", height: 44 }}>
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "0 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: value ? "#fff" : "rgba(255,255,255,0.42)" }}>
        {display}
      </div>
      <input type="time" value={value} onChange={e => onChange(e.target.value)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, border: 0, padding: 0, margin: 0, cursor: "pointer", background: "transparent", colorScheme: "dark" }} />
    </div>
  );
}

export default function TeeUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [pastRounds, setPastRounds] = useState<RoundRow[]>([]);
  // Games tab data — TripGame rows for trips the current user is in,
  // joined with course logo + trip date for the card display.
  type GameRow = {
    id: string;
    tripId: string;
    courseId: string;
    courseName: string;
    courseLogoUrl: string | null;
    format: string;
    formatConfig: { winner?: string | null; winners?: Record<string, string> } | null;
    players: { userId: string; displayName: string; avatarUrl: string | null }[] | null;
    tripDate: string | null;
    tripName: string | null;
    tripIsPast: boolean;
    isArchived: boolean; // a "winner" field on formatConfig means the user declared a result
  };
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("games");
  // Per-tab "show archive" toggle. Lets users flip between active
  // items and historical items WITHIN a tab instead of bouncing to a
  // separate top-level Archive tab. Defaults closed.
  const [archiveOpen, setArchiveOpen] = useState<Record<Tab, boolean>>({
    games: false,
    rounds: false,
    trips: false,
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [userHandicap, setUserHandicap] = useState<number | null>(null);
  // Current user's avatar — used by the Play-a-Game wizard's Step 3
  // host row so "You" actually shows YOUR face, not a generic icon.
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);

  // Quick Round sheet
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickCourse, setQuickCourse] = useState<CourseSearchRow | null>(null);
  const [quickDate, setQuickDate] = useState("");
  const [quickTime, setQuickTime] = useState("");
  const [quickSearch, setQuickSearch] = useState("");
  const [quickResults, setQuickResults] = useState<CourseSearchRow[]>([]);
  const [quickSaving, setQuickSaving] = useState(false);
  // Inline toast for non-blocking errors/successes — replaces native alert().
  const [toast, setToast] = useState<ToastState>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Friend-invite state for the Quick Round sheet
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState<FriendRow[]>([]);
  const [invitedFriends, setInvitedFriends] = useState<FriendRow[]>([]);
  const friendDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New Trip sheet — separate from Quick Round. Trips are multi-day with
  // no course attached at creation time; the user adds courses on the
  // trip detail page after creation.
  const [newTripOpen, setNewTripOpen] = useState(false);
  const [newTripName, setNewTripName] = useState("");
  const [newTripStart, setNewTripStart] = useState("");
  const [newTripEnd, setNewTripEnd] = useState("");
  // Logistics — captured up-front so the trip page renders something
  // useful before stops are added, and so public conversion has real
  // detail to broadcast.
  const [newTripAirport, setNewTripAirport] = useState("");
  const [newTripLodging, setNewTripLodging] = useState("");
  // Structured city/state captured when the user picks lodging from
  // the dropdown — null when they typed freehand. Persisted on
  // GolfTrip so the home Your Tour chip can show the real city
  // ("Boyne, MI") instead of the airport's misleading one.
  const [newTripLodgingCity, setNewTripLodgingCity] = useState<string | null>(null);
  const [newTripLodgingState, setNewTripLodgingState] = useState<string | null>(null);
  const [newTripSaving, setNewTripSaving] = useState(false);

  // Archive sub-filter

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

  // Same body-scroll-lock + visualViewport sync for the New Trip sheet.
  useEffect(() => {
    if (!newTripOpen) return;
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
      const el = document.getElementById("new-trip-overlay");
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
  }, [newTripOpen]);

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
    // Parse as UTC (trailing 'Z') and format in UTC so picking May 25 in a
    // negative offset timezone (e.g. PST) doesn't roll back to May 24. Mirrors
    // the fmtSingleDate helper at the top of this file.
    const niceDate = new Date(quickDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
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
      setToast({ msg: `Couldn't save the course on this round: ${tcErr.message}`, kind: "error" });
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
          referenceId: tripId,
          read: false,
          createdAt: now,
          updatedAt: now,
        }))
      );
      // Fire a push to each invitee so they get the notification on their phone,
      // not just in the bell. Mirrors the long-form trip-invite path.
      for (const f of invitedFriends) {
        sendPushToUser("trip_invite", f.id, tripId);
      }
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

  async function submitNewTrip() {
    if (!newTripName.trim() || !userId || newTripSaving) return;
    setNewTripSaving(true);
    const supabase = createClient();
    const tripId = crypto.randomUUID();
    const now = new Date().toISOString();
    await supabase.from("GolfTrip").insert({
      id: tripId,
      name: newTripName.trim(),
      createdBy: userId,
      startDate: newTripStart || null,
      endDate: newTripEnd || null,
      arrivalAirport: newTripAirport.trim() || null,
      lodging: newTripLodging.trim() || null,
      lodgingCity: newTripLodgingCity,
      lodgingState: newTripLodgingState,
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
    fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_trip", referenceId: tripId }),
    }).catch(() => {});
    setNewTripSaving(false);
    setNewTripOpen(false);
    setNewTripName("");
    setNewTripStart("");
    setNewTripEnd("");
    router.push(`/trips/${tripId}`);
  }

  // Play a Game wizard state — separate from Quick Round because the
  // user flow skips date/time (the game starts now) and ends on the
  // trip page with the game-creation modal pre-opened.
  // Unified Create Game sheet (2026-05-24 refactor) — single bottom
  // sheet replaces the 2-step Play-a-Game wizard. Course, date,
  // players, format, and stakes are all in one form; submit creates
  // the round + game atomically and routes to /games/[id].
  const [createGameOpen, setCreateGameOpen] = useState(false);

  function openPlayAGame() {
    setCreateGameOpen(true);
  }

  function handleNewClick() {
    // Each tab's "+" button routes to that tab's creation flow.
    // Games: a streamlined course→users→game-type wizard (no date,
    // it's "play right now"). Trips: multi-day, courses get attached
    // on the trip detail page. Rounds: classic Quick Round with date.
    if (tab === "games") {
      openPlayAGame();
    } else if (tab === "trips") {
      setNewTripOpen(true);
    } else {
      setQuickOpen(true);
    }
  }

  // Deep-link from a course page's "Add to your upcoming rounds page" button:
  // ?openQuickRound=<courseId> opens Quick Round pre-loaded with that course.
  useEffect(() => {
    const courseId = searchParams.get("openQuickRound");
    if (!courseId) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("Course")
        .select("id, name, city, state, logoUrl")
        .eq("id", courseId)
        .single();
      if (cancelled || !data) return;
      setQuickCourse(data as CourseSearchRow);
      setQuickOpen(true);
      // Strip the param so back-nav doesn't keep reopening the sheet
      router.replace("/tee-up");
    })();
    return () => { cancelled = true; };
  }, [searchParams, router]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace("/login"); return; }
      const uid = data.user.id;
      setUserId(uid);

      // Fetch the user's profile so Play-a-Game's Step 3 host row can
      // render their actual avatar + display name instead of a generic
      // placeholder. One query, fire-and-forget.
      supabase
        .from("User")
        .select("avatarUrl, displayName, username, handicapIndex")
        .eq("id", uid)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (profile) {
            setUserAvatar(profile.avatarUrl ?? null);
            setUserDisplayName(profile.displayName || profile.username || null);
            setUserHandicap(profile.handicapIndex ?? null);
          }
        });

      // 1) Trip IDs where user is a member
      const { data: memberRows } = await supabase
        .from("GolfTripMember")
        .select("tripId")
        .eq("userId", uid);
      const tripIds = Array.from(new Set((memberRows ?? []).map((r: any) => r.tripId)));

      // 2) Enrich each trip with course/member/game counts
      let built: TripRow[] = [];
      if (tripIds.length > 0) {
        const [{ data: tripRows }, { data: tcRows }, { data: memberRowsAll }, { data: gameRows }] = await Promise.all([
          supabase.from("GolfTrip").select("id, name, startDate, endDate, imageUrl").in("id", tripIds),
          supabase.from("GolfTripCourse").select("tripId, courseId, secondaryCourseId, sortOrder").in("tripId", tripIds),
          supabase.from("GolfTripMember").select("tripId, userId").in("tripId", tripIds),
          supabase.from("TripGame").select("tripId").in("tripId", tripIds),
        ]);
        const memberByTrip = new Map<string, number>();
        for (const r of (memberRowsAll ?? []) as any[]) memberByTrip.set(r.tripId, (memberByTrip.get(r.tripId) ?? 0) + 1);
        // Hydrate user profiles for the stacked-avatar row at the bottom
        // of each card. One Supabase round-trip across all members in all
        // trips, then grouped client-side.
        const memberUserIds = Array.from(new Set(((memberRowsAll ?? []) as any[]).map(r => r.userId)));
        const userById = new Map<string, { displayName: string; avatarUrl: string | null }>();
        if (memberUserIds.length > 0) {
          const { data: userRows } = await supabase.from("User").select("id, displayName, avatarUrl").in("id", memberUserIds);
          for (const u of (userRows ?? []) as any[]) userById.set(u.id, { displayName: u.displayName ?? "", avatarUrl: u.avatarUrl ?? null });
        }
        const membersByTrip = new Map<string, { userId: string; displayName: string; avatarUrl: string | null }[]>();
        for (const r of (memberRowsAll ?? []) as any[]) {
          const u = userById.get(r.userId);
          if (!membersByTrip.has(r.tripId)) membersByTrip.set(r.tripId, []);
          membersByTrip.get(r.tripId)!.push({ userId: r.userId, displayName: u?.displayName ?? "@?", avatarUrl: u?.avatarUrl ?? null });
        }
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
            members: membersByTrip.get(t.id) ?? [],
            isRound, isPast,
          };
        });

        // ── Games tab — pull TripGame rows for these trips and attach
        // course logo + trip date so cards render rich context without
        // an N+1 fetch. Lives inside this `if (tripIds.length > 0)`
        // block because it depends on `tripRows` and `courseInfo` for
        // the joins. Active = trip in the future and no winner declared
        // yet; archived = trip in the past OR winner has been set. Same
        // heuristic the trip-detail page uses for its game cards.
        const { data: gameRowsFull } = await supabase
          .from("TripGame")
          .select("id, tripId, courseId, courseName, format, formatConfig, players, createdAt")
          .in("tripId", tripIds)
          .order("createdAt", { ascending: false });
        const tripById = new Map<string, { name: string | null; startDate: string | null; endDate: string | null }>();
        for (const t of (tripRows ?? []) as any[]) tripById.set(t.id, { name: t.name, startDate: t.startDate, endDate: t.endDate });
        const gameList: GameRow[] = ((gameRowsFull ?? []) as any[]).map((g) => {
          const tripInfo = tripById.get(g.tripId);
          const endRef = tripInfo?.endDate || tripInfo?.startDate || null;
          const tripIsPast = !!endRef && endRef.slice(0, 10) < today;
          const cfg = g.formatConfig as { winner?: string | null; winners?: Record<string, string> } | null;
          // Hole-picked games (CTP, Long Drive) use `winners` dict; flat
          // games (Nassau, Skins, Best Ball) use `winner` string. Either
          // signals the user has declared a result → archive.
          const hasWinner = !!cfg && (
            !!cfg.winner ||
            (!!cfg.winners && Object.keys(cfg.winners).length > 0)
          );
          return {
            id: g.id,
            tripId: g.tripId,
            courseId: g.courseId,
            courseName: g.courseName,
            courseLogoUrl: courseInfo.get(g.courseId)?.logoUrl ?? null,
            format: g.format,
            formatConfig: cfg,
            players: g.players ?? [],
            tripDate: tripInfo?.startDate ?? null,
            tripName: tripInfo?.name ?? null,
            tripIsPast,
            isArchived: !!(tripIsPast || hasWinner),
          };
        });
        setGames(gameList);
      } else {
        setGames([]);
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

  const activeGames = games.filter(g => !g.isArchived).sort((a, b) => (b.tripDate ?? "").localeCompare(a.tripDate ?? ""));
  const archivedGames = games.filter(g => g.isArchived).sort((a, b) => (b.tripDate ?? "").localeCompare(a.tripDate ?? ""));

  const counts: Record<Tab, number> = {
    games: activeGames.length,
    rounds: futureRounds.length,
    trips: futureTrips.length,
  };

  // Tab metadata — each entry pairs the visible label with a small
  // inline SVG icon. Taller tabs (~56px) with icon-over-label so users
  // get instant context for what each tab holds. Three discrete jobs:
  // play, schedule rounds, plan trips.
  const TAB_DEFS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "games",
      label: "Play a Game",
      // Scorecard with handicap-stroke dots + pencil. The dot pattern
      // reads as "strokes received per player" — a handicap-game
      // signal you only see on real scorecards, distinguishing the
      // Play-a-Game intent from a generic notebook icon. Synced 1:1
      // with HomeTour's Create-a-Game CTA per the "icons should
      // match across surfaces" rule.
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2.5" y="4" width="14" height="16" rx="1.8" />
          <line x1="2.5" y1="9.3" x2="16.5" y2="9.3" />
          <line x1="2.5" y1="14.6" x2="16.5" y2="14.6" />
          <line x1="6" y1="4" x2="6" y2="20" />
          <circle cx="9" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="13" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="11" cy="11.95" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="9" cy="17.3" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="12" cy="17.3" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="15" cy="17.3" r="0.9" fill="currentColor" stroke="none" />
          <path d="M16 17 L19.5 13.5 L21.5 15.5 L18 19 L15.4 19.6 Z" />
          <line x1="19.5" y1="13.5" x2="21.5" y2="15.5" />
        </svg>
      ),
    },
    {
      key: "rounds",
      label: "Rounds",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="21" x2="6" y2="3" />
          <path d="M6 4h12l-3 4 3 4H6" />
        </svg>
      ),
    },
    {
      key: "trips",
      label: "Trips",
      // Airplane outline — fits the "travel to play" vibe of multi-day
      // golf trips better than a suitcase. Lucide-style stroke icon to
      // match the other two tabs.
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
        </svg>
      ),
    },
  ];

  return (
    <main style={{ background: "#07100a", minHeight: "100dvh", color: "#fff", fontFamily: "'Outfit', sans-serif", paddingBottom: 100 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600;700&display=swap'); * { box-sizing: border-box; }`}</style>
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Header — title + a context-aware "+ New" button that opens
          the right sheet for whichever tab is active. */}
      <div style={{ padding: "12px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>Tee Up</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em", marginTop: 2 }}>
            {tab === "games" ? "Start a game right now" : tab === "rounds" ? "Schedule a round" : "Plan a multi-day trip"}
          </div>
        </div>
        <button
          onClick={handleNewClick}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.45)", borderRadius: 99, padding: "6px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#4da862", cursor: "pointer" }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {tab === "games" ? "New Game" : tab === "trips" ? "New Trip" : "New Round"}
        </button>
      </div>

      {/* Tabs — icon over label, 56px tall. Three primary jobs:
          Play a Game / Rounds / Trips. Archive content for each tab
          lives inside the body via an inline toggle, so users don't
          lose their place navigating to a separate top-level tab. */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {TAB_DEFS.map(t => {
          const active = tab === t.key;
          // Active tab matches the BottomNav active treatment —
          // icon + label both flip to the Tour It green (#4da862) so
          // the system reads consistently across the app's nav surfaces.
          const activeColor = "#4da862";
          const idleColor = "rgba(255,255,255,0.4)";
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{ flex: 1, padding: "10px 4px", background: "none", border: "none", borderBottom: `2px solid ${active ? activeColor : "transparent"}`, cursor: "pointer", marginBottom: -1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: active ? activeColor : idleColor, minHeight: 56 }}
            >
              {t.icon}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: active ? activeColor : idleColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {t.label}
                </span>
                {counts[t.key] > 0 && (
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: active ? "rgba(77,168,98,0.7)" : "rgba(255,255,255,0.25)", background: active ? "rgba(77,168,98,0.12)" : "rgba(255,255,255,0.04)", borderRadius: 10, padding: "1px 6px" }}>
                    {counts[t.key]}
                  </span>
                )}
              </div>
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
          {/* Per-tab Active / Archive toggle. Pill pair sits at the top
              of each tab's content area so users can flip between
              upcoming items and historical ones without leaving the
              tab. Counts hint at how much is in each bucket. */}
          {(() => {
            const archiveCounts: Record<Tab, number> = {
              games: archivedGames.length,
              rounds: pastRounds.length,
              trips: pastTrips.length,
            };
            const isArchive = archiveOpen[tab];
            const activeCount = counts[tab];
            const archiveCount = archiveCounts[tab];
            // Hide the toggle entirely when both buckets are empty —
            // it's just noise when there's nothing to switch to.
            if (activeCount === 0 && archiveCount === 0) return null;
            return (
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {([
                  { archive: false, label: tab === "games" ? "Active" : "Upcoming", count: activeCount },
                  { archive: true, label: "Archive", count: archiveCount },
                ]).map(seg => {
                  const active = seg.archive === isArchive;
                  return (
                    <button
                      key={seg.label}
                      onClick={() => setArchiveOpen(prev => ({ ...prev, [tab]: seg.archive }))}
                      style={{
                        flex: 1,
                        background: active ? "rgba(77,168,98,0.18)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${active ? "rgba(77,168,98,0.45)" : "rgba(255,255,255,0.08)"}`,
                        borderRadius: 99,
                        padding: "8px 10px",
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: 12,
                        fontWeight: 700,
                        color: active ? "#4da862" : "rgba(255,255,255,0.45)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <span>{seg.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.7 }}>{seg.count}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* GAMES TAB — lists every TripGame the user is part of.
              Active games (future-dated trips with no winner declared)
              get hero treatment; archived games (past trips or declared
              winners) live under the Archive toggle. */}
          {tab === "games" && !archiveOpen.games && (
            activeGames.length === 0
              ? <EmptyState
                  title="No active games"
                  subtitle="Pick a course, invite friends, and start a game in seconds — Nassau, Skins, Match Play, Best Ball, Closest to the Pin, Long Drive. We'll spin up the round automatically."
                  ctaLabel="Play a Game"
                  onCta={() => openPlayAGame()}
                />
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {activeGames.map(g => <GameCard key={g.id} game={g} onClick={() => router.push(`/trips/${g.tripId}`)} />)}
                </div>
          )}
          {tab === "games" && archiveOpen.games && (
            archivedGames.length === 0
              ? <EmptyState title="No archived games yet" subtitle="Finished games will land here." />
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {archivedGames.map(g => <GameCard key={g.id} game={g} onClick={() => router.push(`/trips/${g.tripId}`)} archived />)}
                </div>
          )}

          {/* ROUNDS TAB */}
          {tab === "rounds" && !archiveOpen.rounds && (
            futureRounds.length === 0
              ? <EmptyState title="No upcoming rounds" subtitle="Plan a single-day round, add friends, attach a game." ctaLabel="Schedule a round" onCta={() => setQuickOpen(true)} />
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {futureRounds.map(t => <TripCard key={t.id} trip={t} onClick={() => router.push(`/trips/${t.id}`)} />)}
                </div>
          )}
          {tab === "rounds" && archiveOpen.rounds && (
            pastRounds.length === 0
              ? <EmptyState title="No archived rounds" subtitle="Past rounds you've logged will appear here." />
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pastRounds.map(r => <LoggedRoundCard key={r.id} round={r} onClick={() => router.push(`/courses/${r.courseId}`)} />)}
                </div>
          )}

          {/* TRIPS TAB */}
          {tab === "trips" && !archiveOpen.trips && (
            futureTrips.length === 0
              ? <EmptyState title="No upcoming trips" subtitle="Plan a multi-day buddy trip with multiple courses." ctaLabel="Plan a trip" onCta={() => setNewTripOpen(true)} />
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {futureTrips.map(t => <TripCard key={t.id} trip={t} onClick={() => router.push(`/trips/${t.id}`)} />)}
                </div>
          )}
          {tab === "trips" && archiveOpen.trips && (
            pastTrips.length === 0
              ? <EmptyState title="No archived trips" subtitle="Trips that have ended will appear here." />
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pastTrips.map(t => <TripCard key={t.id} trip={t} onClick={() => router.push(`/trips/${t.id}`)} />)}
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
                      ? <img src={cdnImage(quickCourse.logoUrl)} alt={quickCourse.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                              ? <img src={cdnImage(c.logoUrl)} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                <DateField value={quickDate} onChange={setQuickDate} />
              </div>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Tee Time <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opt)</span></div>
                <TimeField value={quickTime} onChange={setQuickTime} />
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
                          ? <img src={cdnImage(f.avatarUrl)} alt={f.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                          ? <img src={cdnImage(f.avatarUrl)} alt={f.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                    const msg = `Join me on Tour It! Sign up at touritgolf.com — we're playing${quickCourse ? ` ${quickCourse.name}` : " a round"}${quickDate ? ` on ${new Date(quickDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : ""}.`;
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

      {/* New Trip sheet — multi-day buddy trip. No course is attached at
          creation; the user adds courses, members, and accommodations on
          the trip detail page after creation. */}
      {newTripOpen && (
        <div id="new-trip-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100dvh", zIndex: 200, display: "flex", flexDirection: "column", willChange: "transform" }} onClick={() => { if (!newTripSaving) setNewTripOpen(false); }}>
          <div onClick={() => { if (!newTripSaving) setNewTripOpen(false); }} style={{ flex: 1, background: "rgba(0,0,0,0.6)", minHeight: 40 }} />
          <div onClick={e => e.stopPropagation()} style={{ background: "#0d2318", borderRadius: "20px 20px 0 0", padding: "14px 20px calc(28px + env(safe-area-inset-bottom))", maxHeight: "92%", overflowY: "auto", flexShrink: 0 }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 99, margin: "0 auto 16px" }} />

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)", marginBottom: 2 }}>New Trip</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>Plan a Trip</div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>Name your trip and set the dates. You'll add courses, friends, and games on the next screen.</div>
            </div>

            {/* Trip Name */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Trip Name *</div>
              <input
                value={newTripName}
                onChange={e => setNewTripName(e.target.value)}
                placeholder="e.g. Myrtle Beach 2026"
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }}
              />
            </div>

            {/* Start + End dates — end is constrained to >= start so the
                picker UI prevents impossible ranges (Nov 1 → Oct 30). If
                start changes to a date after the current end, we clear
                end so the user isn't stuck with an invalid value. */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Start Date</div>
                <DateField
                  value={newTripStart}
                  onChange={(v) => {
                    setNewTripStart(v);
                    if (v && newTripEnd && newTripEnd < v) setNewTripEnd("");
                  }}
                />
              </div>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>End Date</div>
                <DateField value={newTripEnd} onChange={setNewTripEnd} min={newTripStart || undefined} />
              </div>
            </div>

            {/* Flying-into + lodging — search-as-you-type pickers so we
                land canonical airport codes + real hotel names instead
                of free-text inconsistencies. Stack vertically so each
                dropdown has room to render. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Flying into</div>
                <AirportField value={newTripAirport} onChange={setNewTripAirport} />
              </div>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Lodging</div>
                <LodgingField
                  value={newTripLodging}
                  onChange={(choice) => {
                    setNewTripLodging(choice.display);
                    setNewTripLodgingCity(choice.city);
                    setNewTripLodgingState(choice.state);
                  }}
                />
              </div>
            </div>

            <button
              onClick={submitNewTrip}
              disabled={!newTripName.trim() || newTripSaving}
              style={{
                width: "100%",
                padding: "14px",
                background: !newTripName.trim() ? "rgba(45,122,66,0.4)" : "#2d7a42",
                border: "none",
                borderRadius: 14,
                fontFamily: "'Outfit', sans-serif",
                fontSize: 15,
                fontWeight: 700,
                color: "#fff",
                cursor: !newTripName.trim() || newTripSaving ? "default" : "pointer",
              }}
            >
              {newTripSaving ? "Creating…" : "Create Trip"}
            </button>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.32)", textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
              Courses, members, and accommodations get added on the trip's page next.
            </div>
          </div>
        </div>
      )}

      {/* Unified Create Game sheet (2026-05-24 refactor) — replaces
          the old 2-step Play-a-Game wizard. Single sheet with course,
          date, players + handicaps, format, and stakes all inline;
          submit creates the round + game atomically and routes to
          /games/[id]. Standalone mode (no presetTrip) — the sheet
          creates the GolfTrip + GolfTripCourse + GolfTripMember
          itself, then the game. */}
      {userId && (
        <CreateGameSheet
          open={createGameOpen}
          onClose={() => setCreateGameOpen(false)}
          currentUserId={userId}
          currentUserDisplayName={userDisplayName || "You"}
          currentUserAvatarUrl={userAvatar}
          currentUserHandicapIndex={userHandicap}
          onCreated={(gameId) => router.push(`/games/${gameId}`)}
        />
      )}


      <BottomNav />
    </main>
  );
}

// GameCard — Tee Up's Games-tab card. Hero treatment for active
// games (green gradient + drop shadow + big play chevron), muted
// treatment for archived games. Mirrors the round-mode game card
// on the trip-detail page so a game reads consistently wherever
// it appears in the app.
function GameCard({
  game,
  onClick,
  archived,
}: {
  game: {
    id: string;
    courseName: string;
    courseLogoUrl: string | null;
    format: string;
    formatConfig: { winner?: string | null; winners?: Record<string, string> } | null;
    players: { userId: string; displayName: string; avatarUrl: string | null }[] | null;
    tripDate: string | null;
  };
  onClick: () => void;
  archived?: boolean;
}) {
  // Format → friendly label. Keep in sync with the GAME_FORMATS array
  const formatLabel = gameFormatLabel(game.format);
  const cfg = game.formatConfig as { frontAmount?: number; backAmount?: number; totalAmount?: number; skinsAmount?: number; wager?: number; holes?: number[]; stake?: number } | null;
  const sub =
    game.format === "nassau" && cfg ? `$${cfg.frontAmount}/$${cfg.backAmount}/$${cfg.totalAmount}`
    : game.format === "skins" && cfg ? `$${cfg.skinsAmount}/skin`
    : game.format === "best_ball" && cfg && Number(cfg.wager) > 0 ? `$${cfg.wager}/team`
    : cfg && Array.isArray(cfg.holes) && cfg.holes.length > 0
      ? `${cfg.holes.length} hole${cfg.holes.length === 1 ? "" : "s"}${Number(cfg.stake) > 0 ? ` · $${cfg.stake}/hole` : ""}`
      : "";
  const players = game.players ?? [];
  const dateLabel = game.tripDate ? new Date(game.tripDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        background: archived
          ? "rgba(255,255,255,0.03)"
          : "linear-gradient(135deg, rgba(77,168,98,0.14) 0%, rgba(45,122,66,0.06) 100%)",
        border: `1px solid ${archived ? "rgba(255,255,255,0.07)" : "rgba(77,168,98,0.35)"}`,
        borderRadius: 16,
        padding: "14px 16px",
        boxShadow: archived ? "none" : "0 6px 20px rgba(0,0,0,0.22)",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: game.courseLogoUrl ? "#fff" : "rgba(77,168,98,0.14)", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {game.courseLogoUrl
            ? <img src={game.courseLogoUrl} alt={game.courseName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.6"><path d="M4 21h16M12 15V2"/></svg>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: archived ? "rgba(255,255,255,0.35)" : "rgba(77,168,98,0.85)", marginBottom: 3 }}>
            {archived ? "Played" : "Game"}{dateLabel ? ` · ${dateLabel}` : ""}
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatLabel}</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {game.courseName}{sub && ` · `}<span style={{ color: archived ? "rgba(255,255,255,0.5)" : "#4da862", fontWeight: 600 }}>{sub}</span>
          </div>
        </div>
        {!archived && (
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#2d7a42", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(45,122,66,0.4)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        )}
      </div>
      {players.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${archived ? "rgba(255,255,255,0.06)" : "rgba(77,168,98,0.18)"}` }}>
          <div style={{ display: "flex" }}>
            {players.slice(0, 5).map((p, i) => (
              <div key={p.userId} style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", border: "2px solid #0d2318", background: "rgba(77,168,98,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: i > 0 ? -7 : 0, zIndex: players.length - i, flexShrink: 0 }}>
                {p.avatarUrl
                  ? <img src={cdnImage(p.avatarUrl)} alt={p.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>}
              </div>
            ))}
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.55)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {players.slice(0, 2).map(p => p.displayName || "@?").join(" · ")}
            {players.length > 2 && ` +${players.length - 2}`}
          </div>
        </div>
      )}
    </button>
  );
}

function LoggedRoundCard({ round, onClick }: { round: RoundRow; onClick: () => void }) {
  // Archived-round card. Matches the muted (archived) variant of TripCard
  // exactly so the Rounds → Archive view is visually consistent with the
  // rest of the Tee Up surface. No member row — RoundRow comes from the
  // Round table (a logged scored round) and doesn't carry player data.
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 11, background: round.courseLogoUrl ? "#fff" : "rgba(77,168,98,0.14)", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {round.courseLogoUrl
          ? <img src={round.courseLogoUrl} alt={round.courseName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.6"><path d="M4 21h16M7 21c0-3.5 2.5-6 5-6s5 2.5 5 6M12 15V2M12 2 L19 5 L12 8Z"/></svg>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 3 }}>
          Logged{fmtSingleDate(round.date) ? ` · ${fmtSingleDate(round.date)}` : ""}
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{round.courseName}</div>
        {round.totalScore != null && (
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
            Score <span style={{ color: "#4da862", fontWeight: 600 }}>{round.totalScore}</span>
          </div>
        )}
      </div>
    </button>
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
  // Mirror GameCard exactly so the three tabs feel like one design system:
  // green gradient hero for upcoming, muted card for past, Playfair title,
  // eyebrow caps with date, stacked-avatar member row, big green pill
  // chevron. `isRound` only changes the eyebrow label (ROUND vs TRIP).
  const archived = trip.isPast;
  const date = fmtDateRange(trip.startDate, trip.endDate);
  const eyebrowKind = archived ? "Played" : (trip.isRound ? "Round" : "Trip");
  const subParts: string[] = [];
  if (trip.courseCount > 0) subParts.push(`${trip.courseCount} ${trip.courseCount === 1 ? "course" : "courses"}`);
  if (trip.totalHoles > 0) subParts.push(`${trip.totalHoles} holes`);
  if (trip.memberCount > 0) subParts.push(`${trip.memberCount} ${trip.memberCount === 1 ? "golfer" : "golfers"}`);
  const members = trip.members ?? [];
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        background: archived
          ? "rgba(255,255,255,0.03)"
          : "linear-gradient(135deg, rgba(77,168,98,0.14) 0%, rgba(45,122,66,0.06) 100%)",
        border: `1px solid ${archived ? "rgba(255,255,255,0.07)" : "rgba(77,168,98,0.35)"}`,
        borderRadius: 16,
        padding: "14px 16px",
        boxShadow: archived ? "none" : "0 6px 20px rgba(0,0,0,0.22)",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: trip.imageUrl || trip.firstCourseLogo ? "#fff" : "rgba(77,168,98,0.14)", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {trip.imageUrl
            ? <img src={cdnImage(trip.imageUrl)} alt={trip.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : trip.firstCourseLogo
              ? <img src={trip.firstCourseLogo} alt={trip.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.6"><path d="M4 21h16M7 21c0-3.5 2.5-6 5-6s5 2.5 5 6M12 15V2M12 2 L19 5 L12 8Z"/></svg>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: archived ? "rgba(255,255,255,0.35)" : "rgba(77,168,98,0.85)", marginBottom: 3 }}>
            {eyebrowKind}{date ? ` · ${date}` : ""}
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{trip.name}</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subParts.join(" · ")}
            {trip.gameCount > 0 && (
              <> · <span style={{ color: archived ? "rgba(255,255,255,0.5)" : "#4da862", fontWeight: 600 }}>{trip.gameCount} {trip.gameCount === 1 ? "game" : "games"}</span></>
            )}
          </div>
        </div>
        {!archived && (
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#2d7a42", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(45,122,66,0.4)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        )}
      </div>
      {members.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${archived ? "rgba(255,255,255,0.06)" : "rgba(77,168,98,0.18)"}` }}>
          <div style={{ display: "flex" }}>
            {members.slice(0, 5).map((m, i) => (
              <div key={m.userId} style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", border: "2px solid #0d2318", background: "rgba(77,168,98,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: i > 0 ? -7 : 0, zIndex: members.length - i, flexShrink: 0 }}>
                {m.avatarUrl
                  ? <img src={cdnImage(m.avatarUrl)} alt={m.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>}
              </div>
            ))}
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.55)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {members.slice(0, 2).map(m => m.displayName || "@?").join(" · ")}
            {members.length > 2 && ` +${members.length - 2}`}
          </div>
        </div>
      )}
    </button>
  );
}
