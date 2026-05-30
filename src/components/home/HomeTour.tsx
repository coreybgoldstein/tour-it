"use client";

// HomeTour — Concept A. The home as a closed-loop surface.
//
// Three jobs in priority order:
//   1. See golf courses (Search + Courses Near Me)
//   2. Get excited about your next round (Your Tour module)
//   3. Plan your next trip/round (Where to next? rail)
//
// Layout, top → bottom:
//   - TourItTopBar  (existing — hamburger, wordmark, trophy)
//   - MayCompetitionBanner  (preserved — still earns its slot)
//   - Search bar  → routes to /search
//   - Courses Near Me horizontal rail
//   - Your Tour module
//       · State 1 (tour exists): hero photo of NEXT course, group avatars,
//         tee time, stop-chip strip showing the trip's other courses,
//         action row (Scout the holes · Set up the game)
//       · State 2 (no tour): Plan-your-next-round CTA with explicit
//         "and line up the game" promise
//   - Where to next? — horizontal rail of 4-6 trip ideas from the catalog
//   - Tour the Feed tease — recent-clip thumbnails
//   - BottomNav
//
// All icons are custom green-stroke SVGs. No emojis. No "closed loop"
// label in the UI itself — the loop is felt through the actions, not
// shown as a strip.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { cdnImage } from "@/lib/cdnImage";
import BottomNav from "@/components/BottomNav";
// NOTE: TourItTopBar is rendered globally by src/app/layout.tsx — do
// NOT render it here or the page ends up with a doubled bar.
import MayCompetitionBanner from "@/components/MayCompetitionBanner";
import PlannerCTA from "@/components/PlannerCTA";
import { gameFormatLabel } from "@/lib/gameFormats";
import { airportByCode } from "@/data/airports";
import { readPermission, readCoords, requestLocation } from "@/lib/locationPermission";

type CourseLite = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  coverImageUrl: string | null;
  logoUrl: string | null;
  uploadCount?: number;
};

type MemberLite = {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
};

type Stop = { courseId: string; sortOrder: number; course: CourseLite; playDate?: string | null; teeTime?: string | null };

type ActiveTour = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  region: string | null;
  arrivalAirport: string | null;
  lodging: string | null;
  lodgingCity: string | null;
  lodgingState: string | null;
  /** User-uploaded trip cover photo (fallback when the course
   *  doesn't have its own coverImageUrl). */
  imageUrl: string | null;
  stops: Stop[];
  members: MemberLite[];
  /** First stop with a future or null playDate — the "next up" course. */
  nextStop: Stop | null;
  /** Most-recent game attached to this trip (null = no game yet).
   *  When set the YourTour card surfaces a game-tease chip the user
   *  can tap to land directly on the game sheet, and the create-
   *  another-game CTA shrinks to a small "+ game" pill. */
  game: { id: string; format: string; courseId: string; courseName: string; formatConfig: Record<string, unknown> | null } | null;
  /** Total game count for the trip — used to badge the "+ N games"
   *  variant of the add-another CTA. */
  gameCount: number;
};

type TripIdea = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  heroImageUrl: string | null;
  region: string;
  durationDays: number;
  costBand: string;
};

type FeedTeaser = {
  id: string;
  courseId: string;
  courseName: string;
  courseLogo: string | null;
  thumbnail: string | null;
  shotType: string | null;
  holeNumber: number | null;
};

const RADII = [10, 25, 50] as const;
const SITE_BG = "#07100a";
// Two sage tints — the bright one for section labels (was too dim
// before; user said "can't see the gray"), the muted one for tertiary
// metadata.
const SAGE_BRIGHT = "rgba(244,236,214,0.92)";
const SAGE = "rgba(244,236,214,0.6)";
const GOLD = "#d4a017";

export default function HomeTour() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [userId, setUserId] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  // Initial state for each section reads from localStorage cache
  // FIRST (instant render of last-known-good data), then the same
  // useEffects below fire a fresh query and update. SWR-style. On a
  // user's second+ visit, every section paints immediately with the
  // previous values while the fresh fetch happens in the background.
  // First-time visitors see the empty state until the first fetch
  // resolves — same as before.
  const [nearMe, setNearMe] = useState<CourseLite[]>(() => readCache<CourseLite[]>("nearMe") ?? []);
  const [nearMeRadius, setNearMeRadius] = useState<10 | 25 | 50>(50);
  const [locStatus, setLocStatus] = useState<"unknown" | "denied" | "granted" | "loading">("unknown");
  const [nearMeQueried, setNearMeQueried] = useState(() => (readCache<CourseLite[]>("nearMe")?.length ?? 0) > 0);

  const [tours, setTours] = useState<ActiveTour[]>(() => readCache<ActiveTour[]>("tours") ?? []);
  const tour = tours[0] ?? null;
  const [tourLoaded, setTourLoaded] = useState(() => readCache<ActiveTour[]>("tours") != null);

  const [tripIdeas, setTripIdeas] = useState<TripIdea[]>(() => readCache<TripIdea[]>("tripIdeas") ?? []);
  const [feedTeasers, setFeedTeasers] = useState<FeedTeaser[]>(() => readCache<FeedTeaser[]>("feedTeasers") ?? []);

  // ── Auth ───────────────────────────────────────────────────────────
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setAuthResolved(true);
    });
  }, []);

  // ── Active tour ────────────────────────────────────────────────────
  // Find the user's next upcoming GolfTrip — the soonest one whose
  // endDate hasn't passed yet. Members count too (not just creators)
  // because a buddy who got invited to Bethpage Saturday should also
  // see "Your Tour" at the top.
  //
  // 3-step query (memberships → trip → stops+members). A single
  // inner-join query LOOKED like a win for round-trip count but the
  // !inner filter on the embedded GolfTripMember table behaved
  // inconsistently and returned no trips at all on real prod data —
  // reverted to this conservative sequential pattern that ships.
  useEffect(() => {
    // CRITICAL: do NOT setTourLoaded(true) while auth is still
    // resolving. Earlier this branch did `if (!authResolved || !userId)
    // { setTourLoaded(true); return; }` which flipped tourLoaded=true
    // on the very first render — before auth even completed — and
    // the page briefly rendered the "Plan your next round" CTA before
    // the real tour data arrived. Now we only mark tourLoaded after
    // auth resolves AND we know the user is logged out. Logged-in
    // users keep tourLoaded=false until the query returns.
    if (!authResolved) return;
    if (!userId) { setTourLoaded(true); return; }
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const todayIso = new Date().toISOString().slice(0, 10);

      // 1) Trips the user belongs to (creator OR member). The creator
      //    also has a membership row, so this catches both.
      const { data: memberships } = await sb
        .from("GolfTripMember")
        .select("tripId")
        .eq("userId", userId);
      const tripIds = (memberships ?? []).map((m: any) => m.tripId);
      if (tripIds.length === 0) {
        if (!cancelled) { setTours([]); setTourLoaded(true); writeCache("tours", []); }
        return;
      }

      // 2) Trip + stops + members + games fanned out in parallel for
      //    ALL candidate tripIds. The trip query now fetches ALL
      //    upcoming trips (no .limit(1)) because YourTour is a
      //    scrolling carousel showing every upcoming trip the user
      //    is part of, not just the soonest.
      const [{ data: trips }, { data: allStopRows }, { data: allMemberRows }, { data: allGameRows }] = await Promise.all([
        sb.from("GolfTrip")
          .select("id, name, startDate, endDate, arrivalAirport, lodging, lodgingCity, lodgingState, imageUrl")
          .in("id", tripIds)
          .or(`endDate.gte.${todayIso},endDate.is.null`)
          .order("startDate", { ascending: true, nullsFirst: false })
          .order("createdAt", { ascending: false }),
        sb.from("GolfTripCourse")
          .select("tripId, courseId, playDate, teeTime, sortOrder")
          .in("tripId", tripIds)
          .order("sortOrder", { ascending: true }),
        sb.from("GolfTripMember")
          .select("tripId, userId")
          .in("tripId", tripIds),
        // Games: pull most-recent-first so [0] for a tripId is the
        // newest game (the one we surface in the trip-card tease).
        sb.from("TripGame")
          .select("id, tripId, format, formatConfig, courseId, courseName, createdAt")
          .in("tripId", tripIds)
          .order("createdAt", { ascending: false }),
      ]);
      const tripsArr = (trips ?? []) as any[];
      if (tripsArr.length === 0) {
        if (!cancelled) { setTours([]); setTourLoaded(true); writeCache("tours", []); }
        return;
      }

      const courseIds = Array.from(new Set((allStopRows ?? []).map((s: any) => s.courseId).filter(Boolean)));
      const memberUserIds = Array.from(new Set((allMemberRows ?? []).map((m: any) => m.userId).filter(Boolean)));

      const [{ data: coursesRaw }, { data: usersRaw }] = await Promise.all([
        courseIds.length ? sb.from("Course").select("id, name, city, state, coverImageUrl, logoUrl, uploadCount").in("id", courseIds) : Promise.resolve({ data: [] as any[] }),
        memberUserIds.length ? sb.from("User").select("id, displayName, username, avatarUrl").in("id", memberUserIds) : Promise.resolve({ data: [] as any[] }),
      ]);

      const courseById = new Map((coursesRaw ?? []).map((c: any) => [c.id, c]));
      const userById = new Map((usersRaw ?? []).map((u: any) => [u.id, u]));

      const builtTours: ActiveTour[] = tripsArr.map((t: any) => {
        const stopRows = (allStopRows ?? []).filter((s: any) => s.tripId === t.id);
        const memberRows = (allMemberRows ?? []).filter((m: any) => m.tripId === t.id);
        const gameRows = (allGameRows ?? []).filter((g: any) => g.tripId === t.id);

        const stops: Stop[] = stopRows
          .map((s: any) => ({
            courseId: s.courseId,
            playDate: s.playDate,
            teeTime: s.teeTime,
            sortOrder: s.sortOrder,
            course: courseById.get(s.courseId),
          }))
          .filter((s: any) => s.course) as Stop[];

        const members: MemberLite[] = memberRows
          .map((m: any) => {
            const u = userById.get(m.userId);
            if (!u) return null;
            return { userId: m.userId, displayName: u.displayName, username: u.username, avatarUrl: u.avatarUrl };
          })
          .filter(Boolean) as MemberLite[];

        const next = stops.find((s: any) => !s.playDate || s.playDate >= todayIso) ?? stops[0] ?? null;
        const newestGame = gameRows[0];

        return {
          id: t.id,
          name: t.name,
          startDate: t.startDate,
          endDate: t.endDate,
          region: null,
          arrivalAirport: t.arrivalAirport,
          lodging: t.lodging,
          lodgingCity: t.lodgingCity ?? null,
          lodgingState: t.lodgingState ?? null,
          imageUrl: t.imageUrl,
          stops,
          members,
          nextStop: next,
          game: newestGame ? { id: newestGame.id, format: newestGame.format, courseId: newestGame.courseId, courseName: newestGame.courseName, formatConfig: newestGame.formatConfig ?? null } : null,
          gameCount: gameRows.length,
        };
      });

      if (!cancelled) {
        setTours(builtTours);
        setTourLoaded(true);
        writeCache("tours", builtTours);
      }
    })();
    return () => { cancelled = true; };
  }, [authResolved, userId]);

  // ── Trip ideas (Where to next?) ────────────────────────────────────
  // Cheap query — the curated catalog is ~41 itineraries total, so we
  // fetch the whole list and JS-filter for in-season + sample 6. The
  // previous PostgREST .or(...) with a column-to-column comparison
  // (bestSeasonStart.gt.bestSeasonEnd) silently returned no rows.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data } = await sb
        .from("TripItinerary")
        .select("id, slug, name, tagline, heroImageUrl, region, durationDays, costBand, bestSeasonStart, bestSeasonEnd")
        .limit(60);
      if (cancelled || !data) return;
      const m = new Date().getMonth() + 1;
      // In-season check that handles year-wraparound (e.g. Nov-Apr).
      const inSeason = (start: number, end: number) =>
        start <= end ? (m >= start && m <= end) : (m >= start || m <= end);
      const seasonal = (data as any[]).filter((it) => inSeason(it.bestSeasonStart, it.bestSeasonEnd));
      const pool = seasonal.length >= 6 ? seasonal : (data as any[]);
      const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 6);
      setTripIdeas(shuffled as TripIdea[]);
      writeCache("tripIdeas", shuffled);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Feed tease ─────────────────────────────────────────────────────
  // Recent approved clips — 5 thumbnails at the bottom of the home.
  // Fetches the uploads first, then batches course + hole lookups so
  // we don't depend on a FK-join name that may not exist. The prior
  // version's `course:Course!Upload_courseId_fkey(name)` silently
  // returned null on prod which made the whole rail render-skip.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data: uploads } = await sb
        .from("Upload")
        .select("id, courseId, cloudflareVideoId, mediaUrl, mediaType, shotType, holeId")
        .eq("moderationStatus", "APPROVED")
        .order("createdAt", { ascending: false })
        .limit(8);
      if (cancelled || !uploads) return;

      const courseIds = Array.from(new Set(uploads.map((u: any) => u.courseId).filter(Boolean)));
      const holeIds = Array.from(new Set(uploads.map((u: any) => u.holeId).filter(Boolean)));
      const [{ data: courses }, { data: holes }] = await Promise.all([
        courseIds.length ? sb.from("Course").select("id, name, logoUrl").in("id", courseIds) : Promise.resolve({ data: [] }),
        holeIds.length ? sb.from("Hole").select("id, holeNumber").in("id", holeIds) : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;

      const courseById = new Map((courses ?? []).map((c: any) => [c.id, { name: c.name as string, logoUrl: c.logoUrl as string | null }]));
      const holeById = new Map((holes ?? []).map((h: any) => [h.id, h.holeNumber as number]));

      const teasers: FeedTeaser[] = (uploads as any[]).map((u) => {
        const c = u.courseId ? courseById.get(u.courseId) : null;
        return {
          id: u.id,
          courseId: u.courseId,
          courseName: c?.name || "Unknown",
          courseLogo: c?.logoUrl ? cdnImage(c.logoUrl) : null,
          thumbnail: u.cloudflareVideoId
            ? `https://videodelivery.net/${u.cloudflareVideoId}/thumbnails/thumbnail.jpg?time=1s&width=240`
            : cdnImage(u.mediaUrl),
          shotType: u.shotType,
          holeNumber: (u.holeId && holeById.get(u.holeId)) ?? null,
        };
      });
      setFeedTeasers(teasers);
      writeCache("feedTeasers", teasers);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Near Me ────────────────────────────────────────────────────────
  // We use the same proven pattern as the legacy home: navigator
  // Geolocation flow uses the shared lib/locationPermission helpers
  // so the rule "once granted, always granted" holds across the home,
  // /tour, and the map. localStorage-backed; coords are silently
  // refreshed on mount when permission was previously granted, so
  // first-time-per-session users don't see an enable prompt twice.
  useEffect(() => {
    const perm = readPermission();
    if (perm === "granted") {
      // Use cached coords immediately for an instant render…
      const cached = readCoords();
      if (cached) {
        setLocStatus("granted");
        fetchNearByCoords(cached.lat, cached.lng, nearMeRadius);
      }
      // …then quietly refresh from the browser in the background so
      // moving / changing location keeps results fresh.
      requestLocation().then((coords) => {
        if (coords) { setLocStatus("granted"); fetchNearByCoords(coords.lat, coords.lng, nearMeRadius); }
      });
    } else if (perm === "denied") {
      setLocStatus("denied");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enableLocation() {
    setLocStatus("loading");
    const coords = await requestLocation();
    if (coords) {
      setLocStatus("granted");
      fetchNearByCoords(coords.lat, coords.lng, nearMeRadius);
    } else {
      setLocStatus("denied");
    }
  }

  async function fetchNearByCoords(lat: number, lng: number, miles: number) {
    const sb = createClient();
    const deg = miles / 69;
    const lngDeg = deg / Math.cos((lat * Math.PI) / 180);
    const { data } = await sb
      .from("Course")
      .select("id, name, city, state, coverImageUrl, logoUrl, uploadCount, latitude, longitude")
      .gte("latitude", lat - deg).lte("latitude", lat + deg)
      .gte("longitude", lng - lngDeg).lte("longitude", lng + lngDeg)
      .order("uploadCount", { ascending: false, nullsFirst: false })
      .order("name", { ascending: true })
      .limit(20);
    const list = (data ?? []) as CourseLite[];
    setNearMe(list);
    setNearMeQueried(true);
    writeCache("nearMe", list);
  }

  function changeRadius(r: 10 | 25 | 50) {
    setNearMeRadius(r);
    if (locStatus !== "granted") return;
    const cached = readCoords();
    if (cached) {
      // Reset queried so the empty-state copy is suppressed while
      // the new-radius query is in flight.
      setNearMeQueried(false);
      fetchNearByCoords(cached.lat, cached.lng, r);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────
  const showCTA = tourLoaded && !tour;
  const showTour = tourLoaded && !!tour;

  // No full-page block here — the home shell (banner + search + Near
  // Me + section labels + FeedTease) renders immediately so the user
  // gets visual content within one paint. Each section handles its
  // own loading state inline:
  //   - Your Tour: TourSkeleton while !tourLoaded
  //   - Near Me: empty rail + "Enable location" prompt
  //   - Tour the Feed: section hidden when teasers empty
  // The earlier "wait for tourLoaded before painting anything"
  // gate showed the user a dark screen for ~2s on real cell
  // connections — worse than the brief skeleton it was suppressing.

  return (
    <main style={{ minHeight: "100dvh", background: SITE_BG, color: "#fff", paddingBottom: 140, paddingLeft: isDesktop ? 72 : 0 }}>
      {/* Tour It typography system v2 — Source Serif 4 (editorial)
          + Inter (UI). Both loaded once via next/font in layout.tsx,
          no per-page @import. */}

      <MayCompetitionBanner />

      <div style={{ padding: "12px 16px 0", maxWidth: isDesktop ? 720 : undefined, margin: isDesktop ? "0 auto" : undefined }}>

        {/* Unified entry — routes to /tour with the Smart (LLM)
            tab pre-selected. "Tour It All" plays on the brand and
            signals the unified scope (courses + trips). Bolder
            italic-serif copy reads as a hero CTA, not a form input. */}
        <button
          onClick={() => router.push("/tour")}
          aria-label="Tour It All"
          style={{
            width: "100%",
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(7,30,15,0.85)",
            border: "1px solid rgba(77,168,98,0.55)",
            borderRadius: 12,
            padding: "11px 16px",
            cursor: "pointer",
            color: "#4da862",
            boxShadow: "0 0 0 1px rgba(77,168,98,0.2), 0 0 18px rgba(77,168,98,0.18)",
          }}
        >
          <SearchIcon />
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.1 }}>
            <span style={{ fontFamily: "'Source Serif 4', serif", fontSize: 17, fontWeight: 800, letterSpacing: "0.01em" }}>
              Tour It All
            </span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, fontWeight: 500, color: "rgba(126,200,140,0.7)", marginTop: 2, letterSpacing: "0.04em" }}>
              courses · holes · trips · golfers
            </span>
          </span>
        </button>

        {/* Courses Near Me */}
        <NearMeRail
          courses={nearMe}
          radius={nearMeRadius}
          onChangeRadius={changeRadius}
          locStatus={locStatus}
          onEnable={enableLocation}
          onMap={() => router.push("/map")}
          onCourse={(id) => router.push(`/courses/${id}`)}
          queried={nearMeQueried}
        />

        {/* Your Tour — horizontal scrolling rail of upcoming trips +
            a final Plan-Another card. The previous 2-col grid only
            ever showed the soonest trip; user feedback: "it should
            be a scrolling [rail] so you can see everything you have
            lined up with the last being plan another title".
            Section is suppressed entirely until tour query has
            settled to avoid skeleton flash. */}
        <section style={{ marginTop: 10, minHeight: tourLoaded ? undefined : 0 }}>
          {tourLoaded && <SectionLabel>Your Tour</SectionLabel>}

          {tourLoaded && tours.length > 0 && (
            // alignItems: stretch (the flex-row default) lets each
            // card wrapper take the height of the tallest sibling;
            // setting height:100% on every wrapper + every inner
            // card guarantees the visual heights are identical even
            // when content differs (multi-stop trip vs single round
            // vs plan-another).
            <div style={{ display: "flex", alignItems: "stretch", gap: 8, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch", marginRight: -16, paddingRight: 16, scrollSnapType: "x proximity" }}>
              {tours.map((t) => (
                <div key={t.id} style={{ flexShrink: 0, scrollSnapAlign: "start", width: 296, display: "flex" }}>
                  <YourTourCard
                    tour={t}
                    // ?createGame=1 → the trip page auto-opens the
                    // CreateGameSheet on mount so users land directly
                    // in the game-setup flow.
                    onGame={() => router.push(`/trips/${t.id}?createGame=1`)}
                    onOpenGame={(gameId) => router.push(`/trips/${t.id}?game=${gameId}`)}
                    onTrip={() => router.push(`/trips/${t.id}`)}
                    onStopTap={(id) => router.push(`/courses/${id}`)}
                  />
                </div>
              ))}
              <div style={{ flexShrink: 0, scrollSnapAlign: "start", width: 178, display: "flex" }}>
                <PlanAnotherTile onClick={() => router.push("/tour?tab=trips")} />
              </div>
            </div>
          )}

          {tourLoaded && tours.length === 0 && (
            <PlannerCTA onClick={() => router.push("/tour?tab=trips")} />
          )}
        </section>

        {/* (Where-to-next moved to /tour bottom 2026-05-29 so the home
            stays focused on the active loop. Trip inspiration now lives
            on the dedicated tour page.) */}

        {/* Tour the Feed — feed-style rail at the bottom of the home.
            Tap a thumbnail → opens the dedicated /feed/[uploadId]
            page (full-screen vertical clip feed, scroll-snap to the
            tapped clip, swipe up/down to navigate through). */}
        <FeedTease teasers={feedTeasers} onTap={(uploadId) => router.push(`/feed/${uploadId}`)} />
      </div>

      <BottomNav />
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────
// YourTourCard — compact (no giant hero). Title, meta line with date +
// location + golfer count, a row of course-flag badges, and the
// Scout/Tee-Up action pair. Designed to sit in a 2-col grid alongside
// PlanAnotherTile, not full-width.
// ─────────────────────────────────────────────────────────────────────
function YourTourCard({
  tour, onGame, onOpenGame, onTrip, onStopTap,
}: {
  tour: ActiveTour;
  /** Opens the trip page with the game-creation sheet pre-opened. */
  onGame: () => void;
  /** Opens the trip page deep-linked to the named game's sheet. */
  onOpenGame: (gameId: string) => void;
  onTrip: () => void;
  /** Show a hover/tap popup for the stop's course details, instead of
   *  routing immediately. The actual route-to-course-profile happens
   *  inside the popup when the user taps it. */
  onStopTap: (courseId: string) => void;
}) {
  const next = tour.nextStop;
  const tripBadge = tour.imageUrl ? cdnImage(tour.imageUrl) : null;
  const dateLabel = useMemo(() => formatNextUpDate(tour, next), [tour, next]);
  const locationLabel = useMemo(() => locationForTour(tour), [tour]);
  // Open course-popup state — null when no flag is selected, else the
  // index in tour.stops. Stays on the home (per user request: "still
  // remain on Homescreen") — popup floats inside this card.
  const [popupIdx, setPopupIdx] = useState<number | null>(null);
  const popupStop = popupIdx != null ? tour.stops[popupIdx] : null;

  return (
    <button
      onClick={onTrip}
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(160deg, #0f2719 0%, #08160e 100%)",
        border: "1px solid rgba(77,168,98,0.3)",
        borderRadius: 16,
        padding: 14,
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
        position: "relative",
        boxShadow: "0 6px 18px rgba(0,0,0,0.32), inset 0 1px 0 rgba(126,200,140,0.08)",
      }}
    >
      {/* ── Header row ───────────────────────────────────────────────
          Trip cover image (or logo) + ROUND / TRIP chip + the
          "+ add a game" affordance pinned top-right. Right padding
          on the row reserves the corner for that absolute button. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 40 }}>
        {tripBadge ? (
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fff", padding: 2.5, border: "1px solid rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tripBadge} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.45)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CalendarMini />
          </div>
        )}
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(126,200,140,0.95)",
          padding: "3px 9px",
          borderRadius: 99,
          background: "rgba(77,168,98,0.12)",
          border: "1px solid rgba(77,168,98,0.3)",
          whiteSpace: "nowrap",
        }}>{tripContextLabel(tour)}</span>
      </div>

      {/* "+ game" pinned top-right. Scorecard glyph + tiny corner
          plus dot — affordance reads as "add a game" specifically. */}
      <button
        onClick={(e) => { e.stopPropagation(); onGame(); }}
        aria-label="Add a game"
        title="Add a game"
        style={{
          position: "absolute", top: 11, right: 11, zIndex: 2,
          width: 36, height: 32, padding: 0,
          background: "rgba(7,16,10,0.6)",
          border: "1px solid rgba(77,168,98,0.5)",
          borderRadius: 9,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <GameScorecardIcon color="#7ed28b" />
        <div style={{ position: "absolute", top: -5, right: -5, width: 15, height: 15, borderRadius: "50%", background: "#7ed28b", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #0a1a10" }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#0c1c13" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
      </button>

      {/* ── Title ────────────────────────────────────────────────────
          Source Serif 4 display, single line ellipsis. Trip name is
          the editorial heart of the card so it gets the most weight. */}
      <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 18, fontWeight: 700, fontVariationSettings: "'opsz' 60", color: "#fff", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, letterSpacing: "-0.005em" }}>
        {tour.name}
      </div>

      {/* ── Meta block ───────────────────────────────────────────────
          Two clean lines. Row 1 = date (+ tee time for rounds).
          Row 2 = location + golfer count. Both Inter, light sage. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: "rgba(244,236,214,0.82)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
          <CalendarMini /> {dateLabel}
        </span>
        {(locationLabel || tour.members.length > 0) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            {locationLabel && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0, overflow: "hidden", flex: "0 1 auto" }}>
                <PinMini />
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{locationLabel}</span>
              </span>
            )}
            {locationLabel && tour.members.length > 0 && <Dot />}
            {tour.members.length > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", flexShrink: 0 }}>
                <UsersMini /> {tour.members.length}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Hairline separator ──────────────────────────────────────
          A very subtle horizontal line gives the badge row its own
          visual zone without feeling boxy. */}
      <div style={{ height: 1, background: "linear-gradient(to right, transparent 0%, rgba(126,200,140,0.18) 20%, rgba(126,200,140,0.18) 80%, transparent 100%)", marginTop: 1 }} />

      {/* ── Course badges ───────────────────────────────────────────
          The heart of the card — these are the courses the user is
          playing. 4-5 visible on a typical trip card width with the
          5th+ scrolling. The "next up" badge gets a gold ring + soft
          glow so it reads as the active stop. */}
      {tour.stops.length > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ display: "flex", gap: 7, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 2, marginLeft: -2, marginRight: -2, paddingLeft: 2, paddingRight: 2 }}
        >
          {tour.stops.map((s, i) => (
            <FlagBadge
              key={s.courseId + "-" + i}
              stop={s}
              isNext={!!(next && s.courseId === next.courseId)}
              onTap={() => setPopupIdx(popupIdx === i ? null : i)}
            />
          ))}
        </div>
      )}

      {/* ── Game CTA — full-width ──────────────────────────────────
          When a game exists: a dark green chip showing "Game Ready"
          + format/stakes — tap opens that game sheet.
          When none: gradient green Create-a-Game pill. Same height
          and visual weight either way so the card balance stays. */}
      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: "auto", paddingTop: 2 }}>
        {tour.game ? (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenGame(tour.game!.id); }}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "linear-gradient(180deg, rgba(77,168,98,0.22) 0%, rgba(77,168,98,0.12) 100%)",
              border: "1px solid rgba(77,168,98,0.55)",
              borderRadius: 10,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 10,
              minHeight: 44,
              textAlign: "left",
              boxShadow: "inset 0 1px 0 rgba(126,200,140,0.15)",
            }}
          >
            <div style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(126,200,140,0.18)", border: "1px solid rgba(126,200,140,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <GameScorecardIcon color="#7ed28b" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(126,200,140,0.95)" }}>
                {tour.gameCount > 1 ? `${tour.gameCount} Games · Latest` : "Game Ready"}
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "0.005em" }}>
                {(() => {
                  const name = gameFormatLabel(tour.game.format);
                  const stakes = gameStakesLabel(tour.game.format, tour.game.formatConfig);
                  return stakes ? `${name} · ${stakes}` : name;
                })()}
              </div>
            </div>
            <ChevronRightSage />
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onGame(); }}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "linear-gradient(180deg, #5cbd75 0%, #3f9554 100%)",
              border: "1px solid rgba(126,200,140,0.85)",
              borderRadius: 10,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 10,
              minHeight: 44,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 0 rgba(0,0,0,0.18)",
            }}
          >
            <div style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(7,16,10,0.18)", border: "1px solid rgba(7,16,10,0.24)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <GameScorecardIcon color="#0c2218" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 800, color: "#0a1a10", letterSpacing: "0.04em", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                CREATE A GAME
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9.5, fontWeight: 600, color: "rgba(10,26,16,0.65)", marginTop: 1, letterSpacing: "0.04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Format · stakes · strokes
              </div>
            </div>
            <ChevronRightDark />
          </button>
        )}
      </div>

      {/* Course popup — floating card anchored above the flag strip.
          Closes when tapped outside (the card's own onClick will
          re-trigger onTrip, so we stop-propagation on the inner). */}
      {popupStop && (
        <div
          onClick={(e) => { e.stopPropagation(); setPopupIdx(null); }}
          style={{ position: "absolute", inset: 0, zIndex: 6, background: "transparent" }}
        >
          <div
            onClick={(e) => { e.stopPropagation(); onStopTap(popupStop.courseId); setPopupIdx(null); }}
            style={{
              position: "absolute",
              left: 12, right: 12,
              top: "50%", transform: "translateY(-50%)",
              padding: "10px 12px",
              background: "rgba(7,16,10,0.96)",
              border: "1px solid rgba(77,168,98,0.45)",
              borderRadius: 12,
              boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
              display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer",
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#fff", border: "1px solid rgba(255,255,255,0.5)", padding: 3, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
              {popupStop.course.logoUrl
                ? <img src={cdnImage(popupStop.course.logoUrl)!} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <span style={{ fontFamily: "'Source Serif 4', serif", fontSize: 11, fontWeight: 800, color: "#0c1c13" }}>{initialsOf(popupStop.course.name)}</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {popupStop.course.name}
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(126,200,140,0.85)" }}>
                {formatStopPlayLabel(popupStop, tour)}
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </div>
        </div>
      )}
    </button>
  );
}

// Tap-popup playLabel — if the stop has its own playDate use that,
// else fall back to the trip's startDate / "TBD". Suffixed with the
// stop's tee time when set (per-stop times are what the popup is
// for — the multi-stop trip header itself shows only the date
// window with no time).
function formatStopPlayLabel(stop: Stop, tour: ActiveTour): string {
  const iso = (stop as any).playDate || tour.startDate;
  if (!iso) return "Date TBD";
  const d = new Date(iso + "T00:00:00Z");
  const datePart = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const tee = (stop as any).teeTime as string | null | undefined;
  if (tee) {
    const formatted = formatTeeTime(tee);
    return formatted ? `${datePart} · ${formatted}` : `${datePart} · ${tee}`;
  }
  return datePart;
}

// ─────────────────────────────────────────────────────────────────────
// PlanAnotherTile — vertical companion card to the right of YourTour.
// Always present alongside an active trip so the next-trip prompt
// stays visible. Skinny but tall to match the YourTour card height.
// ─────────────────────────────────────────────────────────────────────
function PlanAnotherTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "linear-gradient(165deg, #1c4425 0%, #0c2117 55%, #05140a 100%)",
        border: "1px solid rgba(77,168,98,0.4)",
        borderRadius: 14,
        padding: "12px 10px",
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 8,
        minWidth: 0,
        overflow: "hidden",
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
      }}
    >
      {/* Decorative travel-route illustration in the background —
          three dots connected by a curving path, suggesting a
          multi-stop journey. Replaces the "AI star" glyph the user
          didn't love. */}
      <svg
        aria-hidden
        viewBox="0 0 120 168"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.18, pointerEvents: "none" }}
      >
        <defs>
          <linearGradient id="plan-route" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7ed28b" stopOpacity="0" />
            <stop offset="40%" stopColor="#7ed28b" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#d4a017" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <path d="M 12 150 C 30 130, 25 90, 55 80 C 85 70, 95 40, 110 18" stroke="url(#plan-route)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeDasharray="2 5" />
        <circle cx="12" cy="150" r="3.5" fill="#7ed28b" />
        <circle cx="55" cy="80" r="3.5" fill="#7ed28b" />
        <circle cx="110" cy="18" r="4.5" fill="#d4a017" stroke="#fff" strokeWidth="1" />
      </svg>

      {/* Foreground content sits above the route illustration */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", gap: 8 }}>
        {/* Tour It pin — the brand mark. Bigger now (52px from 38px)
            and anchored hard against the top-left of the tile so it
            reads as a corner medallion, not a centered glyph. The
            negative margins pull it slightly outside the tile's
            padding bounds, snug into the corner like a sticker. */}
        <div style={{ width: 52, height: 52, marginTop: -2, marginLeft: -2, display: "flex", alignItems: "flex-start", justifyContent: "flex-start" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tour-it-pin.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.55))" }} />
        </div>
        <div>
          <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(126,200,140,0.95)", marginBottom: 2 }}>
            Plan Another
          </div>
          <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
            Round or Trip
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(244,236,214,0.65)", marginTop: 4, lineHeight: 1.3 }}>
            Where to next?
          </div>
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TourSkeleton — matches the shape of YourTourCard + PlanAnotherTile
// so the page rhythm stays stable while the trip query resolves.
// ─────────────────────────────────────────────────────────────────────
function TourSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.85fr) minmax(0, 1fr)", gap: 8 }}>
      <div style={{
        height: 168,
        borderRadius: 14,
        background: "linear-gradient(110deg, rgba(255,255,255,0.04) 35%, rgba(77,168,98,0.08) 50%, rgba(255,255,255,0.04) 65%)",
        backgroundSize: "200% 100%",
        animation: "tourit-shimmer 1.4s linear infinite",
        border: "1px solid rgba(255,255,255,0.05)",
      }} />
      <div style={{
        height: 168,
        borderRadius: 14,
        background: "linear-gradient(110deg, rgba(255,255,255,0.03) 35%, rgba(77,168,98,0.06) 50%, rgba(255,255,255,0.03) 65%)",
        backgroundSize: "200% 100%",
        animation: "tourit-shimmer 1.4s linear infinite",
        border: "1px dashed rgba(255,255,255,0.06)",
      }} />
      <style>{`@keyframes tourit-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
    </div>
  );
}

// PlannerCTA moved to @/components/PlannerCTA so it can be shared
// across HomeTour, /tour (under the search bar), and /tee-up footers.
// Imported via the top-of-file import.

// ─────────────────────────────────────────────────────────────────────
// NearMeRail — horizontal scrolling row of nearby courses + radius
// segmented control + Map shortcut.
// ─────────────────────────────────────────────────────────────────────
function NearMeRail({
  courses, radius, onChangeRadius, locStatus, onEnable, onMap, onCourse, queried,
}: {
  courses: CourseLite[];
  radius: 10 | 25 | 50;
  onChangeRadius: (r: 10 | 25 | 50) => void;
  locStatus: "unknown" | "denied" | "granted" | "loading";
  onEnable: () => void;
  onMap: () => void;
  onCourse: (id: string) => void;
  /** True after a Near-Me fetch has actually completed. Gates the
   *  empty-state copy so it doesn't flash before the response. */
  queried: boolean;
}) {
  return (
    <section style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <SectionLabel inline>Courses Near Me</SectionLabel>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {RADII.map((r) => (
            <button
              key={r}
              onClick={() => onChangeRadius(r)}
              style={{
                fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600,
                padding: "4px 9px",
                borderRadius: 99,
                border: `1px solid ${radius === r ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.1)"}`,
                background: radius === r ? "rgba(77,168,98,0.15)" : "transparent",
                color: radius === r ? "#4da862" : "rgba(255,255,255,0.4)",
                cursor: "pointer",
                letterSpacing: "0.04em",
              }}
            >{r}MI</button>
          ))}
          <button
            onClick={onMap}
            style={{
              marginLeft: 6,
              width: 26, height: 26, borderRadius: "50%",
              background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
            aria-label="Open map"
          >
            <MapIcon />
          </button>
        </div>
      </div>

      {locStatus !== "granted" && (
        <div style={{ padding: "12px 14px", background: "rgba(244,236,214,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>
            Allow location to see courses within {radius} miles of you.
          </div>
          <button
            onClick={onEnable}
            disabled={locStatus === "loading"}
            style={{
              padding: "7px 14px", borderRadius: 99,
              background: "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.45)",
              fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700, color: "#4da862",
              cursor: "pointer",
            }}
          >
            {locStatus === "loading" ? "Finding you…" : locStatus === "denied" ? "Try again" : "Enable location"}
          </button>
        </div>
      )}

      {locStatus === "granted" && queried && courses.length === 0 && (
        <div style={{ padding: "16px", background: "rgba(244,236,214,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
          No courses found within {radius} miles. Try a wider radius.
        </div>
      )}

      {locStatus === "granted" && courses.length > 0 && (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch", marginRight: -16, paddingRight: 16 }}>
          {courses.slice(0, 12).map((c) => (
            <NearCourseCard key={c.id} course={c} onClick={() => onCourse(c.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function NearCourseCard({ course, onClick }: { course: CourseLite; onClick: () => void }) {
  const cover = course.coverImageUrl ? cdnImage(course.coverImageUrl) : null;
  const logo = course.logoUrl ? cdnImage(course.logoUrl) : null;
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 160,
        background: "#0c1c13",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        overflow: "hidden",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3" }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={course.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(160deg, rgba(45,122,66,0.4), rgba(7,16,10,0.9))" }} />
        )}
        {logo && (
          <div style={{ position: "absolute", top: 8, left: 8, width: 30, height: 30, borderRadius: 6, background: "#fff", border: "1px solid rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: 3 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        )}
      </div>
      <div style={{ padding: "9px 10px 11px" }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {course.name}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {[course.city, course.state].filter(Boolean).join(", ")}
        </div>
        {!!course.uploadCount && course.uploadCount > 0 && (
          <div style={{ marginTop: 6, display: "inline-block", fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, color: "#4da862", background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.25)", borderRadius: 99, padding: "1px 8px" }}>
            {course.uploadCount} {course.uploadCount === 1 ? "clip" : "clips"}
          </div>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// WhereToNext — horizontal rail of trip ideas pulled from the catalog.
// Carries job #3 (plan-inspiration) into BOTH states (tour exists OR
// not) so the home screen always has a seed for the next move.
// ─────────────────────────────────────────────────────────────────────
function WhereToNext({ ideas, onIdea, onBrowseAll }: { ideas: TripIdea[]; onIdea: (slug: string) => void; onBrowseAll: () => void }) {
  if (ideas.length === 0) return null;
  return (
    <section style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <SectionLabel inline>Where to next?</SectionLabel>
        <button
          onClick={onBrowseAll}
          style={{ background: "transparent", border: "none", fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: "#4da862", cursor: "pointer", letterSpacing: "0.02em" }}
        >
          Browse all →
        </button>
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch", marginRight: -16, paddingRight: 16 }}>
        {ideas.map((i) => (
          <button
            key={i.slug}
            onClick={() => onIdea(i.slug)}
            style={{
              flexShrink: 0,
              width: 220,
              background: "#0c1c13",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              overflow: "hidden",
              padding: 0,
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9" }}>
              {i.heroImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cdnImage(i.heroImageUrl)} alt={i.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "linear-gradient(160deg, rgba(45,122,66,0.4), rgba(7,16,10,0.9))" }} />
              )}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, rgba(7,16,10,0.85))" }} />
              <div style={{ position: "absolute", left: 8, top: 8 }}>
                <Badge variant="ghost">{i.region}</Badge>
              </div>
              <div style={{ position: "absolute", right: 8, top: 8 }}>
                <Badge variant="ghost">{i.durationDays}D · {i.costBand}</Badge>
              </div>
              <div style={{ position: "absolute", left: 10, bottom: 8, right: 10 }}>
                <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
                  {i.name}
                </div>
              </div>
            </div>
            <div style={{ padding: "9px 11px 11px", fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {i.tagline}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// FeedTease — bottom rail of recent clip thumbnails.
// ─────────────────────────────────────────────────────────────────────
function FeedTease({ teasers, onTap }: { teasers: FeedTeaser[]; onTap: (uploadId: string) => void }) {
  if (teasers.length === 0) return null;
  return (
    <section style={{ marginTop: 10, marginBottom: 8 }}>
      <div style={{ marginBottom: 8 }}>
        <SectionLabel>Tour the Feed</SectionLabel>
      </div>
      {/* Card sizing + border match HomeClassic.feed-peek-card
          exactly — the user wanted "the same style with overlay as
          before we made all these renovations". 96px wide, 9:16
          aspect, hairline green border, no drop shadow. */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch", marginRight: -16, paddingRight: 16 }}>
        {teasers.map((t) => {
          const initials = t.courseName
            .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");
          const shotLabel = t.shotType ? t.shotType.replace(/_/g, " ").toUpperCase() : null;
          return (
            <button
              key={t.id}
              onClick={() => onTap(t.id)}
              style={{
                flexShrink: 0,
                width: 96,
                aspectRatio: "9 / 16",
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid rgba(26,158,66,0.18)",
                padding: 0,
                background: "rgba(10,28,18,0.95)",
                position: "relative",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {t.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
              {/* Triple-stop gradient: dark top so the badge floats; mid
                  clear so the thumbnail breathes; dark bottom so the
                  course name + shot-type read on any image. */}
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to bottom, rgba(7,16,10,0.78) 0%, rgba(7,16,10,0.0) 32%, rgba(7,16,10,0.0) 52%, rgba(7,16,10,0.96) 100%)",
              }} />

              {/* Upper third — course badge. Big square that reads as
                  "this is THE course" the way a baseball-card badge
                  reads as the team. Centered horizontally. */}
              <div style={{
                position: "absolute", left: 0, right: 0, top: 6, display: "flex", justifyContent: "center",
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: t.courseLogo ? "rgba(255,255,255,0.96)" : "rgba(10,28,18,0.96)",
                  border: "0.5px solid rgba(255,255,255,0.55)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
                }}>
                  {t.courseLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    // Inner img gets its own borderRadius so logos with
                    // dark backgrounds (e.g. Coyote Moon's black bg)
                    // don't reveal hard square corners against the
                    // white badge frame.
                    <img src={t.courseLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 3, borderRadius: 5 }} />
                  ) : (
                    <span style={{ fontFamily: "'Source Serif 4', serif", fontSize: 13, fontWeight: 800, color: "#4da862", letterSpacing: "0.04em" }}>
                      {initials || "TI"}
                    </span>
                  )}
                </div>
              </div>

              {/* Centered play disc */}
              <div style={{
                position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
                width: 28, height: 28, borderRadius: "50%",
                background: "rgba(77,168,98,0.92)",
                border: "1px solid rgba(255,255,255,0.85)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
              }}>
                <PlayIcon />
              </div>

              {/* Bottom block — course name under the play button, shot
                  type below. */}
              <div style={{ position: "absolute", left: 6, right: 6, bottom: 6, textAlign: "center" }}>
                <div style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 10.5, fontWeight: 800, color: "#fff",
                  lineHeight: 1.1,
                  overflow: "hidden", textOverflow: "ellipsis",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  textShadow: "0 1px 4px rgba(0,0,0,0.6)",
                }}>
                  {t.courseName}
                </div>
                {(t.holeNumber || shotLabel) && (
                  <div style={{
                    marginTop: 3,
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 8.5, fontWeight: 700, color: "#7ee098",
                    letterSpacing: "0.08em",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {t.holeNumber ? `HOLE ${t.holeNumber}` : ""}
                    {t.holeNumber && shotLabel ? " · " : ""}
                    {shotLabel || ""}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Small primitives — labels, badges, action cells, avatars, icons.
// ─────────────────────────────────────────────────────────────────────

function SectionLabel({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  // Editorial section label — Source Serif 4 italic, the magazine
  // department-tag feel ("The Cut", "Lookbook", "Where to Next").
  // Optical sizing tuned for headers, generous tracking.
  return (
    <div style={{
      fontFamily: "'Source Serif 4', serif",
      fontStyle: "italic",
      fontSize: 14,
      fontWeight: 700,
      fontVariationSettings: "'opsz' 32",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: SAGE_BRIGHT,
      marginBottom: inline ? 0 : 10,
    }}>
      {children}
    </div>
  );
}

function Badge({ children, variant }: { children: React.ReactNode; variant: "solid" | "ghost" }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      fontFamily: "'Inter', sans-serif",
      fontSize: 9.5,
      fontWeight: 800,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      padding: "3px 8px",
      borderRadius: 99,
      color: variant === "solid" ? "#0a1a10" : "rgba(244,236,214,0.85)",
      background: variant === "solid" ? "rgba(126,200,140,0.92)" : "rgba(7,16,10,0.7)",
      border: variant === "solid" ? "1px solid rgba(126,200,140,0.95)" : "1px solid rgba(244,236,214,0.18)",
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function ActionCell({ label, title, icon, variant, onClick }: {
  label: string; title: string; icon: React.ReactNode;
  variant: "primary" | "ghost";
  onClick: () => void;
}) {
  const isPrimary = variant === "primary";
  return (
    <button
      onClick={onClick}
      style={{
        padding: "9px 10px 10px",
        background: isPrimary ? "#4da862" : "rgba(244,236,214,0.025)",
        border: isPrimary ? "1px solid rgba(126,200,140,0.7)" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: 3,
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 8,
        minHeight: 52,
        minWidth: 0,
      }}
    >
      <div style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Source Serif 4', serif",
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: isPrimary ? "rgba(7,16,10,0.7)" : SAGE,
          marginBottom: 1,
        }}>{label}</div>
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 13,
          fontWeight: 700,
          color: isPrimary ? "#0a1a10" : "#fff",
          lineHeight: 1.15,
          // Wrap is allowed — short copy ("Create a game", "The holes")
          // looked great on iPhone Pro Max but clipped on smaller
          // screens once the YourTour card sat in a 2-col grid with
          // PlanAnother. wrap > ellipsis here.
        }}>{title}</div>
      </div>
    </button>
  );
}

// ActionCellSingle — single-line variant of ActionCell. Used for the
// Tee Up "Create a Game" CTA on YourTourCard. No stacked "TEE UP"
// label above the title; just icon + one line of copy, centered on
// the cross axis so the row stays short. Keeps the same primary
// pill aesthetic.
// FlagBadge — 44px course-logo square used inside YourTourCard.
// Factored out so the standalone strip (multi-stop trips) and the
// inline-with-action-row variant (single round) render identically.
function FlagBadge({ stop, isNext, onTap }: { stop: Stop; isNext: boolean; onTap: () => void }) {
  const logo = stop.course.logoUrl ? cdnImage(stop.course.logoUrl) : null;
  return (
    <button
      onClick={onTap}
      style={{
        flexShrink: 0,
        width: 44, height: 44,
        borderRadius: 9,
        background: "#fff",
        border: isNext ? `2px solid ${GOLD}` : "1px solid rgba(255,255,255,0.55)",
        padding: 3,
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        cursor: "pointer",
        position: "relative",
        boxShadow: isNext ? "0 0 8px rgba(212,160,23,0.35)" : "0 1px 2px rgba(0,0,0,0.25)",
      }}
      aria-label={stop.course.name}
      title={stop.course.name}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : (
        <span style={{ fontFamily: "'Source Serif 4', serif", fontSize: 13, fontWeight: 800, color: "#0c1c13" }}>
          {initialsOf(stop.course.name)}
        </span>
      )}
    </button>
  );
}

function ActionCellSingle({ title, icon, onClick }: {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        height: "100%",
        padding: "8px 12px",
        // Gradient + subtle inset highlight reads as a "premium pill"
        // rather than a flat fill, so the Create-a-Game step on
        // YourTour gets the inviting moment it deserves. Height
        // matches the game-ready chip (44px) so the two states
        // align visually whether or not a game has been created.
        background: "linear-gradient(180deg, #5cbd75 0%, #3f9554 100%)",
        border: "1px solid rgba(126,200,140,0.85)",
        borderRadius: 10,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: 44,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 0 rgba(0,0,0,0.18)",
      }}
    >
      <div style={{
        width: 24, height: 24, borderRadius: 6,
        background: "rgba(7,16,10,0.16)",
        border: "1px solid rgba(7,16,10,0.22)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 13.5, fontWeight: 800,
          color: "#0a1a10",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          letterSpacing: "0.01em",
          lineHeight: 1.1,
        }}>{title}</div>
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 9.5, fontWeight: 600,
          color: "rgba(10,26,16,0.62)",
          marginTop: 1,
          letterSpacing: "0.05em",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>Pick a format · auto strokes</div>
      </div>
      <ChevronRightDark />
    </button>
  );
}

function ChevronRightSage() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7ed28b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ChevronRightDark() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0a1a10" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.55 }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// Visual fallback when the next course has no coverImageUrl. Uses a
// topographic-line SVG pattern + a centered logo (or course initials)
// so the hero never reads as an empty placeholder.
function FairwayPlaceholder({ logo, courseName }: { logo: string | null; courseName: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(145deg, #1c4425 0%, #0c2117 60%, #050d08 100%)", overflow: "hidden" }}>
      {/* Topographic fairway lines — abstract, golf-coded */}
      <svg width="100%" height="100%" viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, opacity: 0.22 }}>
        <defs>
          <linearGradient id="fairway-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4da862" stopOpacity="0" />
            <stop offset="50%" stopColor="#7ed28b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#4da862" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0,1,2,3,4,5,6,7,8].map((i) => (
          <path
            key={i}
            d={`M -20 ${30 + i * 24} C 80 ${20 + i * 24}, 220 ${50 + i * 24}, 420 ${30 + i * 24}`}
            stroke="url(#fairway-line)"
            strokeWidth={i === 4 ? 1.8 : 1}
            fill="none"
          />
        ))}
      </svg>
      {/* Centered logo OR initials medallion */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {logo ? (
          <div style={{ width: 88, height: 88, borderRadius: 16, background: "#fff", padding: 10, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.6)", boxShadow: "0 6px 24px rgba(0,0,0,0.45)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        ) : (
          <div style={{ width: 86, height: 86, borderRadius: 16, background: "rgba(244,236,214,0.06)", border: "1px solid rgba(244,236,214,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Source Serif 4', serif", fontSize: 32, fontWeight: 800, color: "rgba(244,236,214,0.7)", letterSpacing: "0.05em" }}>
            {initialsOf(courseName)}
          </div>
        )}
      </div>
    </div>
  );
}

function initialsOf(name: string): string {
  const words = name.replace(/[^a-zA-Z\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "TI";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function AvatarStack({ members }: { members: MemberLite[] }) {
  if (members.length === 0) {
    return <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.3)" }} />;
  }
  return (
    <div style={{ display: "flex" }}>
      {members.slice(0, 4).map((m, i) => (
        <div key={m.userId} style={{
          width: 28, height: 28, borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid #0c1c13",
          background: "rgba(77,168,98,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginLeft: i > 0 ? -8 : 0,
          zIndex: members.length - i,
          flexShrink: 0,
        }}>
          {m.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cdnImage(m.avatarUrl)} alt={m.displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.65)" }}>
              {(m.displayName || m.username || "?").charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function PulsingHint() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#4da862", textTransform: "uppercase" }}>
      <style>{`@keyframes tourit-hint-pulse { 0%,100% { transform: translateY(0); opacity:1 } 50% { transform: translateY(-2px); opacity:0.5 } }`}</style>
      Swipe up
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "tourit-hint-pulse 1.6s ease-in-out infinite" }}>
        <polyline points="6 15 12 9 18 15" />
      </svg>
    </span>
  );
}

// ─── Icons (all custom green-stroke SVGs — no emojis) ────────────────

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function MapIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6" />
      <line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}
function PinFlagIcon({ color = "#4da862" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="21" />
      <path d="M6 4 L18 7 L6 10 Z" fill={color} stroke="none" />
    </svg>
  );
}
// Scorecard + pencil — lifted from /tee-up so the Play-a-Game intent
// reads identically across surfaces (user feedback: the icons should
// match). Pencil sits diagonal across the lower-right corner.
function ScorecardPencilIcon({ color = "#4da862" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="13" height="16" rx="2" />
      <line x1="6.5" y1="8" x2="12.5" y2="8" />
      <line x1="6.5" y1="11.5" x2="12.5" y2="11.5" />
      <line x1="6.5" y1="15" x2="10" y2="15" />
      <path d="M15.5 17.5 L19 14 L21 16 L17.5 19.5 L14.8 20.2 Z" />
    </svg>
  );
}

// GameScorecardIcon — scorecard for the Create-a-Game CTA.
// Inspired by a real handicap scorecard (rows = players, cols =
// holes, dots = strokes received). At 24px we can't fit a real
// 18-hole grid, so we abstract:
//   - Rounded card outline
//   - Horizontal divider lines splitting it into 3 player rows
//   - Filled dots in cells indicating "strokes received" — the
//     visual hook that says "this is the game side, not just a
//     blank scorecard"
//   - A small pencil tucked into the corner so it still reads as
//     "fill me in / start a round"
// Stroke pattern: row1 gets 2 dots, row2 gets 1 dot, row3 gets 3
// dots — a deliberately uneven distribution that reads as
// "competitive handicapping" rather than a tidy template.
function GameScorecardIcon({ color = "#4da862" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {/* Card body */}
      <rect x="2.5" y="4" width="14" height="16" rx="1.8" />
      {/* Player-row dividers */}
      <line x1="2.5" y1="9.3" x2="16.5" y2="9.3" />
      <line x1="2.5" y1="14.6" x2="16.5" y2="14.6" />
      {/* Left column gutter (the "Player" label column on a real
          card) — a single vertical line distinguishes the name
          column from the hole columns. */}
      <line x1="6" y1="4" x2="6" y2="20" />
      {/* Handicap stroke dots — filled, no stroke, so they pop. */}
      <circle cx="9" cy="6.6" r="0.9" fill={color} stroke="none" />
      <circle cx="13" cy="6.6" r="0.9" fill={color} stroke="none" />
      <circle cx="11" cy="11.95" r="0.9" fill={color} stroke="none" />
      <circle cx="9" cy="17.3" r="0.9" fill={color} stroke="none" />
      <circle cx="12" cy="17.3" r="0.9" fill={color} stroke="none" />
      <circle cx="15" cy="17.3" r="0.9" fill={color} stroke="none" />
      {/* Pencil — diagonal across the lower-right corner, leaning
          into the card so it reads as "fill me in". */}
      <path d="M16 17 L19.5 13.5 L21.5 15.5 L18 19 L15.4 19.6 Z" />
      <line x1="19.5" y1="13.5" x2="21.5" y2="15.5" />
    </svg>
  );
}
function BinocularsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="15" r="4" /><circle cx="18" cy="15" r="4" />
      <path d="M10 15 L14 15" />
      <path d="M5 11 L4 4 L8 4 L7 11" /><path d="M19 11 L20 4 L16 4 L17 11" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 L13.5 10.5 L21 12 L13.5 13.5 L12 21 L10.5 13.5 L3 12 L10.5 10.5 Z" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.85 }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft: 1 }}>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}
function CalendarMini() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(126,200,140,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function PinMini() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(126,200,140,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function UsersMini() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(126,200,140,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function Dot() {
  return <span style={{ width: 2, height: 2, borderRadius: "50%", background: "rgba(244,236,214,0.35)", display: "inline-block", margin: "0 1px" }} />;
}

// ─── Helpers ──────────────────────────────────────────────────────────

// Build the "money at stake" label shown inside the game-tease chip.
// User feedback: instead of "Nassau · Hampshire" the chip should
// surface the wager amounts because that's the meaningful preview of
// what the game is actually for. Returns null when the format has no
// monetary preview (e.g. closest-to-pin); caller falls back to the
// format name in that case.
//
// Examples:
//   nassau   { frontAmount: 25, backAmount: 25, totalAmount: 50 }   → "$25/$25/$50"
//   skins    { skinsAmount: 5 }                                     → "$5/skin"
//   best_ball{ wager: 50 }                                          → "$50/team"
function gameStakesLabel(format: string, cfg: Record<string, unknown> | null): string | null {
  if (!cfg) return null;
  const num = (k: string): number | null => {
    const v = cfg[k];
    if (v == null) return null;
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
  };
  const dollars = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(0)}`;
  if (format === "nassau") {
    const front = num("frontAmount");
    const back = num("backAmount");
    const total = num("totalAmount");
    if (front == null && back == null && total == null) return null;
    return [front, back, total].map((v) => v == null ? "—" : dollars(v)).join("/");
  }
  if (format === "skins") {
    const amt = num("skinsAmount");
    return amt != null ? `${dollars(amt)}/skin` : null;
  }
  if (format === "best_ball") {
    const amt = num("wager");
    return amt != null ? `${dollars(amt)}/team` : null;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// HomeTour cache — last-known-good values for each section persisted to
// localStorage so the second-visit render paints instantly with the
// previous values. Fresh data still fetches in the background and
// replaces what's on screen when it arrives.
//
// Entries expire after 24h to avoid stale "your tour" cards lingering
// after a trip was deleted or edited from another device. Reads are
// safe-guarded against parse errors so bad cache entries don't crash
// the page.
// ─────────────────────────────────────────────────────────────────────

const CACHE_PREFIX = "tourit-home-cache:";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; data: T };
    if (Date.now() - parsed.ts > CACHE_MAX_AGE_MS) return null;
    return parsed.data;
  } catch { return null; }
}

function writeCache<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

function formatNextUpDate(tour: ActiveTour, next: Stop | null): string {
  // Multi-stop trips: show the trip's window (start — end date), NO
  // time. The single tee-time of a specific stop isn't meaningful on
  // a multi-day trip where every stop has its own time.
  // Single rounds: show date + tee time. The course-flag popup
  // surfaces date+time per stop on multi-stop trips.
  const isMultiStop = tour.stops.length > 1;

  if (isMultiStop && tour.startDate) {
    const start = new Date(tour.startDate + "T00:00:00Z");
    const end = tour.endDate ? new Date(tour.endDate + "T00:00:00Z") : null;
    const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    if (end && tour.endDate !== tour.startDate) {
      // Same-month range collapses to "Aug 20 — 23"; cross-month
      // keeps both labels for clarity ("Aug 30 — Sep 2").
      const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
      const endStr = sameMonth
        ? String(end.getUTCDate())
        : end.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      return `${startStr} — ${endStr}`;
    }
    return startStr;
  }

  // Single round (≤1 stop) — date + tee time when set.
  const iso = tour.startDate || (next as any)?.playDate || null;
  if (!iso) return "Soon";
  const d = new Date(iso + "T00:00:00Z");
  const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  const tee = (next as any)?.teeTime as string | null | undefined;
  if (tee) {
    const formatted = formatTeeTime(tee);
    return formatted ? `${dateStr} · ${formatted}` : `${dateStr} · ${tee}`;
  }
  return dateStr;
}

/** "07:30" → "7:30 AM", "13:00" → "1:00 PM". Returns null when the
 *  input isn't in HH:MM form so callers can fall back to the raw
 *  string. Shared between YourTourCard's meta line and the
 *  course-flag popup. */
function formatTeeTime(tee: string): string | null {
  const m = tee.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  const mm = m[2];
  const ampm = hh >= 12 ? "PM" : "AM";
  hh = hh % 12 || 12;
  return `${hh}:${mm} ${ampm}`;
}

function tripContextLabel(tour: ActiveTour): string {
  // Single label both states share — user feedback: "get ride of
  // #stops, that area should say upcoming trip". Round is still
  // labeled separately because the UX is different (1 course, 1
  // round, single day).
  return tour.stops.length <= 1 ? "Round" : "Trip";
}

// Derive a single human-readable location for the tour. Priority:
//   1. Lodging text — user explicitly typed WHERE they're staying.
//      If the dropdown picker auto-formatted the value as
//      "Property Name — City, ST", we strip back to just "City, ST"
//      so the chip stays compact. Otherwise we show the raw text.
//   2. Stops — city/state of attached courses (real trips with
//      courses picked).
//   3. Airport state — final fallback. Only the state code (e.g. "MI"),
//      not the city, since the airport's city ("Traverse City") often
//      misleads when the user is actually staying somewhere else
//      (Boyne, Harbor Springs, etc.).
function locationForTour(tour: ActiveTour): string {
  // Top priority — structured lodging city/state captured when the
  // user picked from the LodgingField dropdown. Saturates the chip
  // with a clean "Boyne, MI" without parsing display strings.
  if (tour.lodgingCity || tour.lodgingState) {
    return [tour.lodgingCity, tour.lodgingState].filter(Boolean).join(", ");
  }
  if (tour.lodging && tour.lodging.trim()) {
    const cityState = parseCityStateFromLodging(tour.lodging);
    if (cityState) return cityState;
    return tour.lodging.trim();
  }
  const stops = tour.stops;
  if (stops.length > 0) {
    const cities = new Set(stops.map((s) => s.course.city).filter(Boolean) as string[]);
    const states = new Set(stops.map((s) => s.course.state).filter(Boolean) as string[]);
    if (cities.size === 1) {
      const c = stops[0].course;
      return c.city ? `${c.city}${c.state ? ", " + c.state : ""}` : (c.state ?? "");
    }
    if (states.size === 1) return stops[0].course.state ?? "";
    return stops[0].course.state ?? "";
  }
  if (tour.arrivalAirport) {
    const a = airportByCode(tour.arrivalAirport);
    if (a) return a.state;
  }
  return "";
}

// LodgingField formats picks as "Property — City, ST". Strip back
// to the trailing "City, ST" when present so the tour chip shows
// the location, not the property name.
function parseCityStateFromLodging(raw: string): string | null {
  const m = raw.match(/—\s*([^—]+?,\s*[A-Z]{2})\s*$/);
  return m ? m[1].trim() : null;
}
