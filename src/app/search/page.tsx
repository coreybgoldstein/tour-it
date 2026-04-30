"use client";
import { Suspense } from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

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

function SearchPageInner() {
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
  const [newPublic, setNewPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [searchTab, setSearchTab] = useState<"courses" | "people">("courses");

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
  const peopleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeFilterCount = [filterState, filterCity, filterZip, filterHoles !== "all", filterCourseType].filter(Boolean).length;
  const hasFilters = activeFilterCount > 0;

  // Load popular courses
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("Course")
      .select("id, name, city, state, holeCount, isPublic, courseType, uploadCount, logoUrl")
      .gt("uploadCount", 0)
      .order("uploadCount", { ascending: false })
      .limit(12)
      .then(({ data }) => { if (data) setPopular(data); });
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
  }, []);

  // People search
  useEffect(() => {
    if (searchTab !== "people") return;
    if (peopleDebounceRef.current) clearTimeout(peopleDebounceRef.current);
    if (!query.trim()) { setPeopleResults([]); return; }
    setPeopleLoading(true);
    peopleDebounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("User")
        .select("id, username, displayName, avatarUrl, uploadCount")
        .or(`username.ilike.%${query.replace(/^@/, "")}%,displayName.ilike.%${query}%`)
        .limit(20);
      setPeopleResults((data || []).filter((u: Person) => u.id !== currentUserId));
      setPeopleLoading(false);
    }, 280);
  }, [query, searchTab, currentUserId]);

  // Geocode zip → lat/lng via zippopotam.us
  async function geocodeZip(zip: string): Promise<{ lat: number; lng: number } | null> {
    if (zip.length !== 5) return null;
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!res.ok) return null;
      const data = await res.json();
      const place = data.places?.[0];
      if (!place) return null;
      return { lat: parseFloat(place.latitude), lng: parseFloat(place.longitude) };
    } catch {
      return null;
    }
  }

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
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      let qb = supabase
        .from("Course")
        .select("id, name, city, state, holeCount, isPublic, courseType, uploadCount, logoUrl");

      if (hasQuery) {
        qb = qb.or(`name.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%`);
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

      const { data } = await qb.order("uploadCount", { ascending: false }).limit(50);
      setResults(data || []);
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
        if (!coords) { setZipError("Zip code not found"); return; }
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
    router.replace(`/search?${params.toString()}`, { scroll: false });
  }

  function clearFilters() {
    setFilterState(""); setFilterCity(""); setFilterZip(""); setFilterHoles("all"); setZipCoords(null);
    setFilterCourseType(""); setFilterRadius("25");
    setDraftState(""); setDraftCity(""); setDraftZip(""); setDraftHoles("all");
    setDraftCourseType(""); setDraftRadius("25");
    setZipError("");
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    router.replace(`/search?${params.toString()}`, { scroll: false });
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
      await supabase.from("Follow").insert({ id: crypto.randomUUID(), followerId: currentUserId, followingId: targetId, createdAt: new Date().toISOString() });
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
    const slug = `${newName}-${newCity}-${newState}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
    const now = new Date().toISOString();
    const { data, error } = await supabase.from("Course").insert({
      id: crypto.randomUUID(),
      name: newName.trim(), city: newCity.trim(), state: newState.trim().toUpperCase(),
      country: "US", holeCount: parseInt(newHoles) || 18, isPublic: newPublic,
      slug, uploadCount: 0, saveCount: 0, viewCount: 0,
      createdAt: now, updatedAt: now,
    }).select("id").single();
    setCreating(false);
    if (error) { setCreateError(error.message); return; }
    router.push(`/courses/${data.id}`);
  };

  return (
    <main style={{ minHeight: "100vh", background: "#07100a", color: "#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07100a; }
        .search-wrap { max-width: 600px; margin: 0 auto; padding: 0 20px 120px; }
        .search-box { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.05); border: 1.5px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 15px 18px; transition: border-color 0.2s, box-shadow 0.2s; }
        .search-box.focused { border-color: rgba(77,168,98,0.5); box-shadow: 0 0 0 4px rgba(77,168,98,0.07); }
        .search-input { background: none; border: none; outline: none; width: 100%; font-family: 'Outfit', sans-serif; font-size: 16px; color: #fff; }
        .search-input::placeholder { color: rgba(255,255,255,0.22); }
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
        {/* Header */}
        <div style={{ padding: "56px 0 16px" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 16 }}>
            Search
          </div>
          <div className={`search-box ${focused ? "focused" : ""}`}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={setInputRef}
              className="search-input"
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={searchTab === "courses" ? "Search courses…" : "Name or @username"}
              autoComplete="off"
            />
            {query && (
              <button className="clear-btn" onClick={() => { setQuery(""); inputRef.current?.focus(); }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* Tabs + Filter button */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
            {(["courses", "people"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setSearchTab(tab); setQuery(""); setTimeout(() => inputRef.current?.focus(), 50); }}
                style={{ padding: "7px 18px", borderRadius: 99, border: "none", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer", background: searchTab === tab ? "#2d7a42" : "rgba(255,255,255,0.07)", color: searchTab === tab ? "#fff" : "rgba(255,255,255,0.45)", transition: "all 0.15s" }}
              >
                {tab === "courses" ? "Courses" : "People"}
              </button>
            ))}

            {/* Filter button — only on courses tab */}
            {searchTab === "courses" && (
              <button
                onClick={openFilterSheet}
                style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 99, border: `1px solid ${hasFilters ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.12)"}`, background: hasFilters ? "rgba(77,168,98,0.12)" : "rgba(255,255,255,0.05)", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: hasFilters ? "#4da862" : "rgba(255,255,255,0.45)", cursor: "pointer", transition: "all 0.15s" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
                </svg>
                Filter{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
              </button>
            )}
          </div>

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
              <div className="empty-hint">Search by name or @username</div>
            )}
            {!peopleLoading && peopleResults.map(person => (
              <div key={person.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div onClick={() => router.push(`/profile/${person.id}`)} style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.2)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  {person.avatarUrl ? <img src={person.avatarUrl} alt={person.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#4da862" }}>{(person.displayName || person.username)[0].toUpperCase()}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => router.push(`/profile/${person.id}`)}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.displayName}</div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>@{person.username}{person.uploadCount > 0 ? ` · ${person.uploadCount} clips` : ""}</div>
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

          {!loading && showResults && displayList.length === 0 && (
            <div className="empty-hint">
              No courses found<br/>
              <span style={{ fontSize: 12 }}>Try adjusting your search or filters</span>
            </div>
          )}

          {!loading && showResults && displayList.length > 0 && (
            <>
              <p className="section-label">{displayList.length} result{displayList.length !== 1 ? "s" : ""}</p>
              {displayList.map(course => {
                const abbr = course.name.split(" ").filter((w: string) => w.length > 2).map((w: string) => w[0]).join("").slice(0, 3).toUpperCase();
                return (
                  <div key={course.id} className="course-row" onClick={() => { addRecentSearch(course); router.push(`/courses/${course.id}`); }}>
                    <div className={`course-badge ${course.uploadCount > 0 ? "has-clips" : ""}`} style={{ overflow: "hidden", padding: course.logoUrl ? 0 : undefined }}>
                      {course.logoUrl ? <img src={course.logoUrl} alt={course.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10, backgroundColor: "#fff" }} /> : abbr}
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
                      {course.logoUrl ? <img src={course.logoUrl} alt={course.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10, backgroundColor: "#fff" }} /> : abbr}
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
                      {course.logoUrl ? <img src={course.logoUrl} alt={course.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", borderRadius: 10, backgroundColor: "#fff" }} /> : abbr}
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

          {showResults && !loading && (
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Don&apos;t see your course?</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>Add it so others can scout it</div>
              </div>
              <button onClick={() => { setNewName(query); setAddOpen(true); }} style={{ background: "rgba(77,168,98,0.15)", border: "1px solid rgba(77,168,98,0.35)", borderRadius: 10, padding: "9px 16px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#4da862", cursor: "pointer", whiteSpace: "nowrap" }}>
                + Add Course
              </button>
            </div>
          )}
        </>}
      </div>

      {/* Filter bottom sheet */}
      {filterOpen && (
        <>
          <div onClick={() => setFilterOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 120, background: "#0d2318", border: "1px solid rgba(77,168,98,0.15)", borderRadius: "20px 20px 0 0", padding: "20px 20px 100px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 20px" }} />
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

      {/* Create course bottom sheet */}
      {addOpen && (
        <>
          <div onClick={() => setAddOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, background: "#0d2318", border: "1px solid rgba(77,168,98,0.2)", borderRadius: "20px 20px 0 0", padding: "20px 20px 48px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 20px" }} />
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
                  <button onClick={() => setNewPublic(p => !p)} style={{ width: "100%", background: newPublic ? "rgba(77,168,98,0.12)" : "rgba(255,255,255,0.06)", border: `1px solid ${newPublic ? "rgba(77,168,98,0.35)" : "rgba(255,255,255,0.1)"}`, borderRadius: 10, padding: "11px 14px", fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: newPublic ? "#4da862" : "rgba(255,255,255,0.5)", cursor: "pointer" }}>
                    {newPublic ? "Public" : "Private"}
                  </button>
                </div>
              </div>
              {createError && <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#ef4444" }}>{createError}</div>}
              <button onClick={handleCreate} disabled={creating} style={{ background: "#2d7a42", border: "none", borderRadius: 12, padding: "14px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff", cursor: creating ? "default" : "pointer", opacity: creating ? 0.6 : 1, marginTop: 4 }}>
                {creating ? "Creating…" : "Add Course"}
              </button>
            </div>
          </div>
        </>
      )}

      <BottomNav />
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageInner />
    </Suspense>
  );
}
