"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";

type MapCourse = {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  uploadCount: number;
  coverImageUrl: string | null;
  logoUrl: string | null;
  isPublic: boolean;
};

type CourseSuggestion = {
  type: "course";
  id: string;
  name: string;
  city: string;
  state: string;
  logoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
};

type LocationSuggestion = {
  type: "location";
  label: string;
  lat: number;
  lon: number;
  boundingbox?: string[];
};

type Suggestion = CourseSuggestion | LocationSuggestion;

const FALLBACK_CENTER: [number, number] = [39.5, -98.35];
const FALLBACK_ZOOM = 4;
const USER_ZOOM = 12;


export default function MapPage() {
  const router = useRouter();
  const supabase = createClient();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextMoveRef = useRef(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [courses, setCourses] = useState<MapCourse[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [courseCount, setCourseCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const cardStripRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchByBounds = useCallback(async (map: any) => {
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const params = new URLSearchParams({
      swLat: sw.lat.toFixed(6),
      swLng: sw.lng.toFixed(6),
      neLat: ne.lat.toFixed(6),
      neLng: ne.lng.toFixed(6),
    });
    const res = await fetch(`/api/courses/by-bounds?${params}`);
    if (!res.ok) return;
    const data: MapCourse[] = await res.json();
    setCourses(data);
    setCourseCount(data.length);
  }, []);

  const addMarkers = useCallback((L: any, map: any, data: MapCourse[]) => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    data.forEach(course => {
      // Teardrop pin: 44×56, circle top (r≈19) with logo inside, point at bottom
      const logoInner = course.logoUrl
        ? `<img src="${course.logoUrl}" style="width:26px;height:26px;border-radius:5px;object-fit:cover" />`
        : "";

      const pinHtml = `
        <div style="position:relative;width:44px;height:56px;cursor:pointer;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.6))">
          <svg width="44" height="56" viewBox="0 0 44 56" style="position:absolute;top:0;left:0;pointer-events:none">
            <path d="M22 54 C22 54 3 36 3 21 C3 11 11 3 22 3 C33 3 41 11 41 21 C41 36 22 54 22 54Z"
              fill="#1e5c2e" stroke="#4da862" stroke-width="2"/>
          </svg>
          <div style="position:absolute;top:8px;left:9px;width:26px;height:26px;border-radius:5px;overflow:hidden;display:flex;align-items:center;justify-content:center">
            ${logoInner}
          </div>
        </div>`;

      const icon = L.divIcon({
        html: pinHtml,
        className: "",
        iconSize: [44, 56],
        iconAnchor: [22, 56],
      });

      const marker = L.marker([course.latitude, course.longitude], { icon })
        .addTo(map)
        .on("click", () => {
          setSelectedId(course.id);
          skipNextMoveRef.current = true;
          map.flyTo([course.latitude, course.longitude], Math.max(map.getZoom(), 12), { duration: 0.6 });
        });

      markersRef.current.push(marker);
    });
  }, []);

  // Fetch suggestions: courses from DB + locations from Nominatim
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setLoadingSuggestions(true);
    try {
      const [dbRes, nominatimRes] = await Promise.allSettled([
        supabase
          .from("Course")
          .select("id, name, city, state, logoUrl, latitude, longitude")
          .or(`name.ilike.%${q}%,city.ilike.%${q}%`)
          .order("uploadCount", { ascending: false })
          .limit(6),
        fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=us&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        ).then(r => r.json()),
      ]);

      const courseSuggestions: CourseSuggestion[] =
        dbRes.status === "fulfilled"
          ? (dbRes.value.data ?? []).map((c: any) => ({ type: "course" as const, ...c }))
          : [];

      const locationSuggestions: LocationSuggestion[] =
        nominatimRes.status === "fulfilled"
          ? (nominatimRes.value ?? []).map((r: any) => {
              const addr = r.address ?? {};
              const city = addr.city || addr.town || addr.village || addr.county || "";
              const stateCode = addr.ISO3166_2_lvl4?.replace("US-", "") || addr.state || "";
              const zip = addr.postcode || "";
              let label = "";
              if (zip && r.type === "postcode") {
                label = `${zip}${city ? ` — ${city}` : ""}${stateCode ? `, ${stateCode}` : ""}`;
              } else {
                label = [city, stateCode].filter(Boolean).join(", ") || r.display_name.split(",").slice(0, 2).join(",");
              }
              return {
                type: "location" as const,
                label,
                lat: parseFloat(r.lat),
                lon: parseFloat(r.lon),
                boundingbox: r.boundingbox,
              };
            }).filter((l: LocationSuggestion, i: number, arr: LocationSuggestion[]) =>
              arr.findIndex(x => x.label === l.label) === i
            )
          : [];

      const combined: Suggestion[] = [...courseSuggestions, ...locationSuggestions];
      setSuggestions(combined);
      setShowDropdown(combined.length > 0);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [supabase]);

  const handleQueryChange = useCallback((val: string) => {
    setSearchQuery(val);
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    if (val.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    suggestDebounceRef.current = setTimeout(() => fetchSuggestions(val), 280);
  }, [fetchSuggestions]);

  const handleSelectSuggestion = useCallback((s: Suggestion) => {
    setShowDropdown(false);
    setSearchQuery(s.type === "course" ? s.name : s.label);
    if (!mapRef.current) return;

    if (s.type === "course") {
      if (s.latitude != null && s.longitude != null) {
        skipNextMoveRef.current = true;
        mapRef.current.flyTo([s.latitude, s.longitude], 14, { duration: 1.2 });
        // Briefly highlight — the pin click will handle selectedId
        setSelectedId(s.id);
      } else {
        router.push(`/courses/${s.id}?from=map`);
      }
    } else {
      skipNextMoveRef.current = true;
      if (s.boundingbox) {
        mapRef.current.fitBounds(
          [[parseFloat(s.boundingbox[0]), parseFloat(s.boundingbox[2])],
           [parseFloat(s.boundingbox[1]), parseFloat(s.boundingbox[3])]],
          { maxZoom: 12, duration: 1.2 }
        );
      } else {
        mapRef.current.flyTo([s.lat, s.lon], 12, { duration: 1.2 });
      }
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    let L: any = null;
    let map: any = null;

    const initMap = async () => {
      if (!mapContainerRef.current) return;

      L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (cancelled) return;

      map = L.map(mapContainerRef.current, {
        center: FALLBACK_CENTER,
        zoom: FALLBACK_ZOOM,
        zoomControl: false,
        attributionControl: false,
      });

      mapRef.current = map;
      (window as any)._leafletL = L;

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { subdomains: "abcd", maxZoom: 19 }
      ).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control.attribution({ position: "bottomleft", prefix: "© OpenStreetMap © CARTO" }).addTo(map);

      fetchByBounds(map);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const { latitude, longitude } = pos.coords;
          skipNextMoveRef.current = true;
          map.flyTo([latitude, longitude], USER_ZOOM, { duration: 1.8 });

          const dot = L.divIcon({
            html: `<div style="width:14px;height:14px;border-radius:50%;background:#4da862;border:2.5px solid #fff;box-shadow:0 0 0 4px rgba(77,168,98,0.25)"></div>`,
            className: "",
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
          L.marker([latitude, longitude], { icon: dot, zIndexOffset: 1000 }).addTo(map);
        },
        () => {},
        { enableHighAccuracy: false, timeout: 8000 }
      );

      map.on("moveend", () => {
        if (skipNextMoveRef.current) { skipNextMoveRef.current = false; return; }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchByBounds(map), 300);
      });
    };

    initMap();
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
      map?.remove();
    };
  }, [fetchByBounds]);

  useEffect(() => {
    const L = (window as any)._leafletL;
    if (L && mapRef.current) addMarkers(L, mapRef.current, courses);
  }, [courses, addMarkers]);

  useEffect(() => {
    if (!selectedId || !cardStripRef.current) return;
    const idx = courses.findIndex(c => c.id === selectedId);
    if (idx === -1) return;
    const card = cardStripRef.current.children[idx] as HTMLElement;
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedId, courses]);

  const courseSuggestions = suggestions.filter(s => s.type === "course") as CourseSuggestion[];
  const locationSuggestions = suggestions.filter(s => s.type === "location") as LocationSuggestion[];

  return (
    <>
      <style>{`
        .leaflet-container { background: #07100a !important; }
        .leaflet-control-zoom { margin-bottom: 160px !important; margin-right: 12px !important; }
        .leaflet-control-zoom a { background: rgba(15,30,18,0.92) !important; border-color: rgba(255,255,255,0.12) !important; color: #fff !important; width: 32px !important; height: 32px !important; line-height: 32px !important; font-size: 16px !important; }
        .leaflet-control-zoom a:hover { background: rgba(45,122,66,0.4) !important; }
        .leaflet-control-attribution { background: rgba(7,16,10,0.7) !important; color: rgba(255,255,255,0.3) !important; font-size: 9px !important; margin-bottom: 80px !important; }
        .leaflet-control-attribution a { color: rgba(255,255,255,0.4) !important; }
        .card-strip::-webkit-scrollbar { display: none; }
        .map-search-input { background: none; border: none; outline: none; font-family: 'Outfit', sans-serif; font-size: 14px; color: #fff; flex: 1; min-width: 0; }
        .map-search-input::placeholder { color: rgba(255,255,255,0.3); }
        .suggest-item:active { background: rgba(255,255,255,0.06) !important; }
      `}</style>

      <div style={{ position: "fixed", inset: 0, background: "#07100a", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 500,
          paddingTop: "max(env(safe-area-inset-top, 0px), 12px)",
          paddingBottom: 10,
          paddingLeft: 16,
          paddingRight: 16,
          background: "linear-gradient(to bottom, rgba(7,16,10,0.97) 70%, transparent 100%)",
          pointerEvents: "none",
        }}>
          {/* Back + title row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <button
              onClick={() => router.back()}
              style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, pointerEvents: "all" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#fff", lineHeight: 1 }}>Courses Near Me</div>
              {courseCount > 0 && (
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {courseCount} course{courseCount !== 1 ? "s" : ""} in view
                </div>
              )}
            </div>
          </div>

          {/* Search bar + dropdown */}
          <div ref={searchRef} style={{ position: "relative", pointerEvents: "all" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.08)", border: `1px solid ${showDropdown ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.12)"}`, borderRadius: showDropdown ? "12px 12px 0 0" : 12, padding: "9px 12px", transition: "border-color 0.15s, border-radius 0.1s" }}>
              {loadingSuggestions ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.7)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, animation: "spin 0.8s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-9-9"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              )}
              <input
                className="map-search-input"
                type="text"
                value={searchQuery}
                onChange={e => handleQueryChange(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
                placeholder="Search courses, cities, zip codes…"
                autoComplete="off"
              />
              {searchQuery.length > 0 && (
                <button type="button" onClick={() => { setSearchQuery(""); setSuggestions([]); setShowDropdown(false); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showDropdown && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 600,
                background: "rgba(10,22,13,0.98)",
                border: "1px solid rgba(77,168,98,0.4)",
                borderTop: "1px solid rgba(77,168,98,0.2)",
                borderRadius: "0 0 12px 12px",
                overflow: "hidden",
                maxHeight: 320,
                overflowY: "auto",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
              }}>
                {courseSuggestions.length > 0 && (
                  <>
                    <div style={{ padding: "8px 14px 4px", fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
                      Golf Courses
                    </div>
                    {courseSuggestions.map(s => (
                      <button
                        key={s.id}
                        className="suggest-item"
                        onMouseDown={() => handleSelectSuggestion(s)}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.1s" }}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 7, flexShrink: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {s.logoUrl ? (
                            <img src={s.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.5)" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{s.city}, {s.state}</div>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    ))}
                  </>
                )}

                {locationSuggestions.length > 0 && (
                  <>
                    <div style={{ padding: "8px 14px 4px", fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", borderTop: courseSuggestions.length > 0 ? "1px solid rgba(255,255,255,0.06)" : "none", marginTop: courseSuggestions.length > 0 ? 4 : 0 }}>
                      Locations
                    </div>
                    {locationSuggestions.map((s, i) => (
                      <button
                        key={i}
                        className="suggest-item"
                        onMouseDown={() => handleSelectSuggestion(s)}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.1s" }}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 7, flexShrink: 0, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3,11 3,20 9,17 15,20 21,17 21,8 15,11 9,8"/><line x1="9" y1="8" x2="9" y2="17"/><line x1="15" y1="11" x2="15" y2="20"/></svg>
                        </div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {s.label}
                        </div>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, zIndex: 1 }} />

        {/* Bottom card strip */}
        {courses.length > 0 && (
          <div style={{
            position: "absolute", bottom: 80, left: 0, right: 0, zIndex: 500,
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}>
            <div
              ref={cardStripRef}
              className="card-strip"
              style={{
                display: "flex", gap: 10, overflowX: "auto", overflowY: "hidden",
                padding: "8px 16px 4px",
                scrollbarWidth: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {courses.map(course => (
                <button
                  key={course.id}
                  onClick={() => {
                    if (selectedId === course.id) {
                      router.push(`/courses/${course.id}?from=map`);
                    } else {
                      setSelectedId(course.id);
                      if (mapRef.current) {
                        skipNextMoveRef.current = true;
                        mapRef.current.flyTo([course.latitude, course.longitude], Math.max(mapRef.current.getZoom(), 12), { duration: 0.6 });
                      }
                    }
                  }}
                  style={{
                    flexShrink: 0, width: 200,
                    background: selectedId === course.id ? "rgba(45,122,66,0.25)" : "rgba(7,16,10,0.88)",
                    border: `1px solid ${selectedId === course.id ? "rgba(77,168,98,0.6)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 14, padding: "10px 12px",
                    display: "flex", alignItems: "center", gap: 10,
                    cursor: "pointer", textAlign: "left",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    transition: "border-color 0.2s, background 0.2s",
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {course.logoUrl ? (
                      <img src={course.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : course.coverImageUrl ? (
                      <img src={course.coverImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.45)" strokeWidth="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3 }}>{course.name}</div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{course.city}, {course.state}</div>
                    {course.uploadCount > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#4da862"><polygon points="5,3 19,12 5,21"/></svg>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "#4da862", fontWeight: 600 }}>{course.uploadCount} clip{course.uploadCount !== 1 ? "s" : ""}</span>
                      </div>
                    )}
                  </div>
                  {selectedId === course.id && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <BottomNav />
      </div>
    </>
  );
}
