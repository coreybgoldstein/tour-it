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
import TourItTopBar from "@/components/TourItTopBar";
import MayCompetitionBanner from "@/components/MayCompetitionBanner";

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

type Stop = { courseId: string; sortOrder: number; course: CourseLite };

type ActiveTour = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  region: string | null;
  arrivalAirport: string | null;
  lodging: string | null;
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
  thumbnail: string | null;
  shotType: string | null;
  holeNumber: number | null;
};

const RADII = [10, 25, 50] as const;
const SITE_BG = "#07100a";
const SAGE = "rgba(244,236,214,0.55)";
const GOLD = "#d4a017";

export default function HomeTour() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [userId, setUserId] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  const [nearMe, setNearMe] = useState<CourseLite[]>([]);
  const [nearMeRadius, setNearMeRadius] = useState<10 | 25 | 50>(50);
  const [locStatus, setLocStatus] = useState<"unknown" | "denied" | "granted" | "loading">("unknown");

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
  useEffect(() => {
    if (!authResolved || !userId) { setTourLoaded(true); return; }
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const todayIso = new Date().toISOString().slice(0, 10);

      // 1) Trips the user belongs to (creator OR member). We use the
      //    membership table as the source — the creator also has a
      //    membership row inserted at create-time.
      const { data: memberships } = await sb
        .from("GolfTripMember")
        .select("tripId")
        .eq("userId", userId);
      const tripIds = (memberships ?? []).map((m: any) => m.tripId);
      if (tripIds.length === 0) {
        if (!cancelled) { setTour(null); setTourLoaded(true); }
        return;
      }

      // 2) Among those, find the soonest active one — endDate >= today
      //    OR endDate is null (no dates set yet) so brand-new trips
      //    without a welcome-flow-completed range still surface.
      const { data: trips } = await sb
        .from("GolfTrip")
        .select("id, name, startDate, endDate, arrivalAirport, lodging, imageUrl")
        .in("id", tripIds)
        .or(`endDate.gte.${todayIso},endDate.is.null`)
        .order("startDate", { ascending: true, nullsFirst: false })
        .order("createdAt", { ascending: false })
        .limit(1);
      const t = (trips ?? [])[0];
      if (!t) {
        if (!cancelled) { setTour(null); setTourLoaded(true); }
        return;
      }

      // 3) Hydrate stops + members for the chosen trip.
      const [{ data: stopsRaw }, { data: membersRaw }] = await Promise.all([
        sb.from("GolfTripCourse")
          .select("courseId, playDate, sortOrder, course:Course!GolfTripCourse_courseId_fkey(id, name, city, state, coverImageUrl, logoUrl, uploadCount)")
          .eq("tripId", t.id)
          .order("sortOrder", { ascending: true }),
        sb.from("GolfTripMember")
          .select("userId, user:User!GolfTripMember_userId_fkey(displayName, username, avatarUrl)")
          .eq("tripId", t.id),
      ]);

      // Supabase types the FK join as an array even when 1:1, so
      // normalize both shapes before consuming.
      const stops: Stop[] = ((stopsRaw ?? []) as any[])
        .map((s) => ({
          courseId: s.courseId,
          playDate: s.playDate,
          sortOrder: s.sortOrder,
          course: Array.isArray(s.course) ? s.course[0] : s.course,
        }))
        .filter((s) => s.course);

      const members: MemberLite[] = ((membersRaw ?? []) as any[])
        .map((m) => {
          const u = Array.isArray(m.user) ? m.user[0] : m.user;
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
  // Pulls 6 itineraries, preferring ones in-season for the current
  // month. Cheap query — TripItinerary is small + public-readable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const m = new Date().getMonth() + 1;
      // Bias toward in-season: bestSeasonStart <= m <= bestSeasonEnd
      // (handles year-wraparound via the OR clause).
      const { data } = await sb
        .from("TripItinerary")
        .select("id, slug, name, tagline, heroImageUrl, region, durationDays, costBand, bestSeasonStart, bestSeasonEnd")
        .or(`and(bestSeasonStart.lte.${m},bestSeasonEnd.gte.${m}),and(bestSeasonStart.gt.bestSeasonEnd,or(bestSeasonStart.lte.${m},bestSeasonEnd.gte.${m}))`)
        .limit(8);
      if (cancelled) return;
      // Shuffle so the same 6 don't show every load.
      const shuffled = [...(data ?? [])].sort(() => Math.random() - 0.5).slice(0, 6);
      setTripIdeas(shuffled as TripIdea[]);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Feed tease ─────────────────────────────────────────────────────
  // Recent approved clips — 5 thumbnails at the bottom of the home.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data } = await sb
        .from("Upload")
        .select("id, courseId, cloudflareVideoId, mediaUrl, mediaType, shotType, holeId, course:Course!Upload_courseId_fkey(name), hole:Hole!Upload_holeId_fkey(holeNumber)")
        .eq("moderationStatus", "APPROVED")
        .order("createdAt", { ascending: false })
        .limit(8);
      if (cancelled) return;
      const teasers: FeedTeaser[] = ((data ?? []) as any[]).map((u) => {
        const course = Array.isArray(u.course) ? u.course[0] : u.course;
        const hole = Array.isArray(u.hole) ? u.hole[0] : u.hole;
        // Cloudflare Stream thumbnail when available; else fall back
        // to the mediaUrl (already CDN-fronted by cdnImage if it's a
        // Supabase Storage image).
        const thumb = u.cloudflareVideoId
          ? `https://videodelivery.net/${u.cloudflareVideoId}/thumbnails/thumbnail.jpg?time=1s&width=240`
          : cdnImage(u.mediaUrl);
        return {
          id: u.id,
          courseId: u.courseId,
          courseName: course?.name ?? "Unknown",
          thumbnail: thumb,
          shotType: u.shotType,
          holeNumber: hole?.holeNumber ?? null,
        };
      });
      setFeedTeasers(teasers);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Near Me ────────────────────────────────────────────────────────
  // We use the same proven pattern as the legacy home: navigator
  // geolocation, fetch a bounding box of Courses, sort by upload
  // count desc + clip ties by name. Auto-runs only if location was
  // previously granted (sessionStorage cache) — first-time visitors
  // see a one-tap "Enable location" CTA so we don't spam permission
  // dialogs.
  useEffect(() => {
    const cached = typeof window !== "undefined" ? sessionStorage.getItem("tourit-loc-coords") : null;
    if (!cached) return;
    try {
      const { lat, lng, ts } = JSON.parse(cached);
      if (Date.now() - ts < 3_600_000) {
        setLocStatus("granted");
        fetchNearByCoords(lat, lng, nearMeRadius);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enableLocation() {
    setLocStatus("loading");
    if (!("geolocation" in navigator)) { setLocStatus("denied"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try { sessionStorage.setItem("tourit-loc-coords", JSON.stringify({ lat, lng, ts: Date.now() })); } catch {}
        setLocStatus("granted");
        fetchNearByCoords(lat, lng, nearMeRadius);
      },
      () => setLocStatus("denied"),
      { timeout: 8000 }
    );
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
  }

  function changeRadius(r: 10 | 25 | 50) {
    setNearMeRadius(r);
    if (locStatus !== "granted") return;
    const cached = sessionStorage.getItem("tourit-loc-coords");
    if (!cached) return;
    try {
      const { lat, lng } = JSON.parse(cached);
      fetchNearByCoords(lat, lng, r);
    } catch {}
  }

  // ── Render ─────────────────────────────────────────────────────────
  const showCTA = tourLoaded && !tour;
  const showTour = tourLoaded && !!tour;

  return (
    <main style={{ minHeight: "100dvh", background: SITE_BG, color: "#fff", paddingBottom: 96, paddingLeft: isDesktop ? 72 : 0 }}>
      <TourItTopBar />
      <MayCompetitionBanner />

      <div style={{ padding: "8px 16px 0", maxWidth: isDesktop ? 720 : undefined, margin: isDesktop ? "0 auto" : undefined }}>

        {/* Search — entry to Scout. Tap routes to /search. */}
        <button
          onClick={() => router.push("/search")}
          aria-label="Find a course"
          style={{
            width: "100%",
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(77,168,98,0.25)",
            borderRadius: 12,
            padding: "13px 16px",
            cursor: "pointer",
            fontFamily: "'Outfit', sans-serif",
            color: "rgba(255,255,255,0.5)",
            fontSize: 14,
          }}
        >
          <SearchIcon />
          Find a course — name, city, or state
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
        />

        {/* Your Tour */}
        {!tourLoaded && (
          <div style={{ marginTop: 22, padding: 24, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, textAlign: "center", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
            Loading…
          </div>
        )}
        {showTour && tour && (
          <YourTour
            tour={tour}
            onScout={() => tour.nextStop && router.push(`/courses/${tour.nextStop.courseId}`)}
            onGame={() => router.push(`/trips/${tour.id}#games`)}
            onTrip={() => router.push(`/trips/${tour.id}`)}
            onStopTap={(id) => router.push(`/courses/${id}`)}
          />
        )}
        {showCTA && (
          <PlannerCTA onClick={() => router.push("/search?tab=trips")} />
        )}

        {/* Where to next? — trip-idea inspiration */}
        <WhereToNext ideas={tripIdeas} onIdea={(slug) => router.push(`/trip-ideas/${slug}`)} onBrowseAll={() => router.push("/search?tab=trips")} />

        {/* Tour the Feed — tease at the bottom */}
        <FeedTease teasers={feedTeasers} onTap={(courseId) => router.push(`/courses/${courseId}`)} />
      </div>

      <BottomNav />
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────
// YourTour — the centerpiece module when an active trip exists.
// ─────────────────────────────────────────────────────────────────────
function YourTour({
  tour, onScout, onGame, onTrip, onStopTap,
}: {
  tour: ActiveTour;
  onScout: () => void;
  onGame: () => void;
  onTrip: () => void;
  onStopTap: (courseId: string) => void;
}) {
  const next = tour.nextStop;
  // Hero source priority: course cover → user-uploaded trip photo →
  // null (fall through to FairwayPlaceholder).
  const heroSrc =
    (next?.course.coverImageUrl ? cdnImage(next.course.coverImageUrl) : null) ||
    (tour.imageUrl ? cdnImage(tour.imageUrl) : null);
  const nextLogo = next?.course.logoUrl ? cdnImage(next.course.logoUrl) : null;
  const dateLabel = useMemo(() => formatNextUpDate(tour, next), [tour, next]);

  return (
    <section style={{ marginTop: 24 }}>
      <SectionLabel>Your Tour</SectionLabel>
      <button
        onClick={onTrip}
        style={{
          display: "block",
          width: "100%",
          padding: 0,
          background: "#0c1c13",
          border: "1px solid rgba(77,168,98,0.28)",
          borderRadius: 16,
          overflow: "hidden",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {/* Hero — next course cover. Tap goes into the trip detail. */}
        <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#07100a" }}>
          {heroSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroSrc} alt={next?.course.name ?? "Next course"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <FairwayPlaceholder logo={nextLogo} courseName={next?.course.name ?? tour.name} />
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(7,16,10,0) 40%, rgba(7,16,10,0.92) 100%)" }} />

          {/* Top-left badge: tiny YOUR TOUR + trip context */}
          <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
            <Badge variant="solid">Your Tour</Badge>
            <Badge variant="ghost">{tripContextLabel(tour)}</Badge>
          </div>

          {/* Course logo top-right */}
          {nextLogo && (
            <div style={{ position: "absolute", top: 12, right: 12, width: 42, height: 42, borderRadius: 9, background: "#fff", border: "1px solid rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: 4 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={nextLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
          )}

          {/* Bottom-left caption */}
          <div style={{ position: "absolute", left: 14, bottom: 12, right: 14 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(244,236,214,0.65)", marginBottom: 2 }}>
              Next up · {dateLabel}
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.05 }}>
              {next?.course.name ?? tour.name}
            </div>
          </div>
        </div>

        {/* Below-hero pad */}
        <div style={{ padding: "14px 14px 14px" }}>

          {/* Group avatars + tee-time line */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <AvatarStack members={tour.members} />
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {tour.members.length > 0 ? `${tour.members.length} ${tour.members.length === 1 ? "golfer" : "golfers"}` : "Just you so far"}
              {next?.course.city && ` · ${next.course.city}${next.course.state ? ", " + next.course.state : ""}`}
            </div>
          </div>

          {/* Stop chips — the trip's other courses (and the next one).
              Hidden for solo rounds (1 stop = no journey to show). */}
          {tour.stops.length > 1 && (
            <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
              {tour.stops.map((s, i) => {
                const isNext = next && s.courseId === next.courseId;
                return (
                  <button
                    key={s.courseId + "-" + i}
                    onClick={() => onStopTap(s.courseId)}
                    style={{
                      flexShrink: 0,
                      padding: "5px 9px 6px 9px",
                      borderRadius: 3,
                      border: isNext ? `1px solid ${GOLD}66` : "1px solid rgba(255,255,255,0.08)",
                      background: isNext ? "rgba(212,160,23,0.07)" : "rgba(255,255,255,0.02)",
                      display: "flex", flexDirection: "column", gap: 1,
                      cursor: "pointer",
                      minWidth: 0,
                      maxWidth: 200,
                    }}
                  >
                    <span style={{
                      fontFamily: "'Playfair Display', serif",
                      fontStyle: "italic",
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: isNext ? GOLD : SAGE,
                      whiteSpace: "nowrap",
                    }}>
                      {isNext ? "Next" : `Day ${i + 1}`}
                    </span>
                    <span style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: 12,
                      fontWeight: isNext ? 700 : 500,
                      color: isNext ? "#fff" : "rgba(255,255,255,0.7)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 180,
                    }}>
                      {s.course.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Action row — Scout the holes + Set up the game.
              These are scorecard-style cells with a tiny label, custom
              SVG icon (no emoji), and Outfit semibold action title. */}
          <div onClick={(e) => e.stopPropagation()} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <ActionCell
              label="Scout"
              title="Scout the holes"
              icon={<BinocularsIcon />}
              variant="ghost"
              onClick={onScout}
            />
            <ActionCell
              label="Tee Up"
              title="Set up the game"
              icon={<PinFlagIcon color="#0c2218" />}
              variant="primary"
              onClick={onGame}
            />
          </div>
        </div>
      </button>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PlannerCTA — empty state. Bundles "and line up the game" into the
// subtext so users discover Tee Up from the first touch.
// ─────────────────────────────────────────────────────────────────────
function PlannerCTA({ onClick }: { onClick: () => void }) {
  return (
    <section style={{ marginTop: 24 }}>
      <SectionLabel>Your Tour</SectionLabel>
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
            Tell us your crew and dates. We'll build the tour and line up the game.
          </div>
        </div>
        <ChevronRight />
      </button>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// NearMeRail — horizontal scrolling row of nearby courses + radius
// segmented control + Map shortcut.
// ─────────────────────────────────────────────────────────────────────
function NearMeRail({
  courses, radius, onChangeRadius, locStatus, onEnable, onMap, onCourse,
}: {
  courses: CourseLite[];
  radius: 10 | 25 | 50;
  onChangeRadius: (r: 10 | 25 | 50) => void;
  locStatus: "unknown" | "denied" | "granted" | "loading";
  onEnable: () => void;
  onMap: () => void;
  onCourse: (id: string) => void;
}) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
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

      {locStatus === "granted" && courses.length === 0 && (
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
    <section style={{ marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
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
function FeedTease({ teasers, onTap }: { teasers: FeedTeaser[]; onTap: (courseId: string) => void }) {
  if (teasers.length === 0) return null;
  return (
    <section style={{ marginTop: 28, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 22, color: "#fff" }}>Tour the Feed</span>
        <PulsingHint />
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch", marginRight: -16, paddingRight: 16 }}>
        {teasers.map((t) => (
          <button
            key={t.id}
            onClick={() => onTap(t.courseId)}
            style={{
              flexShrink: 0,
              width: 110,
              aspectRatio: "9 / 16",
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.07)",
              padding: 0,
              background: "#0c1c13",
              position: "relative",
              cursor: "pointer",
            }}
          >
            {t.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            )}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, rgba(7,16,10,0.92))" }} />
            <div style={{ position: "absolute", left: "50%", top: "42%", transform: "translate(-50%,-50%)", width: 26, height: 26, borderRadius: "50%", background: "rgba(77,168,98,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PlayIcon />
            </div>
            <div style={{ position: "absolute", left: 7, right: 7, bottom: 7, textAlign: "left" }}>
              {t.holeNumber && (
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: "#4da862", marginBottom: 1 }}>
                  HOLE {t.holeNumber}{t.shotType ? ` · ${t.shotType.toUpperCase()}` : ""}
                </div>
              )}
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#fff", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {t.courseName}
              </div>
            </div>
          </button>
        ))}
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
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: SAGE,
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
        padding: "11px 12px 12px",
        background: isPrimary ? "#4da862" : "rgba(244,236,214,0.025)",
        border: isPrimary ? "1px solid rgba(126,200,140,0.7)" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: 3,
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: 56,
      }}
    >
      <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: "italic",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: isPrimary ? "rgba(7,16,10,0.7)" : SAGE,
          marginBottom: 1,
        }}>{label}</div>
        <div style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 14,
          fontWeight: 700,
          color: isPrimary ? "#0a1a10" : "#fff",
          lineHeight: 1.15,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>{title}</div>
      </div>
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
    <svg width="9" height="9" viewBox="0 0 24 24" fill="#fff">
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatNextUpDate(tour: ActiveTour, next: Stop | null): string {
  // Prefer the trip's startDate, fall back to "soon" for trips with
  // no dates yet (welcome flow never completed).
  const iso = tour.startDate || (next as any)?.playDate || null;
  if (!iso) return "Soon";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function tripContextLabel(tour: ActiveTour): string {
  const days = tour.stops.length;
  if (days <= 1) return "Round";
  const where = tour.stops[0]?.course.state || tour.stops[0]?.course.city || "";
  return where ? `${days} stops · ${where}` : `${days} stops`;
}
