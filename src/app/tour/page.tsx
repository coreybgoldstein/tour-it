"use client";
import { Suspense } from "react";
import { useState, useEffect, useRef, useCallback, startTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import { BEST_FOR_TAGS, getEnrichment } from "@/lib/tripEnrichment";
import TripPlannerSheet from "@/components/TripPlannerSheet";
import { cdnImage } from "@/lib/cdnImage";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

type Course = {
  id: string;
  name: string;
  city: string;
  state: string;
  holeCount: number;
  isPublic: boolean;
  courseType: string | null;
  uploadCount: number;
  logoUrl: string | null;
};

function TourPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setInputRef = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
    if (el) el.focus();
  }, []);

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [results, setResults] = useState<Course[]>([]);
  const [popular, setPopular] = useState<Course[]>([]);
  const [recentSearches, setRecentSearches] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");
  const [newHoles, setNewHoles] = useState("18");
  const [newCourseType, setNewCourseType] = useState<"PUBLIC" | "SEMI_PRIVATE" | "PRIVATE" | "">("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  // Success confirmation pill — replaces a native alert() per the
  // design-system rule (no JS alerts on iOS WebView).
  const [createSuccess, setCreateSuccess] = useState(false);

  // Tab state hard-locked to "smart" — unified LLM search owns the
  // page. Legacy per-type tab UI is no longer reachable; the value
  // is cast through `as` so the wider tab-conditional render blocks
  // (Courses / Trips / People) still typecheck against the union.
  // They never render because searchTab is always "smart" at runtime.
  const searchTab = "smart" as "smart" | "courses" | "people" | "trips";

  // Unified search — single LLM-classified entry point. Replaces the
  // "pick a tab first" mental model. Type what you want; the AI
  // figures out whether you mean a course, a trip, or a person and
  // returns mixed results.
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartResults, setSmartResults] = useState<Array<
    | { type: "course"; id: string; name: string; city: string | null; state: string | null; logoUrl: string | null; coverImageUrl: string | null; uploadCount: number }
    | { type: "trip"; id: string; slug: string; name: string; tagline: string; heroImageUrl: string | null; region: string; durationDays: number; costBand: string }
    | { type: "person"; id: string; username: string; displayName: string | null; avatarUrl: string | null; rank: number | null }
  >>([]);
  const [smartExplanation, setSmartExplanation] = useState<string>("");
  const smartDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recent NL queries (top 3) persisted to localStorage. Distinct
  // from the legacy `recentSearches` state above (which stored
  // recent Course objects for the old per-tab UI — now unused but
  // kept around because some legacy render branches still reference
  // it). This array holds raw query strings for the new unified
  // Smart search empty state.
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tourit-recent-searches");
      if (raw) setRecentQueries(JSON.parse(raw).slice(0, 3));
    } catch {}
  }, []);

  // (Popular + Near Me fetches live inside TourEmptyState — they
  // only matter on the empty-query state, so colocating them avoids
  // running them when the user lands on /tour?tab=people from a
  // legacy deep-link and just bypasses the empty state.)

  // Near-Me state for the empty search state. Beta feedback: Leslie
  // didn't know any local courses, didn't know her ZIP when traveling,
  // and wanted "use my location" right on the search page. Mirrors the
  // home page's nearMe pattern.
  const [nearMeCourses, setNearMeCourses] = useState<Course[]>([]);
  const [nearMeStatus, setNearMeStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");

  // useKeyboardAwareSheet calls removed 2026-05-25 — KeyboardSync
  // + .tourit-sheet handle the lift; the legacy hook collapsed
  // sheets when the keyboard opened.

  // Filters — initialized from URL params so they survive navigation
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterState, setFilterState] = useState(searchParams.get("state") || "");
  const [filterCity, setFilterCity] = useState(searchParams.get("city") || "");
  const [filterZip, setFilterZip] = useState(searchParams.get("zip") || "");
  const [filterHoles, setFilterHoles] = useState<"all" | "9" | "18">((searchParams.get("holes") as "9" | "18") || "all");
  const [filterCourseType, setFilterCourseType] = useState<"" | "PUBLIC" | "PRIVATE" | "SEMI_PRIVATE">((searchParams.get("type") as "" | "PUBLIC" | "PRIVATE" | "SEMI_PRIVATE") || "");
  const [filterRadius, setFilterRadius] = useState<"10" | "25" | "50">((searchParams.get("radius") as "10" | "25" | "50") || "25");
  const [zipCoords, setZipCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState("");

  // Draft filter state (inside sheet, not yet applied)
  const [draftState, setDraftState] = useState(searchParams.get("state") || "");
  const [draftCity, setDraftCity] = useState(searchParams.get("city") || "");
  const [draftZip, setDraftZip] = useState(searchParams.get("zip") || "");
  const [draftHoles, setDraftHoles] = useState<"all" | "9" | "18">((searchParams.get("holes") as "9" | "18") || "all");
  const [draftCourseType, setDraftCourseType] = useState<"" | "PUBLIC" | "PRIVATE" | "SEMI_PRIVATE">((searchParams.get("type") as "" | "PUBLIC" | "PRIVATE" | "SEMI_PRIVATE") || "");
  const [draftRadius, setDraftRadius] = useState<"10" | "25" | "50">((searchParams.get("radius") as "10" | "25" | "50") || "25");

  type Person = { id: string; username: string; displayName: string; avatarUrl: string | null; uploadCount: number };
  const [peopleResults, setPeopleResults] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());
  const [newGolfers, setNewGolfers] = useState<Person[]>([]);
  const peopleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trips tab state. Loaded once on first tab visit, filtered client-
  // side because the catalog is small (14 destinations and counting).
  type TripCardData = {
    id: string;
    slug: string;
    name: string;
    tagline: string;
    heroImageUrl: string | null;
    region: string;
    vibeTag: string;
    costBand: string;
    durationDays: number;
  };
  const [tripResults, setTripResults] = useState<TripCardData[]>([]);
  const [tripsLoaded, setTripsLoaded] = useState(false);
  const [activeBestFor, setActiveBestFor] = useState<string | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastQueryRef = useRef<{ q: string; coords: { lat: number; lng: number } | null; state: string; city: string; holes: string; courseType: string; radius: string } | null>(null);

  const [closestCourses, setClosestCourses] = useState<Course[]>([]);
  const [closestLabel, setClosestLabel] = useState("");
  const prevLoadingRef = useRef(false);

  // Inline location suggestions — small "Places" row that appears at the top
  // of the results list when the user is mid-typing. Locations (city/state)
  // and ZIPs only — course-name suggestions live in the main results list
  // below since they're redundant otherwise.
  type LocationSuggestion =
    | { type: "location"; city: string; state: string }
    | { type: "zip"; zip: string; lat: number; lng: number };
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const locSuggestRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeFilterCount = [filterState, filterCity, filterZip, filterHoles !== "all", filterCourseType].filter(Boolean).length;
  const hasFilters = activeFilterCount > 0;

  // Load popular courses
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("Course")
      .select("id, name, city, state, holeCount, isPublic, courseType, uploadCount, logoUrl")
      .gt("uploadCount", 0)
      .limit(50)
      .then(({ data }) => {
        if (!data) return;
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        setPopular(shuffled.slice(0, 12));
      });
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tour-it-recent-searches");
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}
  }, []);

  function addRecentSearch(course: Course) {
    const updated = [course, ...recentSearches.filter(c => c.id !== course.id)].slice(0, 3);
    setRecentSearches(updated);
    try { localStorage.setItem("tour-it-recent-searches", JSON.stringify(updated)); } catch {}
  }

  function removeRecentSearch(id: string) {
    const updated = recentSearches.filter(c => c.id !== id);
    setRecentSearches(updated);
    try { localStorage.setItem("tour-it-recent-searches", JSON.stringify(updated)); } catch {}
  }

  // Find courses near the user's current location. Same pattern as
  // the home page's fetchNearMe — cache reads are instant, fresh
  // geolocation is requested in the background.
  function fetchNearMeSearch(radius = 50) {
    if (!navigator.geolocation) return;
    setNearMeStatus("loading");
    const MILES_PER_DEGREE = 69;
    const RANGE = radius / MILES_PER_DEGREE;

    async function doFetch(lat: number, lng: number) {
      const { data } = await createClient()
        .from("Course")
        .select("id, name, city, state, uploadCount, coverImageUrl, logoUrl")
        .gte("latitude", lat - RANGE).lte("latitude", lat + RANGE)
        .gte("longitude", lng - RANGE).lte("longitude", lng + RANGE)
        .order("uploadCount", { ascending: false })
        .limit(8);
      setNearMeCourses(((data ?? []) as unknown) as Course[]);
      setNearMeStatus("granted");
    }

    let usedCache = false;
    try {
      const raw = localStorage.getItem("tour-it-location");
      if (raw) {
        const { lat, lng, ts } = JSON.parse(raw);
        if (Date.now() - ts < 3600000) { doFetch(lat, lng); usedCache = true; }
      }
    } catch {}

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        localStorage.setItem("tour-it-location", JSON.stringify({ lat, lng, ts: Date.now() }));
        if (!usedCache) doFetch(lat, lng);
      },
      () => { if (!usedCache) setNearMeStatus("denied"); }
    );
  }

  // Auto-fire on mount if location was previously granted (cached
  // coords within the hour). User never has to tap "Enable" twice.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tour-it-location");
      if (raw) {
        const { ts } = JSON.parse(raw);
        if (Date.now() - ts < 3600000) fetchNearMeSearch();
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geocode zip from URL on mount
  useEffect(() => {
    const zipParam = searchParams.get("zip");
    if (zipParam && zipParam.length === 5) {
      geocodeZip(zipParam).then(coords => { if (coords) setZipCoords(coords); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);
      const { data } = await supabase.from("Follow").select("followingId").eq("followerId", user.id).eq("status", "ACTIVE");
      setFollowingIds(new Set((data || []).map((r: any) => r.followingId)));
    });
    supabase.from("User").select("id, username, displayName, avatarUrl, uploadCount, createdAt")
      .order("createdAt", { ascending: false })
      .limit(100)
      .then(({ data: users }) => {
        if (!users) return;
        setNewGolfers(users as Person[]);
      });
  }, []);

  // Trip catalog load — fetched lazily on first Trips tab visit.
  // Small catalog (14 destinations at beta launch); we filter client-
  // side and rerender as user types or taps best-for chips. When the
  // catalog crosses ~50 we'll move to server-side LLM ranking.
  useEffect(() => {
    if (searchTab !== "trips" || tripsLoaded) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("TripItinerary")
        .select("id, slug, name, tagline, heroImageUrl, region, vibeTag, costBand, durationDays")
        .order("dartThrowCount", { ascending: false });
      if (data) setTripResults(data as TripCardData[]);
      setTripsLoaded(true);
    })();
  }, [searchTab, tripsLoaded]);

  // People search
  useEffect(() => {
    if (searchTab !== "people") return;
    if (peopleDebounceRef.current) clearTimeout(peopleDebounceRef.current);
    if (query.trim().length < 1) { setPeopleResults([]); return; }
    setPeopleLoading(true);
    peopleDebounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const safeQuery = query.replace(/^@/, "").replace(/[(),]/g, "");
      const { data } = await supabase
        .from("User")
        .select("id, username, displayName, avatarUrl, uploadCount")
        .or(`username.ilike.%${safeQuery}%,displayName.ilike.%${safeQuery}%`)
        .limit(20);
      setPeopleResults((data || []).filter((u: Person) => u.id !== currentUserId));
      setPeopleLoading(false);
    }, 280);
  }, [query, searchTab, currentUserId]);

  // Geocode zip → lat/lng via zippopotam.us (4s timeout)
  async function geocodeZip(zip: string): Promise<{ lat: number; lng: number } | null> {
    if (zip.length !== 5) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return null;
      const data = await res.json();
      const place = data.places?.[0];
      if (!place) return null;
      return { lat: parseFloat(place.latitude), lng: parseFloat(place.longitude) };
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }

  // Inline location/ZIP suggestions — populates the "Places" row that
  // appears above the course results. Course-name matching already happens
  // in the main search query, so we deliberately exclude course hits here.
  useEffect(() => {
    if (searchTab !== "courses") { setLocationSuggestions([]); return; }
    const q = query.trim();
    if (locSuggestRef.current) clearTimeout(locSuggestRef.current);
    if (q.length < 2) { setLocationSuggestions([]); return; }

    locSuggestRef.current = setTimeout(async () => {
      const result: LocationSuggestion[] = [];
      if (/^\d{5}$/.test(q)) {
        const coords = await geocodeZip(q);
        if (coords) result.push({ type: "zip", zip: q, lat: coords.lat, lng: coords.lng });
      } else {
        const supabase = createClient();
        const safeQ = q.replace(/[(),]/g, "");
        const { data } = await supabase
          .from("Course")
          .select("city, state")
          .ilike("city", `%${safeQ}%`)
          .order("uploadCount", { ascending: false })
          .limit(30);
        if (data) {
          const seen = new Set<string>();
          for (const c of data) {
            if (!c.city || !c.state) continue;
            const key = `${c.city.toLowerCase()}|${c.state}`;
            if (seen.has(key)) continue;
            seen.add(key);
            result.push({ type: "location", city: c.city, state: c.state });
            if (result.length >= 4) break;
          }
        }
      }
      setLocationSuggestions(result);
    }, 200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searchTab]);

  // Applying a Places suggestion: scope the course list to that city/state
  // (or ZIP + radius), clear the freeform query, and update the URL so the
  // back button works the way users expect.
  function applyLocationSuggestion(s: LocationSuggestion) {
    setLocationSuggestions([]);
    if (s.type === "location") {
      setQuery("");
      setFilterCity(s.city);
      setFilterState(s.state);
      setDraftCity(s.city);
      setDraftState(s.state);
      setFilterZip(""); setDraftZip(""); setZipCoords(null);
    } else {
      setQuery("");
      setFilterZip(s.zip);
      setDraftZip(s.zip);
      setZipCoords({ lat: s.lat, lng: s.lng });
    }
  }

  // Closest courses fallback — when search returns empty, geocode the query and find nearby
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = loading;
    if (wasLoading && !loading && results.length === 0 && query.trim().length >= 3 && !hasFilters) {
      (async () => {
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query.trim() + " USA")}&format=json&limit=1&countrycodes=us`,
            { headers: { "Accept-Language": "en" } }
          );
          const d = await r.json();
          if (!d?.[0]) { setClosestCourses([]); return; }
          const lat = parseFloat(d[0].lat);
          const lng = parseFloat(d[0].lon);
          const delta = 0.724;
          const supabase = createClient();
          const { data: nearby } = await supabase
            .from("Course")
            .select("id, name, city, state, holeCount, isPublic, courseType, uploadCount, logoUrl")
            .gte("latitude", lat - delta).lte("latitude", lat + delta)
            .gte("longitude", lng - delta).lte("longitude", lng + delta)
            .order("uploadCount", { ascending: false })
            .limit(10);
          setClosestCourses(nearby || []);
          if (nearby?.length) setClosestLabel(`Nearest to "${query.trim()}"`);
        } catch { setClosestCourses([]); }
      })();
    } else if (loading || results.length > 0 || !query.trim()) {
      setClosestCourses([]);
      setClosestLabel("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, results.length, query]);

  // Smart-search effect — debounced LLM call to /api/tour/search
  // when the Smart tab is active. Clears results between tab swaps so
  // they don't bleed across.
  useEffect(() => {
    if (searchTab !== "smart") return;
    if (smartDebounceRef.current) clearTimeout(smartDebounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setSmartResults([]);
      setSmartExplanation("");
      setSmartLoading(false);
      return;
    }
    setSmartLoading(true);
    smartDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/tour/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `Search failed (${res.status})`);
        setSmartResults(data.results ?? []);
        setSmartExplanation(data.explanation ?? "");
        // Persist the query as a recent search — only when results
        // came back so we don't pollute the rail with typos. Dedupe +
        // cap to 3, most-recent-first.
        if ((data.results ?? []).length > 0) {
          setRecentQueries((prev) => {
            const next = [q, ...prev.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 3);
            try { localStorage.setItem("tourit-recent-searches", JSON.stringify(next)); } catch {}
            return next;
          });
        }
      } catch (e: any) {
        setSmartExplanation(e?.message ?? "Smart search is offline.");
        setSmartResults([]);
      } finally {
        setSmartLoading(false);
      }
    }, 400);
    return () => {
      if (smartDebounceRef.current) clearTimeout(smartDebounceRef.current);
    };
  }, [query, searchTab]);

  // Course search — runs on query or filter change
  const search = useCallback((q: string, coords: { lat: number; lng: number } | null, state: string, city: string, holes: string, courseType: string, radius: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const hasQuery = q.trim().length >= 1;
    const hasAnyFilter = state || city || coords || holes !== "all" || courseType;

    if (!hasQuery && !hasAnyFilter) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setTotalCount(null);
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      let qb = supabase
        .from("Course")
        .select("id, name, city, state, holeCount, isPublic, courseType, uploadCount, logoUrl", { count: "exact" });

      if (hasQuery) {
        const safeQ = q.replace(/[(),]/g, "");
        qb = qb.or(`name.ilike.%${safeQ}%,city.ilike.%${safeQ}%,state.ilike.%${safeQ}%`);
      }
      if (state) qb = qb.eq("state", state);
      if (city) qb = qb.ilike("city", `%${city}%`);
      if (holes !== "all") qb = qb.eq("holeCount", parseInt(holes));
      if (courseType) qb = qb.eq("courseType", courseType);
      if (coords) {
        const delta = ({ "10": 0.145, "25": 0.362, "50": 0.724 } as Record<string, number>)[radius] ?? 0.362;
        qb = qb
          .gte("latitude", coords.lat - delta)
          .lte("latitude", coords.lat + delta)
          .gte("longitude", coords.lng - delta)
          .lte("longitude", coords.lng + delta);
      }

      const { data, count } = await qb.order("uploadCount", { ascending: false }).limit(50);
      setResults(data || []);
      setTotalCount(count ?? 0);
      lastQueryRef.current = { q, coords, state, city, holes, courseType, radius };
      setLoading(false);
    }, 280);
  }, []);

  useEffect(() => {
    search(query, zipCoords, filterState, filterCity, filterHoles, filterCourseType, filterRadius);
  }, [query, zipCoords, filterState, filterCity, filterHoles, filterCourseType, filterRadius, search]);

  // Apply filters from draft
  async function applyFilters() {
    setZipError("");
    let coords = zipCoords;

    if (draftZip !== filterZip) {
      if (draftZip.length === 5) {
        setZipLoading(true);
        coords = await geocodeZip(draftZip);
        setZipLoading(false);
        if (!coords) { setZipError("Zip not recognized — try a state or city filter instead"); return; }
      } else if (draftZip === "") {
        coords = null;
      } else {
        setZipError("Enter a 5-digit zip code");
        return;
      }
    }

    setFilterState(draftState);
    setFilterCity(draftCity);
    setFilterZip(draftZip);
    setFilterHoles(draftHoles);
    setFilterCourseType(draftCourseType);
    setFilterRadius(draftRadius);
    setZipCoords(coords);
    setFilterOpen(false);

    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (draftState) params.set("state", draftState);
    if (draftCity) params.set("city", draftCity);
    if (draftZip) params.set("zip", draftZip);
    if (draftHoles !== "all") params.set("holes", draftHoles);
    if (draftCourseType) params.set("type", draftCourseType);
    if (draftZip) params.set("radius", draftRadius);
    // Wrap router.replace in startTransition so that useSearchParams
    // doesn't suspend the page on the URL update — without this, every
    // filter toggle / clear briefly unmounted the page into the
    // Suspense fallback, which read as a flash showing whatever was
    // behind the page in the iOS WebView.
    startTransition(() => {
      router.replace(`/search?${params.toString()}`, { scroll: false });
    });
  }

  function clearFilters() {
    setFilterState(""); setFilterCity(""); setFilterZip(""); setFilterHoles("all"); setZipCoords(null);
    setFilterCourseType(""); setFilterRadius("25");
    setDraftState(""); setDraftCity(""); setDraftZip(""); setDraftHoles("all");
    setDraftCourseType(""); setDraftRadius("25");
    setZipError("");
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    startTransition(() => {
      router.replace(`/search?${params.toString()}`, { scroll: false });
    });
  }

  async function loadMore() {
    if (!lastQueryRef.current) return;
    const { q, coords, state, city, holes, courseType, radius } = lastQueryRef.current;
    const offset = results.length;
    setLoadingMore(true);
    const supabase = createClient();
    let qb = supabase.from("Course").select("id, name, city, state, holeCount, isPublic, courseType, uploadCount, logoUrl");
    if (q) { const safeQ = q.replace(/[(),]/g, ""); qb = qb.or(`name.ilike.%${safeQ}%,city.ilike.%${safeQ}%,state.ilike.%${safeQ}%`); }
    if (state) qb = qb.eq("state", state);
    if (city) qb = qb.ilike("city", `%${city}%`);
    if (holes !== "all") qb = qb.eq("holeCount", parseInt(holes));
    if (courseType) qb = qb.eq("courseType", courseType);
    if (coords) {
      const delta = ({ "10": 0.145, "25": 0.362, "50": 0.724 } as Record<string, number>)[radius] ?? 0.362;
      qb = qb.gte("latitude", coords.lat - delta).lte("latitude", coords.lat + delta).gte("longitude", coords.lng - delta).lte("longitude", coords.lng + delta);
    }
    const { data } = await qb.order("uploadCount", { ascending: false }).range(offset, offset + 49);
    setResults(r => [...r, ...(data || [])]);
    setLoadingMore(false);
  }

  function openFilterSheet() {
    setDraftState(filterState);
    setDraftCity(filterCity);
    setDraftZip(filterZip);
    setDraftHoles(filterHoles);
    setDraftCourseType(filterCourseType);
    setDraftRadius(filterRadius);
    setZipError("");
    setFilterOpen(true);
  }

  // Attempt keyboard focus on mount (works on Android/desktop; iOS restricts programmatic focus after navigation)
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);


  const showResults = query.trim().length >= 1 || hasFilters;
  const displayList = showResults ? results : [];

  async function toggleFollow(targetId: string) {
    if (!currentUserId || followingInProgress.has(targetId)) return;
    setFollowingInProgress(prev => new Set(prev).add(targetId));
    const supabase = createClient();
    const isFollowing = followingIds.has(targetId);
    if (isFollowing) {
      await supabase.from("Follow").delete().eq("followerId", currentUserId).eq("followingId", targetId);
      setFollowingIds(prev => { const s = new Set(prev); s.delete(targetId); return s; });
    } else {
      await supabase.from("Follow").insert({ id: crypto.randomUUID(), followerId: currentUserId, followingId: targetId, status: "ACTIVE", createdAt: new Date().toISOString() });
      setFollowingIds(prev => new Set(prev).add(targetId));
    }
    setFollowingInProgress(prev => { const s = new Set(prev); s.delete(targetId); return s; });
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newCity.trim() || !newState.trim()) {
      setCreateError("Name, city, and state are required."); return;
    }
    setCreating(true); setCreateError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreateError("You must be logged in."); setCreating(false); return; }

    // Funnel through CourseRequest instead of inserting Course + 18
    // Hole rows directly from the client. The previous code was an
    // anti-spam vector (any signed-in user could create unlimited
    // courses with default `par 4` holes that polluted the DB) and
    // bypassed the ".claude/CLAUDE.md: never insert Courses, only
    // update existing" seeding rule. The team reviews CourseRequest
    // entries and creates real Course rows out-of-band (audit
    // 2026-05-25 follow-up to #13).
    const { error: reqErr } = await supabase.from("CourseRequest").insert({
      id: crypto.randomUUID(),
      userId: user.id,
      name: newName.trim(),
      city: newCity.trim(),
      state: newState.trim().toUpperCase(),
      courseType: newCourseType || null,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    });
    setCreating(false);
    if (reqErr) { setCreateError(reqErr.message); return; }
    // We don't have a course id to route to — the request is queued
    // for review. Surface a brief success confirmation inline; the
    // sheet auto-closes after a beat so the user can continue.
    setNewName(""); setNewCity(""); setNewState(""); setNewHoles("18"); setNewCourseType("");
    setCreateSuccess(true);
    setTimeout(() => { setCreateSuccess(false); setAddOpen(false); }, 2400);
  };

  // Tap anywhere outside the input / a button to dismiss the iOS keyboard.
  // Without this, the user has no way to drop the keyboard once it's up
  // (Return key now also dismisses via enterKeyHint above).
  const dismissKeyboardOnBackgroundTap = (e: React.PointerEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('input, textarea, button, a, select, [role="button"], [contenteditable="true"]')) return;
    inputRef.current?.blur();
  };

  return (
    <main
      onTouchStart={dismissKeyboardOnBackgroundTap}
      style={{ minHeight: "100dvh", background: "#07100a", color: "#fff" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; }
        .search-wrap { max-width: 600px; margin: 0 auto; padding: 0 20px 120px; }
        /* Bottom-sheet styles (.tourit-sheet, .tourit-sheet-backdrop,
           .tourit-sheet-grip, .tourit-sheet-footer) live in globals.css
           so every sheet across the app stays uniform. */
        /* Search box mirrors the home "Tour It All" hero: green-rim
           glow, italic Playfair serif input, the small Outfit subtitle
           below it. Tighter padding so it sits compactly against the
           recent / near / popular sections below. */
        .search-box { display: flex; align-items: center; gap: 10px; background: rgba(7,30,15,0.85); border: 1px solid rgba(77,168,98,0.55); border-radius: 12px; padding: 11px 16px; transition: border-color 0.2s, box-shadow 0.2s; box-shadow: 0 0 0 1px rgba(77,168,98,0.2), 0 0 18px rgba(77,168,98,0.18); }
        .search-box.focused { border-color: rgba(77,168,98,0.85); box-shadow: 0 0 0 1px rgba(77,168,98,0.4), 0 0 22px rgba(77,168,98,0.25); }
        .search-input { background: none; border: none; outline: none; width: 100%; font-family: 'Playfair Display', serif; font-style: italic; font-size: 17px; font-weight: 800; color: #4da862; letter-spacing: 0.01em; }
        .search-input::placeholder { color: rgba(77,168,98,0.55); font-style: italic; }
        .search-subtitle { font-family: 'Outfit', sans-serif; font-size: 10.5px; font-weight: 500; color: rgba(126,200,140,0.7); letter-spacing: 0.04em; margin-top: 6px; padding-left: 4px; }
        .clear-btn { background: rgba(255,255,255,0.08); border: none; cursor: pointer; color: rgba(255,255,255,0.5); border-radius: 99px; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .section-label { font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.25); margin-bottom: 10px; margin-top: 24px; }
        .course-row { display: flex; align-items: center; gap: 14px; padding: 13px 0; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: opacity 0.15s; }
        .course-row:last-child { border-bottom: none; }
        .course-row:active { opacity: 0.7; }
        .course-badge { width: 46px; height: 46px; border-radius: 10px; flex-shrink: 0; background: rgba(77,168,98,0.1); border: 1px solid rgba(77,168,98,0.2); display: flex; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 700; color: rgba(77,168,98,0.7); }
        .course-badge.has-clips { background: rgba(77,168,98,0.15); border-color: rgba(77,168,98,0.35); color: #4da862; }
        .course-name { font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.9); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .course-meta { font-family: 'Outfit', sans-serif; font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 2px; }
        .clip-count { color: #4da862; margin-left: 8px; }
        .empty-hint { text-align: center; padding: 48px 20px 0; font-family: 'Outfit', sans-serif; font-size: 13px; color: rgba(255,255,255,0.2); line-height: 1.6; }
        .spinner { display: flex; justify-content: center; padding: 32px 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        .filter-sheet-input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 11px 14px; font-family: 'Outfit', sans-serif; font-size: 15px; color: #fff; outline: none; }
        .filter-sheet-input:focus { border-color: rgba(77,168,98,0.4); }
        .filter-sheet-select { width: 100%; background: #0d2318; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 11px 14px; font-family: 'Outfit', sans-serif; font-size: 15px; color: #fff; outline: none; cursor: pointer; }
        .filter-sheet-label { font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.08em; display: block; margin-bottom: 6px; }
        .holes-toggle { display: flex; gap: 8px; }
        .holes-btn { flex: 1; padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.45); cursor: pointer; transition: all 0.15s; }
        .holes-btn.active { background: rgba(77,168,98,0.15); border-color: rgba(77,168,98,0.5); color: #4da862; }
      `}</style>

      <div className="search-wrap">
        {/* Header — tight against the green TopBar above so there isn't a
            wide black gap between the bar and "Search". */}
        <div style={{ padding: "4px 0 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            {/* Back button — beta tester (Leslie) tapped into search
                from the home discovery and had no way back. iOS swipe-
                back also doesn't fire reliably in the Capacitor
                WebView, so this explicit affordance is the safety net. */}
            <button
              onClick={() => { if (typeof window !== "undefined" && window.history.length > 1) router.back(); else router.push("/"); }}
              aria-label="Back"
              style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff" }}>
              Search
            </div>
            <button
              onClick={() => router.push("/map")}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(26,158,66,0.18)", border: "1px solid rgba(26,158,66,0.45)", borderRadius: 99, padding: "4px 11px", cursor: "pointer", flexShrink: 0 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3,11 3,20 9,17 15,20 21,17 21,8 15,11 9,8"/><line x1="9" y1="8" x2="9" y2="17"/><line x1="15" y1="11" x2="15" y2="20"/></svg>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "#4da862" }}>Map</span>
            </button>
          </div>
          <div className={`search-box ${focused ? "focused" : ""}`}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={setInputRef}
              className="search-input"
              type="text"
              inputMode="search"
              enterKeyHint="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
              placeholder="Tour It All"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
            />
            {query && (
              <button className="clear-btn" onClick={() => { setQuery(""); inputRef.current?.focus(); }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
          {/* Search subtitle — same Outfit caption as the home Tour
              It All button, so the visual scope is consistent across
              both entry points. */}
          {!query && (
            <div className="search-subtitle">courses · holes · trips · golfers</div>
          )}

          {/* Tab row hidden 2026-05-29 — user feedback: "no need for
              toggling, all function of searching under one house."
              Search is unified through the smart endpoint; the tab
              state stays for back-compat with legacy ?tab= deep links
              but doesn't surface visually. Per-type filter sheets
              (Courses filter, People invite) move into the results
              area where they're contextually relevant. */}

          {/* Active filter chips */}
          {hasFilters && searchTab === "courses" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {filterState && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.3)", color: "#4da862" }}>{filterState}</span>}
              {filterCity && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.3)", color: "#4da862" }}>{filterCity}</span>}
              {filterZip && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.3)", color: "#4da862" }}>Within {filterRadius} mi of {filterZip}</span>}
              {filterHoles !== "all" && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.3)", color: "#4da862" }}>{filterHoles} holes</span>}
              {filterCourseType && <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.3)", color: "#4da862" }}>{filterCourseType === "PUBLIC" ? "Public" : filterCourseType === "PRIVATE" ? "Private" : "Semi-Private"}</span>}
              <button onClick={clearFilters} style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: "none", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.35)", cursor: "pointer" }}>Clear</button>
            </div>
          )}
        </div>

        {/* ── Smart tab — LLM-unified Courses + Trips ── */}
        {searchTab === "smart" && (
          <div style={{ marginTop: 8 }}>
            {smartLoading && (
              <div style={{ padding: "14px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                Thinking…
              </div>
            )}
            {/* Empty-query state (no examples / instructional copy —
                user feedback: "let user be intuitive"). Three tight
                discovery blocks: recent searches, courses near me,
                popular courses. Each pulls from its own state /
                effect; sections that have no data hide themselves so
                a brand-new user never sees empty rails. */}
            {!smartLoading && !query.trim() && (
              <TourEmptyState
                recent={recentQueries}
                onPickRecent={(q) => setQuery(q)}
                onClearRecents={() => { setRecentQueries([]); try { localStorage.removeItem("tourit-recent-searches"); } catch {} }}
                router={router}
              />
            )}
            {!smartLoading && smartExplanation && (
              <div style={{ padding: "6px 16px 12px", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(244,236,214,0.55)", fontStyle: "italic" }}>
                {smartExplanation}
              </div>
            )}
            {!smartLoading && smartResults.length === 0 && query.trim() && smartExplanation && (
              <div style={{ padding: "0 16px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                No matches yet. Try widening the query.
              </div>
            )}
            <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {smartResults.map((r) =>
                r.type === "course" ? (
                  <button
                    key={`c-${r.id}`}
                    onClick={() => router.push(`/courses/${r.id}`)}
                    style={{ background: "#0c1c13", border: "1px solid rgba(77,168,98,0.18)", borderRadius: 12, padding: 10, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div style={{ width: 56, height: 56, borderRadius: 9, overflow: "hidden", flexShrink: 0, background: "rgba(77,168,98,0.1)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {r.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cdnImage(r.logoUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6, background: "#fff" }} />
                      ) : r.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cdnImage(r.coverImageUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : null}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4da862", background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 99, padding: "1px 7px" }}>Course</span>
                      </div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, color: "rgba(255,255,255,0.5)" }}>{[r.city, r.state].filter(Boolean).join(", ")}</div>
                    </div>
                  </button>
                ) : r.type === "trip" ? (
                  <button
                    key={`t-${r.id}`}
                    onClick={() => router.push(`/trip-ideas/${r.slug}`)}
                    style={{ background: "#0c1c13", border: "1px solid rgba(212,160,23,0.22)", borderRadius: 12, padding: 10, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div style={{ width: 88, height: 56, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "rgba(212,160,23,0.08)" }}>
                      {r.heroImageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cdnImage(r.heroImageUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#d4a017", background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)", borderRadius: 99, padding: "1px 7px" }}>Trip</span>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(244,236,214,0.5)" }}>{r.durationDays}D · {r.costBand}</span>
                      </div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.tagline}</div>
                    </div>
                  </button>
                ) : (
                  <button
                    key={`p-${r.id}`}
                    onClick={() => router.push(`/profile/${r.username}`)}
                    style={{ background: "#0c1c13", border: "1px solid rgba(77,168,98,0.18)", borderRadius: 12, padding: 10, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "rgba(77,168,98,0.18)", border: "1px solid rgba(77,168,98,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {r.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cdnImage(r.avatarUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(126,200,140,0.95)", background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.3)", borderRadius: 99, padding: "1px 7px" }}>Golfer</span>
                      </div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.displayName || `@${r.username}`}</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>@{r.username}</div>
                    </div>
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {/* ── Trips tab ── */}
        {searchTab === "trips" && (
          <>
            {/* Plan-My-Trip hero CTA — opens an AI-powered planner sheet
                that asks group/budget/origin/dates/vibes and returns the
                top 3-5 matches from the catalog with reasoning. */}
            <button
              onClick={() => setPlannerOpen(true)}
              style={{
                position: "relative",
                width: "100%",
                marginTop: 8,
                marginBottom: 14,
                padding: "16px 16px",
                background: "linear-gradient(135deg, rgba(45,122,66,0.95) 0%, rgba(77,168,98,0.85) 100%)",
                color: "#fff",
                border: "1px solid rgba(77,168,98,0.55)",
                borderRadius: 14,
                fontFamily: "'Outfit', sans-serif",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 14,
                textAlign: "left",
                boxShadow: "0 4px 18px rgba(45,122,66,0.3)",
                overflow: "hidden",
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(7,16,10,0.45)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.01em", marginBottom: 3 }}>Plan my trip</div>
                <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.35 }}>
                  Tell us your group + dates. We'll match the catalog.
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.85 }}><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            {/* Best-for filter chips. Single-select. Tap an active chip
                to clear. Filters the catalog client-side by intersecting
                the trip's enrichment bestFor[] tags. */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, marginBottom: 14 }}>
              {BEST_FOR_TAGS.map(tag => {
                const active = activeBestFor === tag.id;
                return (
                  <button
                    key={tag.id}
                    onClick={() => setActiveBestFor(active ? null : tag.id)}
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "5px 11px",
                      borderRadius: 99,
                      cursor: "pointer",
                      border: `1px solid ${active ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.1)"}`,
                      background: active ? "rgba(77,168,98,0.18)" : "rgba(255,255,255,0.04)",
                      color: active ? "#4da862" : "rgba(255,255,255,0.55)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>

            {/* Trip cards — filtered by query + active best-for chip. */}
            {(() => {
              const q = query.trim().toLowerCase();
              const filtered = tripResults.filter(t => {
                if (q) {
                  const haystack = `${t.name} ${t.region} ${t.tagline}`.toLowerCase();
                  if (!haystack.includes(q)) return false;
                }
                if (activeBestFor) {
                  const enr = getEnrichment(t.slug);
                  if (!enr || !enr.bestFor.includes(activeBestFor)) return false;
                }
                return true;
              });
              if (filtered.length === 0) {
                return <div className="empty-hint">No trips match. Try clearing the filter or {q ? "search" : "tag"}.</div>;
              }
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {filtered.map(trip => {
                    const enr = getEnrichment(trip.slug);
                    return (
                      <button
                        key={trip.id}
                        onClick={() => router.push(`/trip-ideas/${trip.slug}`)}
                        style={{
                          position: "relative",
                          width: "100%",
                          background: "rgba(10,28,18,0.6)",
                          border: "1px solid rgba(77,168,98,0.15)",
                          borderRadius: 16,
                          overflow: "hidden",
                          cursor: "pointer",
                          padding: 0,
                          textAlign: "left",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        {/* Hero image — 16:9 banner */}
                        {trip.heroImageUrl && (
                          <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", overflow: "hidden" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={cdnImage(trip.heroImageUrl)} alt={trip.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(7,16,10,0) 50%, rgba(7,16,10,0.7) 100%)" }} />
                            <div style={{ position: "absolute", left: 12, top: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", padding: "3px 8px", borderRadius: 99, background: "rgba(7,16,10,0.7)", border: "1px solid rgba(255,255,255,0.18)" }}>
                                {trip.region}
                              </span>
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "#4da862", padding: "3px 8px", borderRadius: 99, background: "rgba(7,16,10,0.7)", border: "1px solid rgba(77,168,98,0.4)" }}>
                                {trip.durationDays} DAYS · {trip.costBand}
                              </span>
                            </div>
                          </div>
                        )}
                        <div style={{ padding: "14px 14px 16px" }}>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: 4 }}>{trip.name}</div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.55, marginBottom: enr ? 10 : 0 }}>
                            {enr?.oneLiner ?? trip.tagline}
                          </div>
                          {enr && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              {enr.bestFor.slice(0, 3).map(tag => {
                                const label = BEST_FOR_TAGS.find(t => t.id === tag)?.label ?? tag;
                                return (
                                  <span key={tag} style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(77,168,98,0.85)", background: "rgba(77,168,98,0.08)", border: "1px solid rgba(77,168,98,0.2)", padding: "2px 7px", borderRadius: 99 }}>
                                    {label}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}

        {/* ── People tab ── */}
        {searchTab === "people" && (
          <>
            {peopleLoading && (
              <div className="spinner">
                <svg className="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.5)" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              </div>
            )}
            {!peopleLoading && query.trim() && peopleResults.length === 0 && (
              <div className="empty-hint">No golfers found for &ldquo;{query}&rdquo;</div>
            )}
            {!peopleLoading && !query.trim() && (
              <>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", paddingBottom: 8 }}>All Golfers on Tour It</div>
                {newGolfers.map(person => (
                  <div key={person.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div onClick={() => router.push(`/profile/${person.id}`)} style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.2)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      {person.avatarUrl ? <img src={cdnImage(person.avatarUrl)} alt={person.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#4da862" }}>{(person.displayName || person.username)[0].toUpperCase()}</span>}
                    </div>
                    <div onClick={() => router.push(`/profile/${person.id}`)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.displayName || person.username}</div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>@{person.username}</div>
                    </div>
                    {person.id !== currentUserId && (
                      <button
                        onClick={async () => {
                          if (!currentUserId || followingInProgress.has(person.id)) return;
                          setFollowingInProgress(s => new Set(s).add(person.id));
                          const supabase = createClient();
                          const isFollowing = followingIds.has(person.id);
                          if (isFollowing) {
                            await supabase.from("Follow").delete().eq("followerId", currentUserId).eq("followingId", person.id);
                            setFollowingIds(s => { const n = new Set(s); n.delete(person.id); return n; });
                          } else {
                            await supabase.from("Follow").insert({ id: crypto.randomUUID(), followerId: currentUserId, followingId: person.id, status: "ACTIVE", createdAt: new Date().toISOString() });
                            setFollowingIds(s => new Set(s).add(person.id));
                          }
                          setFollowingInProgress(s => { const n = new Set(s); n.delete(person.id); return n; });
                        }}
                        style={{ flexShrink: 0, background: followingIds.has(person.id) ? "rgba(255,255,255,0.07)" : "rgba(77,168,98,0.15)", border: `1px solid ${followingIds.has(person.id) ? "rgba(255,255,255,0.12)" : "rgba(77,168,98,0.4)"}`, borderRadius: 20, padding: "6px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: followingIds.has(person.id) ? "rgba(255,255,255,0.5)" : "#4da862", cursor: currentUserId ? "pointer" : "default", opacity: followingInProgress.has(person.id) ? 0.5 : 1 }}
                      >
                        {followingIds.has(person.id) ? "Following" : "Follow"}
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
            {!peopleLoading && peopleResults.map(person => (
              <div key={person.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div onClick={() => router.push(`/profile/${person.id}`)} style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.2)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  {person.avatarUrl ? <img src={cdnImage(person.avatarUrl)} alt={person.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#4da862" }}>{(person.displayName || person.username)[0].toUpperCase()}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => router.push(`/profile/${person.id}`)}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.displayName}</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>@{person.username}</div>
                </div>
                {currentUserId && (
                  <button onClick={() => toggleFollow(person.id)} disabled={followingInProgress.has(person.id)} style={{ flexShrink: 0, padding: "7px 16px", borderRadius: 99, border: followingIds.has(person.id) ? "1px solid rgba(255,255,255,0.15)" : "none", background: followingIds.has(person.id) ? "transparent" : "#2d7a42", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: followingIds.has(person.id) ? "rgba(255,255,255,0.5)" : "#fff", cursor: "pointer", opacity: followingInProgress.has(person.id) ? 0.5 : 1 }}>
                    {followingIds.has(person.id) ? "Following" : "Follow"}
                  </button>
                )}
              </div>
            ))}
          </>
        )}


        {/* ── Courses tab ── */}
        {searchTab === "courses" && <>
          {loading && (
            <div className="spinner">
              <svg className="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.5)" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            </div>
          )}

          {/* Places row — pulled out of the results block so a ZIP query
              (which usually doesn't match any course names) still surfaces
              the "Near 90210" chip even when the courses list is empty. */}
          {!loading && showResults && locationSuggestions.length > 0 && (
            <>
              <p className="section-label" style={{ marginTop: 18 }}>Places</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
                {locationSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => applyLocationSuggestion(s)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(77,168,98,0.08)", border: "1px solid rgba(77,168,98,0.25)", borderRadius: 10, cursor: "pointer", textAlign: "left" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 500, color: "#fff", flex: 1 }}>
                      {s.type === "zip" ? `Near ${s.zip}` : `${s.city}, ${s.state}`}
                    </span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(77,168,98,0.7)", textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}>
                      {s.type === "zip" ? "Zip" : "City"}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {!loading && showResults && displayList.length === 0 && closestCourses.length === 0 && (
            <div className="empty-hint">
              No courses found<br/>
              <span style={{ fontSize: 12 }}>Try adjusting your search or filters</span>
              <br />
              <a href="/add-course" style={{ display: "inline-block", marginTop: 12, fontSize: 12, color: "#4da862", textDecoration: "none" }}>+ Request a missing course</a>
            </div>
          )}

          {!loading && showResults && displayList.length === 0 && closestCourses.length > 0 && (
            <>
              <div style={{ margin: "16px 0 12px", padding: "10px 14px", borderRadius: 10, background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.15)", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                No exact match — showing {closestLabel}
              </div>
              {closestCourses.map(course => {
                const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
                return (
                  <div key={course.id} className="course-row" onClick={() => { addRecentSearch(course); router.push(`/courses/${course.id}`); }}>
                    <div className={`course-badge ${course.uploadCount > 0 ? "has-clips" : ""}`} style={{ overflow: "hidden", padding: course.logoUrl ? 0 : undefined }}>
                      {course.logoUrl ? <img src={cdnImage(course.logoUrl)} alt={course.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10, backgroundColor: "#fff" }} /> : abbr}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="course-name">{course.name}</div>
                      <div className="course-meta">
                        {[course.city, course.state].filter(s => s?.trim()).join(", ")}
                        {course.uploadCount > 0 && <span className="clip-count">{course.uploadCount} clips</span>}
                      </div>
                    </div>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                );
              })}
            </>
          )}

          {!loading && showResults && displayList.length > 0 && (
            <>
              {(() => {
                const q = query.trim().toLowerCase();
                const byName = q ? displayList.filter(c => c.name.toLowerCase().includes(q)).length : 0;
                const byCity = q ? displayList.filter(c => c.city?.toLowerCase().includes(q)).length : 0;
                const total = totalCount ?? displayList.length;
                const label = total > displayList.length ? `Showing ${displayList.length} of ${total}` : `${total}`;
                return (
                  <p className="section-label">
                    {label} course{total !== 1 ? "s" : ""}
                    {byName > 0 && ` · ${byName} by name`}
                    {byCity > 0 && ` · ${byCity} by city`}
                  </p>
                );
              })()}
              {displayList.map(course => {
                const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
                return (
                  <div key={course.id} className="course-row" onClick={() => { addRecentSearch(course); router.push(`/courses/${course.id}`); }}>
                    <div className={`course-badge ${course.uploadCount > 0 ? "has-clips" : ""}`} style={{ overflow: "hidden", padding: course.logoUrl ? 0 : undefined }}>
                      {course.logoUrl ? <img src={cdnImage(course.logoUrl)} alt={course.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10, backgroundColor: "#fff" }} /> : abbr}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="course-name">{course.name}</div>
                      <div className="course-meta">
                        {[course.city, course.state].filter(s => s?.trim()).join(", ")}
                        {course.uploadCount > 0 && <span className="clip-count">{course.uploadCount} clips</span>}
                      </div>
                    </div>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                );
              })}
            </>
          )}

          {/* Near Me — prioritized for users who don't know local
              course names or ZIPs. Empty by default; tapping "Use my
              location" requests permission then populates. If location
              was previously granted (cached coords), populates on mount. */}
          {!showResults && searchTab === "courses" && (
            <>
              <p className="section-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>Near Me</span>
                {nearMeStatus === "loading" && <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.3)" }}>Locating…</span>}
              </p>
              {nearMeStatus === "idle" && (
                <button
                  onClick={() => fetchNearMeSearch()}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "rgba(26,158,66,0.1)", border: "1px solid rgba(26,158,66,0.3)", borderRadius: 12, padding: "12px 16px", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#4da862", marginBottom: 18 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                  Use my location to find courses
                </button>
              )}
              {nearMeStatus === "denied" && (
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", padding: "8px 0 16px" }}>
                  Location blocked. Enable Tour It location access in iOS Settings to find courses near you.
                </div>
              )}
              {nearMeStatus === "granted" && nearMeCourses.length === 0 && (
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)", padding: "8px 0 16px" }}>
                  No courses found within 50 miles.
                </div>
              )}
              {nearMeStatus === "granted" && nearMeCourses.length > 0 && nearMeCourses.slice(0, 5).map(course => {
                const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
                return (
                  <div key={course.id} className="course-row" onClick={() => { addRecentSearch(course); router.push(`/courses/${course.id}`); }}>
                    <div className={`course-badge ${course.uploadCount > 0 ? "has-clips" : ""}`} style={{ overflow: "hidden", padding: course.logoUrl ? 0 : undefined }}>
                      {course.logoUrl ? <img src={cdnImage(course.logoUrl)} alt={course.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10, backgroundColor: "#fff" }} /> : abbr}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="course-name">{course.name}</div>
                      <div className="course-meta">
                        {[course.city, course.state].filter(s => s?.trim()).join(", ")}
                        {course.uploadCount > 0 && <span className="clip-count">{course.uploadCount} clips</span>}
                      </div>
                    </div>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                );
              })}
            </>
          )}

          {/* Recent searches */}
          {!showResults && recentSearches.length > 0 && (
            <>
              <p className="section-label">Recently Viewed</p>
              {recentSearches.map(course => {
                const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
                return (
                  <div key={course.id} className="course-row" style={{ position: "relative" }} onClick={() => { addRecentSearch(course); router.push(`/courses/${course.id}`); }}>
                    <div className={`course-badge ${course.uploadCount > 0 ? "has-clips" : ""}`} style={{ overflow: "hidden", padding: course.logoUrl ? 0 : undefined }}>
                      {course.logoUrl ? <img src={cdnImage(course.logoUrl)} alt={course.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10, backgroundColor: "#fff" }} /> : abbr}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="course-name">{course.name}</div>
                      <div className="course-meta">{[course.city, course.state].filter(s => s?.trim()).join(", ")}</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); removeRecentSearch(course.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {/* Popular courses (no search or filters) */}
          {!showResults && popular.length > 0 && (
            <>
              <p className="section-label">Popular on Tour It</p>
              {popular.map(course => {
                const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
                return (
                  <div key={course.id} className="course-row" onClick={() => { addRecentSearch(course); router.push(`/courses/${course.id}`); }}>
                    <div className="course-badge has-clips" style={{ overflow: "hidden", padding: course.logoUrl ? 0 : undefined }}>
                      {course.logoUrl ? <img src={cdnImage(course.logoUrl)} alt={course.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10, backgroundColor: "#fff" }} /> : abbr}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="course-name">{course.name}</div>
                      <div className="course-meta">
                        {[course.city, course.state].filter(s => s?.trim()).join(", ")}
                        <span className="clip-count">{course.uploadCount} clips</span>
                      </div>
                    </div>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                );
              })}
            </>
          )}

          {!showResults && popular.length === 0 && (
            <div className="empty-hint">
              Search from 11,000+ courses across the US<br/>
              <span style={{ fontSize: 12 }}>Start typing to search</span>
            </div>
          )}

          {!loading && totalCount !== null && results.length < totalCount && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{ width: "100%", marginTop: 16, padding: "12px", borderRadius: 12, background: "rgba(77,168,98,0.1)", border: "1px solid rgba(77,168,98,0.25)", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#4da862", cursor: loadingMore ? "default" : "pointer", opacity: loadingMore ? 0.6 : 1 }}
            >
              {loadingMore ? "Loading…" : `Load more · ${totalCount - results.length} remaining`}
            </button>
          )}

          {showResults && !loading && (
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Don&apos;t see your course?</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>Add it so others can scout it</div>
              </div>
              <button onClick={() => { setNewName(query); setAddOpen(true); }} style={{ background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.35)", borderRadius: 10, padding: "13px 18px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#4da862", cursor: "pointer", whiteSpace: "nowrap", minHeight: 44 }}>
                + Add Course
              </button>
            </div>
          )}
        </>}
      </div>

      {/* Filter bottom sheet — uses the shared .tourit-sheet pattern so its
          height, padding, backdrop and z-index match the Create Course sheet. */}
      {filterOpen && (
        <>
          <div onClick={() => setFilterOpen(false)} className="tourit-sheet-backdrop" />
          <div id="search-filter-sheet" className="tourit-sheet">
            <div className="tourit-sheet-grip" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff" }}>Filter Courses</div>
              <button onClick={() => { clearFilters(); setFilterOpen(false); }} style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer" }}>Clear all</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* State */}
              <div>
                <label className="filter-sheet-label">State</label>
                <select className="filter-sheet-select" value={draftState} onChange={e => setDraftState(e.target.value)}>
                  <option value="">Any state</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* City */}
              <div>
                <label className="filter-sheet-label">City</label>
                <input
                  className="filter-sheet-input"
                  placeholder="e.g. Scottsdale"
                  value={draftCity}
                  onChange={e => setDraftCity(e.target.value)}
                />
              </div>

              {/* Zip + Radius */}
              <div>
                <label className="filter-sheet-label">Near Zip Code</label>
                <input
                  className="filter-sheet-input"
                  placeholder="e.g. 90210"
                  value={draftZip}
                  onChange={e => setDraftZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  inputMode="numeric"
                  maxLength={5}
                />
                {zipError && <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#ef4444", marginTop: 6 }}>{zipError}</p>}
                <div style={{ marginTop: 10 }}>
                  <label className="filter-sheet-label" style={{ marginBottom: 6 }}>Radius</label>
                  <div className="holes-toggle">
                    {(["10", "25", "50"] as const).map(r => (
                      <button key={r} className={`holes-btn ${draftRadius === r ? "active" : ""}`} onClick={() => setDraftRadius(r)}>
                        {r} mi
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Course Type */}
              <div>
                <label className="filter-sheet-label">Course Type</label>
                <div className="holes-toggle" style={{ flexWrap: "wrap", gap: 8 }}>
                  {([["", "Any"], ["PUBLIC", "Public"], ["PRIVATE", "Private"], ["SEMI_PRIVATE", "Semi-Private"]] as const).map(([val, label]) => (
                    <button key={val} className={`holes-btn ${draftCourseType === val ? "active" : ""}`} style={{ flex: "1 1 calc(50% - 4px)" }} onClick={() => setDraftCourseType(val)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Holes */}
              <div>
                <label className="filter-sheet-label">Holes</label>
                <div className="holes-toggle">
                  {(["all", "9", "18"] as const).map(h => (
                    <button key={h} className={`holes-btn ${draftHoles === h ? "active" : ""}`} onClick={() => setDraftHoles(h)}>
                      {h === "all" ? "Any" : `${h} Holes`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={applyFilters}
              disabled={zipLoading}
              style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 12, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff", cursor: zipLoading ? "default" : "pointer", opacity: zipLoading ? 0.6 : 1, marginTop: 28 }}
            >
              {zipLoading ? "Looking up zip…" : "Apply Filters"}
            </button>
          </div>
        </>
      )}

      {/* Create course bottom sheet — uses the shared .tourit-sheet pattern. */}
      {addOpen && (
        <>
          <div onClick={() => setAddOpen(false)} className="tourit-sheet-backdrop" />
          <div id="search-create-course-sheet" className="tourit-sheet">
            <div className="tourit-sheet-grip" />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Add a Course</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 20 }}>Help the community scout it</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Course Name", value: newName, set: setNewName, placeholder: "e.g. Pebble Beach Golf Links" },
                { label: "City", value: newCity, set: setNewCity, placeholder: "e.g. Pebble Beach" },
                { label: "State", value: newState, set: setNewState, placeholder: "e.g. CA" },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>{label}</label>
                  <input value={value} onChange={e => set(e.target.value)} placeholder={placeholder} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }} />
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>Holes</label>
                  <select value={newHoles} onChange={e => setNewHoles(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, color: "#fff", outline: "none" }}>
                    {["9","18","27","36"].map(n => <option key={n} value={n} style={{ background: "#0d2318" }}>{n} holes</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>Access</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["PUBLIC", "SEMI_PRIVATE", "PRIVATE"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setNewCourseType(newCourseType === t ? "" : t)}
                        style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: `1px solid ${newCourseType === t ? "rgba(77,168,98,0.35)" : "rgba(255,255,255,0.1)"}`, background: newCourseType === t ? "rgba(77,168,98,0.12)" : "rgba(255,255,255,0.06)", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: newCourseType === t ? "#4da862" : "rgba(255,255,255,0.5)", cursor: "pointer" }}
                      >
                        {t === "SEMI_PRIVATE" ? "Semi" : t === "PUBLIC" ? "Public" : "Private"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {createError && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#ef4444" }}>{createError}</div>}
              {createSuccess && (
                <div style={{ background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.35)", borderRadius: 12, padding: "12px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "#4da862", display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Thanks — we&apos;ll review and add it within 24h.
                </div>
              )}
              <button onClick={handleCreate} disabled={creating || createSuccess} style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff", cursor: creating || createSuccess ? "default" : "pointer", opacity: creating || createSuccess ? 0.6 : 1, marginTop: 4 }}>
                {creating ? "Submitting…" : createSuccess ? "Submitted" : "Submit for review"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Where to next? — moved here from HomeTour 2026-05-29 so the
          home stays focused on the active loop. Always present at the
          bottom of /tour as a discovery surface; only renders if the
          catalog has rows. */}
      <TourWhereToNext />

      <BottomNav />
      <TripPlannerSheet open={plannerOpen} onClose={() => setPlannerOpen(false)} />
    </main>
  );
}

export default function TourPage() {
  return (
    // Suspense fallback intentionally renders the same #07100a brand
    // background so that any moment when useSearchParams() suspends
    // (e.g. when a filter triggers router.replace) the page doesn't
    // briefly unmount into transparency and flash the previous-route
    // WebView state through — that was the "I see the page behind it"
    // glitch on iOS Capacitor.
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "#07100a" }} />}>
      <TourPageInner />
    </Suspense>
  );
}

// ────────────────────────────────────────────────────────────────────
// TourWhereToNext — trip-idea inspiration rail rendered at the bottom
// of /tour. Moved here from HomeTour so the home screen stays focused
// on the active loop. Same shape as the home-screen rail it replaced.
// ────────────────────────────────────────────────────────────────────

type TourIdea = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  heroImageUrl: string | null;
  region: string;
  durationDays: number;
  costBand: string;
  bestSeasonStart: number;
  bestSeasonEnd: number;
};

// ────────────────────────────────────────────────────────────────────
// TourEmptyState — shown on /tour when the smart query is empty.
// Three tight blocks (Recent / Near Me / Popular). Each hides when
// it has no data so a brand-new user never sees skeleton rails.
// ────────────────────────────────────────────────────────────────────

type TourEmptyStateProps = {
  recent: string[];
  onPickRecent: (q: string) => void;
  onClearRecents: () => void;
  router: ReturnType<typeof useRouter>;
};

type TourCourseLite = { id: string; name: string; city: string | null; state: string | null; logoUrl: string | null; coverImageUrl: string | null; uploadCount: number };

function TourEmptyState({ recent, onPickRecent, onClearRecents, router }: TourEmptyStateProps) {
  const [nearMe, setNearMe] = useState<TourCourseLite[]>([]);
  const [popular, setPopular] = useState<TourCourseLite[]>([]);
  const [locStatus, setLocStatus] = useState<"unknown" | "loading" | "granted" | "denied">("unknown");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data } = await sb
        .from("Course")
        .select("id, name, city, state, logoUrl, coverImageUrl, uploadCount")
        .order("uploadCount", { ascending: false, nullsFirst: false })
        .limit(20);
      if (!cancelled) setPopular((data ?? []) as TourCourseLite[]);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("tourit-loc-coords");
      if (!cached) return;
      const { lat, lng, ts } = JSON.parse(cached);
      if (Date.now() - ts < 3_600_000) {
        setLocStatus("granted");
        fetchNearMe(lat, lng);
      }
    } catch {}
  }, []);

  async function fetchNearMe(lat: number, lng: number) {
    const sb = createClient();
    const radiusMiles = 50;
    const deg = radiusMiles / 69;
    const lngDeg = deg / Math.cos((lat * Math.PI) / 180);
    const { data } = await sb
      .from("Course")
      .select("id, name, city, state, logoUrl, coverImageUrl, uploadCount, latitude, longitude")
      .gte("latitude", lat - deg).lte("latitude", lat + deg)
      .gte("longitude", lng - lngDeg).lte("longitude", lng + lngDeg)
      .order("uploadCount", { ascending: false, nullsFirst: false })
      .limit(3);
    setNearMe((data ?? []) as TourCourseLite[]);
  }

  function enableLocation() {
    if (!("geolocation" in navigator)) { setLocStatus("denied"); return; }
    setLocStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try { sessionStorage.setItem("tourit-loc-coords", JSON.stringify({ lat, lng, ts: Date.now() })); } catch {}
        setLocStatus("granted");
        fetchNearMe(lat, lng);
      },
      () => setLocStatus("denied"),
      { timeout: 8000 }
    );
  }

  return (
    <div style={{ padding: "12px 16px 0" }}>
      {recent.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>Recent</div>
            <button onClick={onClearRecents} style={{ background: "none", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.35)", cursor: "pointer" }}>Clear</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {recent.map((q) => (
              <button
                key={q}
                onClick={() => onPickRecent(q)}
                style={{ background: "rgba(77,168,98,0.08)", border: "1px solid rgba(77,168,98,0.25)", borderRadius: 99, padding: "5px 11px", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(126,200,140,0.95)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Near you</div>
        {locStatus !== "granted" && (
          <button
            onClick={enableLocation}
            disabled={locStatus === "loading"}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 10, background: "rgba(244,236,214,0.02)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 7 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            {locStatus === "loading" ? "Finding you…" : locStatus === "denied" ? "Location blocked — tap to retry" : "Enable location to see nearby courses"}
          </button>
        )}
        {locStatus === "granted" && nearMe.length > 0 && (
          <div>
            {nearMe.map((c) => <TourCourseRow key={c.id} course={c} onClick={() => router.push(`/courses/${c.id}`)} />)}
          </div>
        )}
        {locStatus === "granted" && nearMe.length === 0 && (
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", padding: "6px 4px" }}>No courses within 50 miles.</div>
        )}
      </div>

      {popular.length > 0 && (
        <div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Popular</div>
          <div>
            {popular.map((c) => <TourCourseRow key={c.id} course={c} onClick={() => router.push(`/courses/${c.id}`)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function TourCourseRow({ course, onClick }: { course: TourCourseLite; onClick: () => void }) {
  const logo = course.logoUrl ? cdnImage(course.logoUrl) : null;
  return (
    <button
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "transparent", border: "none", borderTop: 0, borderLeft: 0, borderRight: 0, cursor: "pointer", textAlign: "left", width: "100%" }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 8, background: "#fff", border: "1px solid rgba(255,255,255,0.45)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: 3, flexShrink: 0 }}>
        {logo
          ? <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 800, color: "#0c1c13" }}>{course.name.slice(0, 2).toUpperCase()}</span>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{course.name}</div>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{[course.city, course.state].filter(Boolean).join(", ")}</div>
      </div>
      {!!course.uploadCount && course.uploadCount > 0 && (
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 700, color: "#4da862", flexShrink: 0 }}>
          {course.uploadCount} {course.uploadCount === 1 ? "clip" : "clips"}
        </span>
      )}
    </button>
  );
}

function TourWhereToNext() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<TourIdea[]>([]);
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
      const inSeason = (start: number, end: number) =>
        start <= end ? (m >= start && m <= end) : (m >= start || m <= end);
      const seasonal = (data as any[]).filter((it) => inSeason(it.bestSeasonStart, it.bestSeasonEnd));
      const pool = seasonal.length >= 6 ? seasonal : (data as any[]);
      const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 8);
      setIdeas(shuffled as TourIdea[]);
    })();
    return () => { cancelled = true; };
  }, []);

  if (ideas.length === 0) return null;
  return (
    <section style={{ marginTop: 22, padding: "0 16px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(244,236,214,0.92)" }}>
          Where to next?
        </div>
        <button
          onClick={() => router.push("/tour?tab=trips")}
          style={{ background: "transparent", border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, color: "#4da862", cursor: "pointer", letterSpacing: "0.02em" }}
        >
          Browse all →
        </button>
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch", marginRight: -16, paddingRight: 16 }}>
        {ideas.map((i) => (
          <button
            key={i.slug}
            onClick={() => router.push(`/trip-ideas/${i.slug}`)}
            style={{ flexShrink: 0, width: 220, background: "#0c1c13", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden", padding: 0, cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column" }}
          >
            <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9" }}>
              {i.heroImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cdnImage(i.heroImageUrl)} alt={i.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "linear-gradient(160deg, rgba(45,122,66,0.4), rgba(7,16,10,0.9))" }} />
              )}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, rgba(7,16,10,0.85))" }} />
              <div style={{ position: "absolute", left: 8, top: 8, fontFamily: "'Outfit', sans-serif", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 99, color: "rgba(244,236,214,0.85)", background: "rgba(7,16,10,0.7)", border: "1px solid rgba(244,236,214,0.18)" }}>
                {i.region}
              </div>
              <div style={{ position: "absolute", right: 8, top: 8, fontFamily: "'Outfit', sans-serif", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 99, color: "rgba(244,236,214,0.85)", background: "rgba(7,16,10,0.7)", border: "1px solid rgba(244,236,214,0.18)" }}>
                {i.durationDays}D · {i.costBand}
              </div>
              <div style={{ position: "absolute", left: 10, bottom: 8, right: 10, fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
                {i.name}
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
