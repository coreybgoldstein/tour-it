"use client";

/**
 * Unified Create Game sheet.
 *
 * One sheet replaces both wizards (Tee-Up "Play a Game" 2-step + the
 * trip-page Create Game 5-step). All inputs live in a single scrollable
 * body with a sticky submit footer — Schedule a Round vibes, no more
 * step-by-step paging. After submit, the user lands on /games/[id].
 *
 * Two modes:
 *   - Standalone (no `presetTrip`): user picks course + date in-sheet
 *     and submit creates GolfTrip + GolfTripCourse + GolfTripMember
 *     before creating the game.
 *   - Trip-context (`presetTrip` supplied): course + date sections are
 *     hidden and submit just creates the game on the existing trip.
 *
 * Hole handicap rankings are auto-derived from the Course's Hole rows
 * (handicapRank) with a 1–18 default fallback — the user never has to
 * input them, matching the "auto-use course data" decision from the
 * 2026-05-24 product call.
 *
 * Per the standing rule in CLAUDE.md, this is a bottom sheet using the
 * custom-overlay pattern (position:fixed; inset:0; alignItems:stretch;
 * flex:1 on the panel) so it always fills the available vertical space
 * regardless of how tall its content renders.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { SwipeGrip } from "@/components/SwipeGrip";
import { createClient } from "@/lib/supabase/client";
import { cdnImage } from "@/lib/cdnImage";

type CourseSearchRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  logoUrl: string | null;
  par?: number | null;
  slope?: number | null;
  rating?: number | null;
};

type FriendRow = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  handicapIndex?: number | null;
};

type GamePlayer = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  handicapIndex: number;
  teamId: string;
};

const GAME_FORMATS: { id: string; name: string; desc: string }[] = [
  { id: "nassau", name: "Nassau", desc: "3 bets: front 9, back 9, full 18" },
  { id: "skins", name: "Skins", desc: "Win each hole, ties carry over" },
  { id: "match_play", name: "Match Play", desc: "Win holes, not total strokes" },
  { id: "best_ball", name: "Best Ball", desc: "Team: best net score per hole" },
  { id: "closest_to_pin", name: "Closest to Pin", desc: "Closest to the flag wins each chosen hole" },
  { id: "longest_drive", name: "Longest Drive", desc: "Longest tee shot in the fairway wins each chosen hole" },
];

const HOLE_PICKED_FORMATS = new Set(["closest_to_pin", "longest_drive"]);

export type PresetTrip = {
  id: string;
  date: string | null;
  // Multiple courses possible (multi-day trips). User picks one for
  // the game when there's more than one stop.
  courses: Array<{
    courseId: string;
    courseName: string;
    courseLogoUrl: string | null;
  }>;
  members: Array<{
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    handicapIndex: number | null;
  }>;
};

export interface CreateGameSheetProps {
  open: boolean;
  onClose: () => void;
  // When supplied, the sheet uses this trip and skips course/date inputs.
  // Otherwise the sheet shows them and creates a one-day trip on submit.
  presetTrip?: PresetTrip;
  // Caller's user id — required so we can stamp createdBy and seed the
  // host into the player list.
  currentUserId: string;
  currentUserDisplayName: string;
  currentUserAvatarUrl: string | null;
  currentUserHandicapIndex: number | null;
  // Fires after a successful create with the new game id so the caller
  // can navigate (default: route to /games/[id]).
  onCreated?: (gameId: string, tripId: string) => void;
}

export default function CreateGameSheet({
  open,
  onClose,
  presetTrip,
  currentUserId,
  currentUserDisplayName,
  currentUserAvatarUrl,
  currentUserHandicapIndex,
  onCreated,
}: CreateGameSheetProps) {
  // ── Course (standalone mode) ─────────────────────────────────────
  const [courseSearch, setCourseSearch] = useState("");
  const [courseResults, setCourseResults] = useState<CourseSearchRow[]>([]);
  const [course, setCourse] = useState<CourseSearchRow | null>(null);

  // ── Date (standalone mode) ───────────────────────────────────────
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [teeTime, setTeeTime] = useState<string>("");

  // ── Players ──────────────────────────────────────────────────────
  // Host always seeded first; presetTrip.members merged on top of that.
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState<FriendRow[]>([]);

  // ── Format + stakes ──────────────────────────────────────────────
  const [format, setFormat] = useState<string>("");
  // Stake fields — one set, only relevant ones are read at submit.
  const [nassauFront, setNassauFront] = useState("5");
  const [nassauBack, setNassauBack] = useState("5");
  const [nassauTotal, setNassauTotal] = useState("5");
  const [skinsAmount, setSkinsAmount] = useState("2");
  const [skinsCarry, setSkinsCarry] = useState(true);
  const [teamWager, setTeamWager] = useState("20");
  const [holeStake, setHoleStake] = useState("5");
  const [selectedHoles, setSelectedHoles] = useState<number[]>([]);

  // ── Submit state ─────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  // Ref for swipe-down-to-dismiss on the sheet panel.
  const cgSheetRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Refs for keyboard-aware scrolling ────────────────────────────
  // Friend search lives in the middle of the sheet — when the user
  // taps the input on a tall sheet, the dropdown results render
  // below it and end up behind the keyboard. Scrolling the results
  // anchor into view after they render brings them up above the
  // keyboard. Same trick for the course search at the top — the
  // sheet auto-scrolls so the dropdown is always visible.
  const friendResultsRef = useRef<HTMLDivElement>(null);
  const courseResultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (friendResults.length > 0 && friendResultsRef.current) {
      friendResultsRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [friendResults]);

  useEffect(() => {
    if (courseResults.length > 0 && courseResultsRef.current) {
      courseResultsRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [courseResults]);

  // ── Handicap input drafts ────────────────────────────────────────
  // Backed by string per userId so the input can sit at "" while the
  // user retypes. Without this the controlled input snaps back to "0"
  // the moment the field is emptied, which makes it impossible to
  // delete a leading zero. On blur / +/-, we parse the draft back into
  // the player's numeric handicapIndex and clear the draft so the
  // canonical number takes over again.
  const [handicapDrafts, setHandicapDrafts] = useState<Record<string, string>>({});

  // Selected trip course (when presetTrip has multiple stops). Falls back
  // to the first course automatically.
  const [tripCourseIdx, setTripCourseIdx] = useState(0);

  // Retroactive attach — user's upcoming trips/rounds shown at the
  // top of standalone mode. When the user picks one from this list
  // we behave as if the sheet was opened with that trip as
  // presetTrip (course + date are pre-filled, the Course/Date
  // inputs hide, and submit uses the existing tripId instead of
  // creating a new GolfTrip).
  type ExistingTripOption = {
    id: string;
    name: string;
    startDate: string | null;
    stops: { courseId: string; courseName: string; courseLogoUrl: string | null; playDate: string | null; teeTime: string | null }[];
    members: { userId: string; displayName: string; avatarUrl: string | null; handicapIndex: number | null }[];
  };
  const [existingTrips, setExistingTrips] = useState<ExistingTripOption[]>([]);
  const [pickedExistingTrip, setPickedExistingTrip] = useState<ExistingTripOption | null>(null);

  // ── Reset state when sheet opens. Seed players from preset members
  //    + the current user. Avoid duplicating host if they're already
  //    in the trip's member list. ─────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubmitting(false);
    setCourseSearch("");
    setCourseResults([]);
    setCourse(null);
    setDate(presetTrip?.date ?? new Date().toISOString().slice(0, 10));
    setTeeTime("");
    setFriendSearch("");
    setFriendResults([]);
    setFormat("");
    setNassauFront("5");
    setNassauBack("5");
    setNassauTotal("5");
    setSkinsAmount("2");
    setSkinsCarry(true);
    setTeamWager("20");
    setHoleStake("5");
    setSelectedHoles([]);
    setTripCourseIdx(0);
    setHandicapDrafts({});
    setPickedExistingTrip(null);
    setExistingTrips([]);

    // Seed player list — host always first, then trip members (deduped),
    // each with their current handicap.
    const seeded: GamePlayer[] = [
      {
        userId: currentUserId,
        displayName: currentUserDisplayName || "You",
        avatarUrl: currentUserAvatarUrl,
        handicapIndex: currentUserHandicapIndex ?? 0,
        teamId: "A",
      },
    ];
    if (presetTrip?.members) {
      for (const m of presetTrip.members) {
        if (m.userId === currentUserId) continue;
        seeded.push({
          userId: m.userId,
          displayName: m.displayName || "@?",
          avatarUrl: m.avatarUrl,
          handicapIndex: m.handicapIndex ?? 0,
          teamId: "A",
        });
      }
    }
    // 2-player → 1v1 auto-split onto Team A / Team B.
    if (seeded.length === 2) seeded[1].teamId = "B";
    setPlayers(seeded);
  }, [open, currentUserId, currentUserDisplayName, currentUserAvatarUrl, currentUserHandicapIndex, presetTrip]);

  // ── Existing-trip picker: fetch user's upcoming trips when the
  //    sheet opens in standalone mode. Lets the user attach the
  //    new game to a pre-existing round or trip instead of always
  //    creating a fresh one. ───────────────────────────────────────
  useEffect(() => {
    if (!open || presetTrip) return;
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const todayIso = new Date().toISOString().slice(0, 10);
      const { data: memberships } = await sb.from("GolfTripMember").select("tripId").eq("userId", currentUserId);
      const tripIds = (memberships ?? []).map((m: any) => m.tripId);
      if (tripIds.length === 0) return;
      const [{ data: trips }, { data: stopRows }, { data: memberRows }] = await Promise.all([
        sb.from("GolfTrip").select("id, name, startDate, endDate").in("id", tripIds).or(`endDate.gte.${todayIso},endDate.is.null`).order("startDate", { ascending: true, nullsFirst: false }),
        sb.from("GolfTripCourse").select("tripId, courseId, playDate, teeTime, sortOrder").in("tripId", tripIds).order("sortOrder", { ascending: true }),
        sb.from("GolfTripMember").select("tripId, userId").in("tripId", tripIds),
      ]);
      const courseIds = Array.from(new Set((stopRows ?? []).map((s: any) => s.courseId).filter(Boolean)));
      const memberUserIds = Array.from(new Set((memberRows ?? []).map((m: any) => m.userId).filter(Boolean)));
      const [{ data: coursesRaw }, { data: usersRaw }] = await Promise.all([
        courseIds.length ? sb.from("Course").select("id, name, logoUrl").in("id", courseIds) : Promise.resolve({ data: [] as any[] }),
        memberUserIds.length ? sb.from("User").select("id, displayName, avatarUrl, handicapIndex").in("id", memberUserIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const courseById = new Map((coursesRaw ?? []).map((c: any) => [c.id, c]));
      const userById = new Map((usersRaw ?? []).map((u: any) => [u.id, u]));
      const builtTrips: ExistingTripOption[] = (trips ?? []).map((t: any) => {
        const stops = (stopRows ?? []).filter((s: any) => s.tripId === t.id).map((s: any) => {
          const c: any = courseById.get(s.courseId);
          return { courseId: s.courseId, courseName: c?.name ?? "Unknown", courseLogoUrl: c?.logoUrl ?? null, playDate: s.playDate, teeTime: s.teeTime };
        }).filter((s: any) => s.courseName !== "Unknown");
        const members = (memberRows ?? []).filter((m: any) => m.tripId === t.id).map((m: any) => {
          const u: any = userById.get(m.userId);
          if (!u) return null;
          return { userId: m.userId, displayName: u.displayName, avatarUrl: u.avatarUrl, handicapIndex: u.handicapIndex };
        }).filter((m: any): m is { userId: string; displayName: string; avatarUrl: string | null; handicapIndex: number | null } => m != null);
        return { id: t.id, name: t.name, startDate: t.startDate, stops, members };
      }).filter((t: ExistingTripOption) => t.stops.length > 0);
      if (!cancelled) setExistingTrips(builtTrips);
    })();
    return () => { cancelled = true; };
  }, [open, presetTrip, currentUserId]);

  // ── Course search (debounced) ────────────────────────────────────
  useEffect(() => {
    if (presetTrip) return; // trip-context mode → no search
    const q = courseSearch.trim();
    if (q.length < 2) {
      setCourseResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const supabase = createClient();
      // OR across name / city / state, capped to 8 results so the
      // dropdown stays a tappable size on phones.
      const { data } = await supabase
        .from("Course")
        .select("id, name, city, state, logoUrl")
        .or(`name.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%`)
        .order("name")
        .limit(8);
      if (cancelled) return;
      setCourseResults((data ?? []) as CourseSearchRow[]);
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [courseSearch, presetTrip]);

  // ── Friend search (debounced) — only shows users not already in the
  //    players list, capped to 6. ────────────────────────────────────
  useEffect(() => {
    const q = friendSearch.trim();
    if (q.length < 2) {
      setFriendResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("User")
        .select("id, username, displayName, avatarUrl, handicapIndex")
        .or(`username.ilike.%${q}%,displayName.ilike.%${q}%`)
        .limit(10);
      if (cancelled) return;
      const taken = new Set(players.map(p => p.userId));
      setFriendResults(((data ?? []) as FriendRow[]).filter(f => !taken.has(f.id)).slice(0, 6));
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [friendSearch, players]);

  // Active course = preset-selected course or standalone-search course.
  const activeCourse = useMemo(() => {
    if (presetTrip) {
      const c = presetTrip.courses[tripCourseIdx];
      if (!c) return null;
      return {
        id: c.courseId,
        name: c.courseName,
        logoUrl: c.courseLogoUrl,
      };
    }
    return course
      ? { id: course.id, name: course.name, logoUrl: course.logoUrl }
      : null;
  }, [presetTrip, tripCourseIdx, course]);

  // ── Submit ────────────────────────────────────────────────────────
  const canSubmit = !!activeCourse && !!format && players.length >= 1 && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !activeCourse) return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const nowIso = new Date().toISOString();

    try {
      // ── 1. Ensure we have a tripId. Three paths:
      //    a) presetTrip (sheet was opened from a trip page) → use it
      //    b) pickedExistingTrip (user attached to an existing trip
      //       from the standalone-mode picker) → use that trip's id
      //    c) Otherwise create a new GolfTrip + GolfTripCourse +
      //       GolfTripMember so the game has somewhere to live.
      let tripId = presetTrip?.id ?? pickedExistingTrip?.id ?? null;
      if (!tripId) {
        tripId = crypto.randomUUID();
        const playDate = date || new Date().toISOString().slice(0, 10);
        const niceDate = new Date(playDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

        const { error: tripErr } = await supabase.from("GolfTrip").insert({
          id: tripId,
          name: `${activeCourse.name} — ${niceDate}`,
          createdBy: currentUserId,
          startDate: playDate,
          endDate: playDate,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        if (tripErr) throw new Error(`Create round: ${tripErr.message}`);

        const { error: tcErr } = await supabase.from("GolfTripCourse").insert({
          id: crypto.randomUUID(),
          tripId,
          courseId: activeCourse.id,
          playDate,
          teeTime: teeTime || null,
          sortOrder: 0,
          createdAt: nowIso,
        });
        if (tcErr) throw new Error(`Attach course: ${tcErr.message}`);

        // Members: host + every other player (skip host duplicate).
        const memberRows = [
          {
            id: crypto.randomUUID(),
            tripId,
            userId: currentUserId,
            role: "owner",
            createdAt: nowIso,
          },
          ...players
            .filter(p => p.userId !== currentUserId)
            .map(p => ({
              id: crypto.randomUUID(),
              tripId: tripId as string,
              userId: p.userId,
              role: "member",
              createdAt: nowIso,
            })),
        ];
        const { error: memErr } = await supabase.from("GolfTripMember").insert(memberRows);
        if (memErr) throw new Error(`Add members: ${memErr.message}`);
      }

      // ── 2. Pull course meta (par / slope / rating) and hole rankings
      //    for handicap math. Auto-derive holeHandicaps from the Hole
      //    table; fall back to 1–18 sequential if the course hasn't
      //    been seeded yet. ──────────────────────────────────────────
      const { data: courseRow } = await supabase
        .from("Course")
        .select("par, teeSlope, teeRating, holeCount")
        .eq("id", activeCourse.id)
        .single();
      const coursePar = (courseRow as { par?: number | null } | null)?.par ?? null;
      const teeSlope = (courseRow as { teeSlope?: number | null } | null)?.teeSlope ?? null;
      const teeRating = (courseRow as { teeRating?: number | null } | null)?.teeRating ?? null;
      const holeCount = (courseRow as { holeCount?: number | null } | null)?.holeCount ?? 18;

      const { data: holeRows } = await supabase
        .from("Hole")
        .select("holeNumber, handicapRank")
        .eq("courseId", activeCourse.id)
        .order("holeNumber");
      const expectedHoles = holeCount === 9 ? 9 : 18;
      // Build the holeHandicaps array indexed by hole position. If any
      // hole is missing a handicapRank in the DB, fall back to the
      // hole's number (1, 2, 3...) — gives a deterministic but
      // unweighted ranking so the game still creates cleanly.
      const ranks: number[] = [];
      for (let i = 1; i <= expectedHoles; i++) {
        const row = (holeRows ?? []).find((h: { holeNumber: number }) => h.holeNumber === i) as { handicapRank?: number | null } | undefined;
        ranks.push(row?.handicapRank && row.handicapRank > 0 ? row.handicapRank : i);
      }

      // ── 3. Build the TripGame row + insert. Hole-picked formats
      //    (CTP / Long Drive) skip the API call and the handicap math
      //    entirely — same logic as the legacy 5-step wizard. ────────
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Not signed in");

      let createdGameId = "";
      if (HOLE_PICKED_FORMATS.has(format)) {
        if (selectedHoles.length === 0) throw new Error("Pick at least one hole for this format.");
        const stakeNum = Math.max(0, parseFloat(holeStake) || 0);
        const formatName = format === "closest_to_pin" ? "Closest to the Pin" : "Longest Drive";
        const holesText = selectedHoles.length === 1
          ? `Hole ${selectedHoles[0]}`
          : `Holes ${selectedHoles.slice(0, -1).join(", ")} & ${selectedHoles[selectedHoles.length - 1]}`;
        const shareText = `${activeCourse.name} — ${formatName}\n${holesText}${stakeNum > 0 ? `\nStakes: $${stakeNum}/hole` : ""}\n${players.map(p => p.displayName).join(", ")}`;
        const formatConfig = { holes: selectedHoles, winners: {} as Record<string, string>, stake: stakeNum };
        const gameId = crypto.randomUUID();
        const { error: insErr } = await supabase.from("TripGame").insert({
          id: gameId,
          tripId,
          courseId: activeCourse.id,
          courseName: activeCourse.name,
          format,
          formatConfig,
          players,
          holeHandicaps: [],
          gameSheet: JSON.stringify({ rules: shareText, tip: "", shareText }),
          shareText,
          createdBy: currentUserId,
          createdAt: nowIso,
        });
        if (insErr) throw new Error(`Create game: ${insErr.message}`);
        createdGameId = gameId;
      } else {
        const formatConfig: Record<string, unknown> =
          format === "nassau" ? { frontAmount: nassauFront, backAmount: nassauBack, totalAmount: nassauTotal }
          : format === "skins" ? { skinsAmount, carryover: skinsCarry }
          : format === "best_ball" ? { wager: Math.max(0, parseFloat(teamWager) || 0) }
          : {};

        const res = await fetch(`/api/trips/${tripId}/game`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            courseId: activeCourse.id,
            courseName: activeCourse.name,
            coursePar,
            teeSlope,
            teeRating,
            format,
            formatConfig,
            players,
            holeHandicaps: ranks,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.game?.id) {
          throw new Error(json.error || "Game creation failed");
        }
        createdGameId = json.game.id;
      }

      // Award points — fire-and-forget per the existing pattern.
      fetch("/api/points/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_game", referenceId: createdGameId }),
      }).catch(() => {});

      onCreated?.(createdGameId, tripId as string);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the game.");
    } finally {
      setSubmitting(false);
    }
  }

  // Body-scroll lock + visualViewport sync — same battle-tested
  // pattern the Quick Round / New Trip sheets use. We tried
  // `bottom: var(--keyboard-height)` first but it double-accounted
  // with Capacitor's native WebView resize and the sheet shrank to
  // ~30% of the visible area on focus. Sizing the overlay directly
  // to `visualViewport.height` works in every mode: web Safari,
  // Capacitor `keyboardResize: "native"`, and `keyboardResize:
  // "none"`.
  useEffect(() => {
    if (!open) return;
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
      const el = document.getElementById("create-game-overlay");
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
  }, [open]);

  if (!open) return null;

  return (
    <div
      id="create-game-overlay"
      onClick={() => { if (!submitting) onClose(); }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "100dvh",
        zIndex: 200,
        background: "rgba(0,0,0,0.78)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        paddingTop: "calc(env(safe-area-inset-top) + 24px)",
        willChange: "transform",
      }}
    >
      <div
        ref={cgSheetRef}
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#0d2318",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          border: "1px solid rgba(255,255,255,0.08)",
          borderTop: "1px solid rgba(77,168,98,0.3)",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
          touchAction: "pan-y",
        }}
      >
        {/* Grip — swipe down to close. */}
        <SwipeGrip sheetRef={cgSheetRef} onClose={() => { if (!submitting) onClose(); }} />

        {/* Header */}
        <div style={{ padding: "10px 20px 14px", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)", marginBottom: 4 }}>Quick Game</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1.15 }}>Create a Game</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
            Pick everything in one shot — we&apos;ll spin up the round and drop you on the game page.
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 20px 20px" }}>
          {/* ── ATTACH TO EXISTING (standalone only) ─────────────── */}
          {!presetTrip && existingTrips.length > 0 && (
            <Section label={pickedExistingTrip ? "Attached to" : "Attach to existing"}>
              {pickedExistingTrip ? (
                <button
                  onClick={() => {
                    setPickedExistingTrip(null);
                    setCourse(null);
                    setDate(new Date().toISOString().slice(0, 10));
                    setTeeTime("");
                    setTripCourseIdx(0);
                    // Reset players back to just the host so the user
                    // can build a fresh roster (or pick again to
                    // re-import the trip's members).
                    setPlayers([{ userId: currentUserId, displayName: currentUserDisplayName || "You", avatarUrl: currentUserAvatarUrl, handicapIndex: currentUserHandicapIndex ?? 0, teamId: "A" }]);
                  }}
                  style={{ ...resultRowStyle, borderColor: "rgba(77,168,98,0.5)", background: "rgba(77,168,98,0.12)" }}
                >
                  <div style={resultIconStyle(pickedExistingTrip.stops[0]?.courseLogoUrl ?? null)}>
                    {pickedExistingTrip.stops[0]?.courseLogoUrl
                      ? <img src={cdnImage(pickedExistingTrip.stops[0].courseLogoUrl!)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.6"><path d="M4 21h16M12 15V2"/></svg>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pickedExistingTrip.name}</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(126,200,140,0.85)" }}>
                      {pickedExistingTrip.stops.length === 1 ? "Round" : `${pickedExistingTrip.stops.length} stops`} · tap to change
                    </div>
                  </div>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {existingTrips.map((t) => {
                    const subtitle = t.stops.length === 1
                      ? `${t.stops[0].courseName}${t.startDate ? ` · ${new Date(t.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}`
                      : `${t.stops.length} stops${t.startDate ? ` · starts ${new Date(t.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}`;
                    const firstLogo = t.stops[0]?.courseLogoUrl ?? null;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setPickedExistingTrip(t);
                          const firstStop = t.stops[0];
                          // Pre-fill course + date + tee time from the
                          // first stop. For multi-stop trips the user
                          // can change which stop with the existing
                          // Course picker further down.
                          setCourse({ id: firstStop.courseId, name: firstStop.courseName, city: null, state: null, logoUrl: firstStop.courseLogoUrl });
                          setDate(firstStop.playDate || t.startDate || new Date().toISOString().slice(0, 10));
                          setTeeTime(firstStop.teeTime || "");
                          setTripCourseIdx(0);
                          // Merge the trip's members into the player
                          // list (host stays first).
                          const merged: GamePlayer[] = [{ userId: currentUserId, displayName: currentUserDisplayName || "You", avatarUrl: currentUserAvatarUrl, handicapIndex: currentUserHandicapIndex ?? 0, teamId: "A" }];
                          for (const m of t.members) {
                            if (m.userId === currentUserId) continue;
                            merged.push({ userId: m.userId, displayName: m.displayName, avatarUrl: m.avatarUrl, handicapIndex: m.handicapIndex ?? 0, teamId: "A" });
                          }
                          if (merged.length === 2) merged[1].teamId = "B";
                          setPlayers(merged);
                        }}
                        style={resultRowStyle}
                      >
                        <div style={resultIconStyle(firstLogo)}>
                          {firstLogo
                            ? <img src={cdnImage(firstLogo)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.6"><path d="M4 21h16M12 15V2"/></svg>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {!pickedExistingTrip && (
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, color: "rgba(255,255,255,0.4)", marginTop: 8, textAlign: "center" }}>
                  — or fill in a new course + date below —
                </div>
              )}
            </Section>
          )}

          {/* ── COURSE ───────────────────────────────────────────── */}
          {!presetTrip && !pickedExistingTrip && (
            <Section label="Course">
              {course ? (
                <SelectedCoursePill course={course} onClear={() => setCourse(null)} />
              ) : (
                <>
                  <SearchInput
                    placeholder="Search a course by name, city, or state"
                    value={courseSearch}
                    onChange={setCourseSearch}
                  />
                  {courseResults.length > 0 && (
                    <div ref={courseResultsRef} style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                      {courseResults.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setCourse(c); setCourseSearch(""); setCourseResults([]); }}
                          style={resultRowStyle}
                        >
                          <div style={resultIconStyle(c.logoUrl)}>
                            {c.logoUrl
                              ? <img src={cdnImage(c.logoUrl)} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.6"><path d="M4 21h16M12 15V2"/></svg>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>{c.name}</div>
                            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{[c.city, c.state].filter(Boolean).join(", ")}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Section>
          )}

          {/* When in trip context with >1 course, let the user pick which
              stop the game is being played on. */}
          {presetTrip && presetTrip.courses.length > 1 && (
            <Section label="Course">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {presetTrip.courses.map((tc, idx) => (
                  <button
                    key={tc.courseId}
                    onClick={() => setTripCourseIdx(idx)}
                    style={{
                      ...resultRowStyle,
                      borderColor: idx === tripCourseIdx ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.08)",
                      background: idx === tripCourseIdx ? "rgba(77,168,98,0.1)" : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div style={resultIconStyle(tc.courseLogoUrl)}>
                      {tc.courseLogoUrl
                        ? <img src={tc.courseLogoUrl} alt={tc.courseName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.6"><path d="M4 21h16M12 15V2"/></svg>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>{tc.courseName}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* ── DATE (standalone only, hidden when attached to a
              pre-existing trip — the trip already has the date) ──── */}
          {!presetTrip && !pickedExistingTrip && (
            <Section label="Date">
              {/* iOS WKWebView renders native date/time controls with
                  an absolutely-positioned indicator capsule that
                  overflows the input box. In a 2-col grid these
                  capsules visibly bleed into the adjacent cell. Stack
                  the inputs in a custom-styled overlay (invisible
                  native input on top of a styled div) so we control
                  every pixel of chrome — same trick the trip-page
                  DateField uses. */}
              <DateInput value={date} onChange={setDate} placeholder="Select date" />
              <div style={{ height: 8 }} />
              <TimeInput value={teeTime} onChange={setTeeTime} placeholder="Tee time (optional)" />
            </Section>
          )}

          {/* When attached to a multi-stop existing trip, let the user
              pick which stop the game is being played on. Mirrors the
              presetTrip multi-course picker below. */}
          {!presetTrip && pickedExistingTrip && pickedExistingTrip.stops.length > 1 && (
            <Section label="Which stop">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pickedExistingTrip.stops.map((s, idx) => (
                  <button
                    key={s.courseId + "-" + idx}
                    onClick={() => {
                      setTripCourseIdx(idx);
                      setCourse({ id: s.courseId, name: s.courseName, city: null, state: null, logoUrl: s.courseLogoUrl });
                      setDate(s.playDate || pickedExistingTrip.startDate || new Date().toISOString().slice(0, 10));
                      setTeeTime(s.teeTime || "");
                    }}
                    style={{
                      ...resultRowStyle,
                      borderColor: idx === tripCourseIdx ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.08)",
                      background: idx === tripCourseIdx ? "rgba(77,168,98,0.1)" : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div style={resultIconStyle(s.courseLogoUrl)}>
                      {s.courseLogoUrl
                        ? <img src={cdnImage(s.courseLogoUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.6"><path d="M4 21h16M12 15V2"/></svg>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>{s.courseName}</div>
                      {(s.playDate || s.teeTime) && (
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(126,200,140,0.85)" }}>
                          {s.playDate ? new Date(s.playDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                          {s.playDate && s.teeTime ? " · " : ""}
                          {s.teeTime || ""}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* ── PLAYERS ──────────────────────────────────────────── */}
          <Section label={`Players · ${players.length}`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {players.map((p, i) => (
                <div key={p.userId} style={playerRowStyle}>
                  <div style={avatarStyle(p.avatarUrl)}>
                    {p.avatarUrl
                      ? <img src={cdnImage(p.avatarUrl)} alt={p.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.displayName}
                      {players.length === 2 && (
                        <span style={teamBadgeStyle}>Team {p.teamId}</span>
                      )}
                    </div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Handicap index</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setPlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, handicapIndex: Math.max(-10, Math.round((pl.handicapIndex - 0.1) * 10) / 10) } : pl));
                        setHandicapDrafts(d => { const n = { ...d }; delete n[p.userId]; return n; });
                      }}
                      style={stepperBtnStyle}
                    >−</button>
                    <input
                      type="number"
                      step="0.1"
                      // Show the draft when the user is mid-edit so the
                      // field can sit at "" without snapping back to 0.
                      // Otherwise show the committed number — but treat
                      // a fresh 0 as empty so new players land with a
                      // blank field instead of a stuck "0".
                      value={handicapDrafts[p.userId] !== undefined
                        ? handicapDrafts[p.userId]
                        : (p.handicapIndex === 0 ? "" : String(p.handicapIndex))}
                      onChange={e => setHandicapDrafts(d => ({ ...d, [p.userId]: e.target.value }))}
                      onBlur={() => {
                        const raw = handicapDrafts[p.userId];
                        if (raw === undefined) return;
                        const parsed = raw.trim() === "" ? 0 : Math.max(-10, Math.min(54, parseFloat(raw) || 0));
                        setPlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, handicapIndex: parsed } : pl));
                        setHandicapDrafts(d => { const n = { ...d }; delete n[p.userId]; return n; });
                      }}
                      placeholder="—"
                      style={{ width: 52, textAlign: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 0", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", outline: "none" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPlayers(prev => prev.map((pl, idx) => idx === i ? { ...pl, handicapIndex: Math.min(54, Math.round((pl.handicapIndex + 0.1) * 10) / 10) } : pl));
                        setHandicapDrafts(d => { const n = { ...d }; delete n[p.userId]; return n; });
                      }}
                      style={stepperBtnStyle}
                    >+</button>
                    {p.userId !== currentUserId && (
                      <button
                        type="button"
                        onClick={() => setPlayers(prev => prev.filter((_, idx) => idx !== i))}
                        style={{ marginLeft: 4, width: 26, height: 26, borderRadius: "50%", background: "rgba(200,60,60,0.1)", border: "1px solid rgba(200,60,60,0.25)", color: "rgba(220,100,100,0.9)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                        aria-label="Remove player"
                      >×</button>
                    )}
                  </div>
                </div>
              ))}

              {/* Add friend search */}
              <SearchInput
                placeholder="Add a friend by username or name"
                value={friendSearch}
                onChange={setFriendSearch}
              />
              {friendResults.length > 0 && (
                <div ref={friendResultsRef} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {friendResults.map(f => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setPlayers(prev => {
                          // Re-split A/B if we're going from 1 → 2 players.
                          const next: GamePlayer[] = [
                            ...prev,
                            {
                              userId: f.id,
                              displayName: f.displayName || f.username || "@?",
                              avatarUrl: f.avatarUrl,
                              handicapIndex: f.handicapIndex ?? 0,
                              teamId: "A",
                            },
                          ];
                          if (next.length === 2) next[1].teamId = "B";
                          return next;
                        });
                        setFriendSearch("");
                        setFriendResults([]);
                      }}
                      style={resultRowStyle}
                    >
                      <div style={avatarStyle(f.avatarUrl)}>
                        {f.avatarUrl
                          ? <img src={cdnImage(f.avatarUrl)} alt={f.displayName ?? f.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>{f.displayName || f.username}</div>
                        {f.displayName && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>@{f.username}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* ── GAME FORMAT ─────────────────────────────────────── */}
          <Section label="Game">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {GAME_FORMATS.map(f => {
                const selected = format === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    style={{
                      background: selected ? "rgba(77,168,98,0.15)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${selected ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 12,
                      padding: "10px 12px",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: selected ? "#4da862" : "#fff", marginBottom: 3 }}>{f.name}</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.35 }}>{f.desc}</div>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* ── STAKES (conditional on format) ─────────────────── */}
          {format === "nassau" && (
            <Section label="Stakes">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <StakeField label="Front 9" value={nassauFront} onChange={setNassauFront} />
                <StakeField label="Back 9" value={nassauBack} onChange={setNassauBack} />
                <StakeField label="Total" value={nassauTotal} onChange={setNassauTotal} />
              </div>
            </Section>
          )}
          {format === "skins" && (
            <Section label="Stakes">
              <StakeField label="$ per skin" value={skinsAmount} onChange={setSkinsAmount} />
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
                <input type="checkbox" checked={skinsCarry} onChange={e => setSkinsCarry(e.target.checked)} />
                Ties carry over to next hole
              </label>
            </Section>
          )}
          {format === "best_ball" && (
            <Section label="Stakes">
              <StakeField label="$ per team" value={teamWager} onChange={setTeamWager} />
            </Section>
          )}
          {(format === "closest_to_pin" || format === "longest_drive") && (
            <Section label="Holes & stake">
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>Pick the holes this game is played on.</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginBottom: 12 }}>
                {Array.from({ length: 18 }, (_, i) => i + 1).map(n => {
                  const picked = selectedHoles.includes(n);
                  return (
                    <button
                      key={n}
                      onClick={() => setSelectedHoles(prev => picked ? prev.filter(x => x !== n) : [...prev, n].sort((a, b) => a - b))}
                      style={{
                        height: 36,
                        borderRadius: 8,
                        background: picked ? "rgba(77,168,98,0.18)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${picked ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.08)"}`,
                        color: picked ? "#4da862" : "rgba(255,255,255,0.7)",
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >{n}</button>
                  );
                })}
              </div>
              <StakeField label="$ per hole (optional)" value={holeStake} onChange={setHoleStake} />
            </Section>
          )}
          {format === "match_play" && (
            <Section label="Stakes">
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                Match Play tracks holes won — no preset stake. Settle however you like after the round.
              </div>
            </Section>
          )}

          {error && (
            <div style={{ marginTop: 12, background: "rgba(200,60,60,0.12)", border: "1px solid rgba(200,60,60,0.3)", borderRadius: 10, padding: "10px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,120,120,0.9)" }}>
              {error}
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div style={{
          flexShrink: 0,
          padding: "12px 20px calc(16px + env(safe-area-inset-bottom))",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(180deg, rgba(13,35,24,0) 0%, #0d2318 30%)",
        }}>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: "100%",
              background: canSubmit ? "#2d7a42" : "rgba(77,168,98,0.25)",
              border: "none",
              borderRadius: 12,
              padding: "14px",
              fontFamily: "'Outfit', sans-serif",
              fontSize: 14,
              fontWeight: 700,
              color: "#fff",
              cursor: canSubmit ? "pointer" : "not-allowed",
              boxShadow: canSubmit ? "0 2px 14px rgba(45,122,66,0.4)" : "none",
            }}
          >
            {submitting ? "Creating…" : "Create Game"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small presentational helpers ──────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

// Custom-styled date / time input. iOS native chrome (the floating
// indicator pill) overflows the input bounds and bleeds into adjacent
// cells in a grid. We stack a visually-styled div under an invisible
// native input so taps still open the iOS picker but the rendering
// is fully under our control. Same approach as the trip-page
// DateField, adapted for in-component use.
function DateInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const display = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : placeholder;
  return (
    <div style={{ position: "relative", width: "100%", height: 44 }}>
      <div style={{ ...inputStyle, height: "100%", padding: "0 14px", display: "flex", alignItems: "center", color: value ? "#fff" : "rgba(255,255,255,0.42)" }}>
        {display}
      </div>
      <input type="date" value={value} onChange={e => onChange(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, border: 0, padding: 0, margin: 0, cursor: "pointer", background: "transparent", colorScheme: "dark", width: "100%", height: "100%" }} />
    </div>
  );
}

function TimeInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const display = value
    ? (() => {
        const [hh, mm] = value.split(":").map(Number);
        if (Number.isNaN(hh)) return placeholder;
        const period = hh >= 12 ? "PM" : "AM";
        const h12 = hh % 12 || 12;
        return `${h12}:${String(mm ?? 0).padStart(2, "0")} ${period}`;
      })()
    : placeholder;
  return (
    <div style={{ position: "relative", width: "100%", height: 44 }}>
      <div style={{ ...inputStyle, height: "100%", padding: "0 14px", display: "flex", alignItems: "center", color: value ? "#fff" : "rgba(255,255,255,0.42)" }}>
        {display}
      </div>
      <input type="time" value={value} onChange={e => onChange(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, border: 0, padding: 0, margin: 0, cursor: "pointer", background: "transparent", colorScheme: "dark", width: "100%", height: "100%" }} />
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ position: "relative" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 13px 11px 34px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }}
      />
    </div>
  );
}

function SelectedCoursePill({ course, onClear }: { course: CourseSearchRow; onClear: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(77,168,98,0.08)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 12, padding: "10px 12px" }}>
      <div style={resultIconStyle(course.logoUrl)}>
        {course.logoUrl
          ? <img src={cdnImage(course.logoUrl)} alt={course.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="1.6"><path d="M4 21h16M12 15V2"/></svg>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff" }}>{course.name}</div>
        {(course.city || course.state) && (
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{[course.city, course.state].filter(Boolean).join(", ")}</div>
        )}
      </div>
      <button onClick={onClear} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 18, cursor: "pointer", padding: 4 }} aria-label="Clear course">×</button>
    </div>
  );
}

function StakeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "0 10px" }}>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: "'Outfit', sans-serif", marginRight: 4 }}>$</span>
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ flex: 1, background: "transparent", border: "none", padding: "10px 0", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none", width: "100%" }}
        />
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  padding: "11px 13px",
  fontFamily: "'Outfit', sans-serif",
  fontSize: 14,
  color: "#fff",
  outline: "none",
  colorScheme: "dark",
};

const resultRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: "9px 12px",
  cursor: "pointer",
};

const playerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: "10px 12px",
};

function resultIconStyle(logoUrl: string | null | undefined): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 0,
    background: logoUrl ? "#fff" : "rgba(77,168,98,0.14)",
    border: "1px solid rgba(255,255,255,0.08)",
    overflow: "hidden",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

function avatarStyle(avatarUrl: string | null | undefined): React.CSSProperties {
  return {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: avatarUrl ? "transparent" : "rgba(77,168,98,0.18)",
    overflow: "hidden",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

const stepperBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.8)",
  fontSize: 16,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};

const teamBadgeStyle: React.CSSProperties = {
  marginLeft: 8,
  fontSize: 10,
  fontWeight: 700,
  color: "#4da862",
  background: "rgba(77,168,98,0.12)",
  border: "1px solid rgba(77,168,98,0.3)",
  borderRadius: 99,
  padding: "1px 7px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};
