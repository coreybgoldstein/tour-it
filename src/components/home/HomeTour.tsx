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

  const [nearMe, setNearMe] = useState<CourseLite[]>([]);
  const [nearMeRadius, setNearMeRadius] = useState<10 | 25 | 50>(50);
  const [locStatus, setLocStatus] = useState<"unknown" | "denied" | "granted" | "loading">("unknown");
  // True once a Near-Me query has actually completed at the current
  // (lat, lng, radius). Gates the "No courses found" empty-state so
  // it doesn't flash during the window between locStatus=granted and
  // the courses arriving from Supabase.
  const [nearMeQueried, setNearMeQueried] = useState(false);

  const [tour, setTour] = useState<ActiveTour | null>(null);
  const [tourLoaded, setTourLoaded] = useState(false);

  const [tripIdeas, setTripIdeas] = useState<TripIdea[]>([]);
  const [feedTeasers, setFeedTeasers] = useState<FeedTeaser[]>([]);

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
        if (!cancelled) { setTour(null); setTourLoaded(true); }
        return;
      }

      // 2) Trip + stops + members fanned out in parallel for ALL
      //    candidate tripIds. This was previously 4 sequential RTTs
      //    (trip → then stops+members → then courses+users) which
      //    pushed cold-start tour load to ~2s on cell. Now: 1 RTT
      //    for trip+stops+members (3 in parallel), then 1 RTT for
      //    courses+users (2 in parallel). Cold path is ~halved.
      const [{ data: trips }, { data: allStopRows }, { data: allMemberRows }] = await Promise.all([
        sb.from("GolfTrip")
          .select("id, name, startDate, endDate, arrivalAirport, lodging, lodgingCity, lodgingState, imageUrl")
          .in("id", tripIds)
          .or(`endDate.gte.${todayIso},endDate.is.null`)
          .order("startDate", { ascending: true, nullsFirst: false })
          .order("createdAt", { ascending: false })
          .limit(1),
        // Fetch stops + members for ALL candidate trips up front —
        // wasteful when the user is in many trips, but the typical
        // user is in 1-3 trips so the extra rows are negligible vs.
        // the round-trip latency saved.
        sb.from("GolfTripCourse")
          .select("tripId, courseId, playDate, teeTime, sortOrder")
          .in("tripId", tripIds)
          .order("sortOrder", { ascending: true }),
        sb.from("GolfTripMember")
          .select("tripId, userId")
          .in("tripId", tripIds),
      ]);
      const t = (trips ?? [])[0];
      if (!t) {
        if (!cancelled) { setTour(null); setTourLoaded(true); }
        return;
      }

      // Filter to just the rows belonging to the chosen trip.
      const stopRows = (allStopRows ?? []).filter((s: any) => s.tripId === t.id);
      const memberRows = (allMemberRows ?? []).filter((m: any) => m.tripId === t.id);

      const courseIds = Array.from(new Set(stopRows.map((s: any) => s.courseId).filter(Boolean)));
      const memberUserIds = Array.from(new Set(memberRows.map((m: any) => m.userId).filter(Boolean)));

      const [{ data: coursesRaw }, { data: usersRaw }] = await Promise.all([
        courseIds.length ? sb.from("Course").select("id, name, city, state, coverImageUrl, logoUrl, uploadCount").in("id", courseIds) : Promise.resolve({ data: [] as any[] }),
        memberUserIds.length ? sb.from("User").select("id, displayName, username, avatarUrl").in("id", memberUserIds) : Promise.resolve({ data: [] as any[] }),
      ]);

      const courseById = new Map((coursesRaw ?? []).map((c: any) => [c.id, c]));
      const userById = new Map((usersRaw ?? []).map((u: any) => [u.id, u]));

      const stops: Stop[] = (stopRows as any[])
        .map((s) => ({
          courseId: s.courseId,
          playDate: s.playDate,
          teeTime: s.teeTime,
          sortOrder: s.sortOrder,
          course: courseById.get(s.courseId),
        }))
        .filter((s) => s.course) as Stop[];

      const members: MemberLite[] = (memberRows as any[])
        .map((m) => {
          const u = userById.get(m.userId);
          if (!u) return null;
          return { userId: m.userId, displayName: u.displayName, username: u.username, avatarUrl: u.avatarUrl };
        })
        .filter(Boolean) as MemberLite[];

      // Choose the "next up" course — first stop whose playDate is
      // in the future (or has no playDate set). Falls back to first
      // stop overall.
      const next = stops.find((s: any) => !s.playDate || s.playDate >= todayIso) ?? stops[0] ?? null;

      if (!cancelled) {
        setTour({
          id: t.id,
          name: t.name,
          startDate: t.startDate,
          endDate: t.endDate,
          region: null,
          arrivalAirport: t.arrivalAirport,
          lodging: t.lodging,
          lodgingCity: (t as any).lodgingCity ?? null,
          lodgingState: (t as any).lodgingState ?? null,
          imageUrl: t.imageUrl,
          stops,
          members,
          nextStop: next,
        });
        setTourLoaded(true);
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
    setNearMe((data ?? []) as CourseLite[]);
    setNearMeQueried(true);
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
      <MayCompetitionBanner />

      <div style={{ padding: "6px 16px 0", maxWidth: isDesktop ? 720 : undefined, margin: isDesktop ? "0 auto" : undefined }}>

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
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 17, fontWeight: 800, letterSpacing: "0.01em" }}>
              Tour It All
            </span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 500, color: "rgba(126,200,140,0.7)", marginTop: 2, letterSpacing: "0.04em" }}>
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

        {/* Your Tour — section is suppressed entirely until the tour
            query has settled. User feedback: the shimmer skeleton
            flashed for 1-2s on cold cell connections and read as a
            "loading" state that shouldn't be there at all. Holding
            the section back means there's a brief moment with no
            YourTour content (label included), then the card or CTA
            snaps in — preferable to the shimmer. */}
        <section style={{ marginTop: 14, minHeight: tourLoaded ? undefined : 0 }}>
          {tourLoaded && <SectionLabel>Your Tour</SectionLabel>}

          {showTour && tour && (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.85fr) minmax(0, 1fr)", gap: 8 }}>
              <YourTourCard
                tour={tour}
                // ?createGame=1 → the trip page auto-opens the
                // CreateGameSheet on mount so users land directly in
                // the game-setup flow.
                onGame={() => router.push(`/trips/${tour.id}?createGame=1`)}
                onTrip={() => router.push(`/trips/${tour.id}`)}
                onStopTap={(id) => router.push(`/courses/${id}`)}
              />
              <PlanAnotherTile onClick={() => router.push("/tour?tab=trips")} />
            </div>
          )}

          {showCTA && (
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
  tour, onGame, onTrip, onStopTap,
}: {
  tour: ActiveTour;
  /** Opens the trip page with the game-creation sheet pre-opened. */
  onGame: () => void;
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
        background: "linear-gradient(160deg, #0e2418 0%, #0a1a11 100%)",
        border: "1px solid rgba(77,168,98,0.32)",
        borderRadius: 14,
        padding: "10px 12px 11px",
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        gap: 7,
        minWidth: 0,
        position: "relative",
      }}
    >
      {/* Top row: trip badge + UPCOMING TRIP / ROUND chip */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {tripBadge && (
          <div style={{ width: 26, height: 26, borderRadius: 6, background: "#fff", padding: 2, border: "1px solid rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tripBadge} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        )}
        <span style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: "italic",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(126,200,140,0.95)",
          padding: "3px 8px",
          borderRadius: 99,
          background: "rgba(77,168,98,0.12)",
          border: "1px solid rgba(77,168,98,0.3)",
          whiteSpace: "nowrap",
        }}>{tripContextLabel(tour)}</span>
      </div>

      {/* Title — forced single line (truncate with ellipsis) so the
          trip name never wraps and pushes the card height. */}
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 900, color: "#fff", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
        {tour.name}
      </div>

      {/* Meta line: date · location · golfers. Tiny icon prefixes
          keep this dense without an emoji vibe. */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "rgba(244,236,214,0.78)" }}>
        <CalendarMini /> <span>{dateLabel}</span>
        {locationLabel && (<>
          <Dot />
          <PinMini /> <span style={{ whiteSpace: "nowrap" }}>{locationLabel}</span>
        </>)}
        {tour.members.length > 0 && (<>
          <Dot />
          <UsersMini /> <span>{tour.members.length} {tour.members.length === 1 ? "golfer" : "golfers"}</span>
        </>)}
      </div>

      {/* Course-flag strip — course-logo badges, one per stop. Bigger
          now (44px from 32px) so each badge reads as a course-hero,
          not a tiny chip. Horizontal scroll handles 5+ stops; on a
          typical 375px iPhone ~4 fit in view with the scroll hint
          visible at the right edge. Tap → in-card popup with name +
          date; tap popup → routes to course profile. */}
      {tour.stops.length > 0 && (
        <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch", marginLeft: -2, marginRight: -2, paddingLeft: 2, paddingRight: 2 }}>
          {tour.stops.map((s, i) => {
            const isNext = next && s.courseId === next.courseId;
            const logo = s.course.logoUrl ? cdnImage(s.course.logoUrl) : null;
            return (
              <button
                key={s.courseId + "-" + i}
                onClick={() => setPopupIdx(popupIdx === i ? null : i)}
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
                aria-label={s.course.name}
                title={s.course.name}
              >
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 800, color: "#0c1c13" }}>
                    {initialsOf(s.course.name)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Action row — single primary CTA, one line. Compact icon +
          single line of copy ("Create a Game") so the cell fits in
          the constrained 2-col grid without wrapping. */}
      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 2 }}>
        <ActionCellSingle
          title="Create a Game"
          icon={<GameScorecardIcon color="#0c2218" />}
          onClick={onGame}
        />
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
                : <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 11, fontWeight: 800, color: "#0c1c13" }}>{initialsOf(popupStop.course.name)}</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {popupStop.course.name}
              </div>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(126,200,140,0.85)" }}>
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
// else fall back to the trip's startDate / "TBD". Adds a tee-time
// suffix when available.
function formatStopPlayLabel(stop: Stop, tour: ActiveTour): string {
  const iso = (stop as any).playDate || tour.startDate;
  if (!iso) return "Date TBD";
  const d = new Date(iso + "T00:00:00Z");
  const datePart = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
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
          <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(126,200,140,0.95)", marginBottom: 2 }}>
            Plan Another
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
            Round or Trip
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(244,236,214,0.65)", marginTop: 4, lineHeight: 1.3 }}>
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

// ─────────────────────────────────────────────────────────────────────
// PlannerCTA — empty state. Bundles "and line up the game" into the
// subtext so users discover Tee Up from the first touch. NOTE: the
// caller (HomeTour) already wraps this in its own <section> with a
// "Your Tour" SectionLabel — we render JUST the button here so the
// label doesn't double up.
// ─────────────────────────────────────────────────────────────────────
function PlannerCTA({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "18px 16px",
        background: "linear-gradient(135deg, rgba(45,122,66,0.95) 0%, rgba(77,168,98,0.82) 100%)",
        border: "1px solid rgba(77,168,98,0.55)",
        borderRadius: 16,
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 14,
        color: "#fff",
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(7,16,10,0.45)", border: "1px solid rgba(244,236,214,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <SparkleIcon />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: 19, lineHeight: 1.15, marginBottom: 3 }}>
          Plan your next round or trip
        </div>
        <div style={{ fontSize: 12, opacity: 0.88, lineHeight: 1.4 }}>
          Tell us your crew and dates. We&apos;ll build the tour and line up the game.
        </div>
      </div>
      <ChevronRight />
    </button>
  );
}

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
    <section style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <SectionLabel inline>Courses Near Me</SectionLabel>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {RADII.map((r) => (
            <button
              key={r}
              onClick={() => onChangeRadius(r)}
              style={{
                fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700,
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
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>
            Allow location to see courses within {radius} miles of you.
          </div>
          <button
            onClick={onEnable}
            disabled={locStatus === "loading"}
            style={{
              padding: "7px 14px", borderRadius: 99,
              background: "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.45)",
              fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#4da862",
              cursor: "pointer",
            }}
          >
            {locStatus === "loading" ? "Finding you…" : locStatus === "denied" ? "Try again" : "Enable location"}
          </button>
        </div>
      )}

      {locStatus === "granted" && queried && courses.length === 0 && (
        <div style={{ padding: "16px", background: "rgba(244,236,214,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
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
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.2, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {course.name}
        </div>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {[course.city, course.state].filter(Boolean).join(", ")}
        </div>
        {!!course.uploadCount && course.uploadCount > 0 && (
          <div style={{ marginTop: 6, display: "inline-block", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: "#4da862", background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.25)", borderRadius: 99, padding: "1px 8px" }}>
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
    <section style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <SectionLabel inline>Where to next?</SectionLabel>
        <button
          onClick={onBrowseAll}
          style={{ background: "transparent", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#4da862", cursor: "pointer", letterSpacing: "0.02em" }}
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
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
                  {i.name}
                </div>
              </div>
            </div>
            <div style={{ padding: "9px 11px 11px", fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
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
    <section style={{ marginTop: 14, marginBottom: 8 }}>
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
                    <img src={t.courseLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 3 }} />
                  ) : (
                    <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 13, fontWeight: 700, color: "#4da862", letterSpacing: "0.04em" }}>
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
                  fontFamily: "'Outfit', sans-serif",
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
                    fontFamily: "'Outfit', sans-serif",
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
  return (
    <div style={{
      fontFamily: "'Playfair Display', serif",
      fontStyle: "italic",
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: "0.14em",
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
      fontFamily: "'Outfit', sans-serif",
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
          fontFamily: "'Playfair Display', serif",
          fontStyle: "italic",
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: isPrimary ? "rgba(7,16,10,0.7)" : SAGE,
          marginBottom: 1,
        }}>{label}</div>
        <div style={{
          fontFamily: "'Outfit', sans-serif",
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
        padding: "10px 12px",
        background: "#4da862",
        border: "1px solid rgba(126,200,140,0.7)",
        borderRadius: 3,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
        minHeight: 40,
      }}
    >
      <div style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{
        flex: 1, textAlign: "left",
        fontFamily: "'Outfit', sans-serif",
        fontSize: 13.5, fontWeight: 800,
        color: "#0a1a10",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        letterSpacing: "0.01em",
      }}>{title}</div>
    </button>
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
          <div style={{ width: 86, height: 86, borderRadius: 16, background: "rgba(244,236,214,0.06)", border: "1px solid rgba(244,236,214,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: "rgba(244,236,214,0.7)", letterSpacing: "0.05em" }}>
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
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.65)" }}>
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
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#4da862", textTransform: "uppercase" }}>
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

function formatNextUpDate(tour: ActiveTour, next: Stop | null): string {
  // Prefer the trip's startDate, fall back to "soon" for trips with
  // no dates yet (welcome flow never completed).
  const iso = tour.startDate || (next as any)?.playDate || null;
  if (!iso) return "Soon";
  const d = new Date(iso + "T00:00:00Z");
  const dateStr = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  // Append tee time when the "next up" stop has one set. Format
  // "HH:MM" → "h:mm AM/PM" so 07:30 → "7:30 AM". The teeTime column
  // is a free-form string, so we only format when it matches HH:MM.
  const tee = (next as any)?.teeTime as string | null | undefined;
  if (tee) {
    const m = tee.match(/^(\d{1,2}):(\d{2})/);
    if (m) {
      let hh = parseInt(m[1], 10);
      const mm = m[2];
      const ampm = hh >= 12 ? "PM" : "AM";
      hh = hh % 12 || 12;
      return `${dateStr} · ${hh}:${mm} ${ampm}`;
    }
    // Non-HH:MM strings — show as-is.
    return `${dateStr} · ${tee}`;
  }
  return dateStr;
}

function tripContextLabel(tour: ActiveTour): string {
  // Single label both states share — user feedback: "get ride of
  // #stops, that area should say upcoming trip". Round is still
  // labeled separately because the UX is different (1 course, 1
  // round, single day).
  return tour.stops.length <= 1 ? "Round" : "Upcoming Trip";
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
