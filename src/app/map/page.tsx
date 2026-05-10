"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import { findClosestItinerary, type ItineraryCentroid } from "@/lib/geo";

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

  // Dart-throw state (additive — Phase 3B)
  const [dartMode, setDartMode] = useState(false);
  const [dartPhase, setDartPhase] = useState<"idle" | "aiming" | "thrown" | "revealing">("idle");
  const [dartPosition, setDartPosition] = useState<{ x: number; y: number } | null>(null);
  const [dartResult, setDartResult] = useState<ItineraryCentroid | null>(null);
  const [itineraries, setItineraries] = useState<ItineraryCentroid[]>([]);

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

  // Fetch itinerary centroids + auto-open dart mode if ?dart=true
  useEffect(() => {
    fetch("/api/itineraries/centroids")
      .then((r) => r.json())
      .then((data: ItineraryCentroid[]) => setItineraries(Array.isArray(data) ? data : []))
      .catch((err) => console.error("centroids fetch error:", err));

    const params = new URLSearchParams(window.location.search);
    if (params.get("dart") === "true") {
      setDartMode(true);
      setDartPhase("aiming");
    }
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
      // Single SVG pin — logo rendered as <image> inside the SVG so there
      // are no z-index/stacking issues between the fill and the logo.
      // clipPath id is unique per course to avoid conflicts across pins.
      const clipId = `lc-${course.id.slice(0, 8)}`;
      // Teardrop path shared by fill + stroke layers
      const tearPath = `M22 54 C22 54 3 36 3 21 C3 11 11 3 22 3 C33 3 41 11 41 21 C41 36 22 54 22 54Z`;

      // Logo: rendered as SVG <image> between the fill and the stroke border
      const logoLayer = course.logoUrl
        ? `<defs>
             <clipPath id="${clipId}">
               <rect x="9" y="8" width="26" height="26" rx="5"/>
             </clipPath>
           </defs>
           <image href="${course.logoUrl}" x="9" y="8" width="26" height="26"
             clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`
        : "";

      const pinHtml = `
        <div style="cursor:pointer;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.6))">
          <svg width="44" height="56" viewBox="0 0 44 56" xmlns="http://www.w3.org/2000/svg">
            <path d="${tearPath}" fill="#1e5c2e" stroke="none"/>
            ${logoLayer}
            <path d="${tearPath}" fill="none" stroke="#4da862" stroke-width="2"/>
          </svg>
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

  // Fetch suggestions: courses from DB + locations from Nominatim (+ fast ZIP via zippopotam.us)
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setLoadingSuggestions(true);
    const isZip = /^\d{5}$/.test(q.trim());
    try {
      const [dbRes, nominatimRes] = await Promise.allSettled([
        supabase
          .from("Course")
          .select("id, name, city, state, logoUrl, latitude, longitude")
          .or(`name.ilike.%${q}%,city.ilike.%${q}%`)
          .order("uploadCount", { ascending: false })
          .limit(6),
        isZip
          ? fetch(`https://api.zippopotam.us/us/${q.trim()}`).then(async r => {
              if (!r.ok) throw new Error("zip not found");
              const d = await r.json();
              const place = d.places?.[0];
              if (!place) throw new Error("no place");
              return [{ lat: place.latitude, lon: place.longitude, display_name: `${q.trim()} — ${place["place name"]}, ${d["state abbreviation"]}`, type: "postcode", address: { postcode: q.trim(), city: place["place name"], ISO3166_2_lvl4: `US-${d["state abbreviation"]}` } }];
            })
          : fetch(
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

        /* Phase 3B — dart-throw animations */
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes dart-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(77,168,98,0); }
          50%       { box-shadow: 0 0 0 8px rgba(77,168,98,0.2); }
        }
        @keyframes crosshair-drift {
          0%   { transform: translate(0px, 0px); }
          20%  { transform: translate(18px, -12px); }
          40%  { transform: translate(-10px, 20px); }
          60%  { transform: translate(22px, 8px); }
          80%  { transform: translate(-15px, -18px); }
          100% { transform: translate(0px, 0px); }
        }
        @keyframes dart-fly-in {
          0%   { transform: translate(110px, -200px) rotate(-50deg); opacity: 0; }
          20%  { opacity: 1; }
          75%  { transform: translate(0, 0) rotate(7deg); }
          88%  { transform: translate(0, 0) rotate(-3deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        @keyframes dart-wobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(2deg); }
          50% { transform: rotate(-1.5deg); }
          75% { transform: rotate(0.5deg); }
        }
        @keyframes ripple-out {
          0%   { transform: scale(0); opacity: 0.6; }
          100% { transform: scale(4); opacity: 0; }
        }
        @keyframes reveal-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
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
            display: dartPhase === "revealing" ? "none" : "block",
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

        {/* ── Phase 3B: Dart-throw UX ───────────────────────────────────── */}

        {/* A. Dart button — hidden once dart mode opens */}
        {!dartMode && (
          <div style={{
            position: "absolute",
            top: 140,
            right: 16,
            zIndex: 490,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            pointerEvents: "all",
          }}>
            <button
              onClick={() => {
                // Zoom out to US so the dart has the whole map to land on.
                if (mapRef.current) {
                  skipNextMoveRef.current = true;
                  mapRef.current.flyTo([39.5, -98.35], 4, { duration: 0.9 });
                }
                setDartMode(true);
                setDartPhase("aiming");
              }}
              aria-label="Throw a dart"
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "rgba(7,16,10,0.92)",
                border: "1px solid rgba(77,168,98,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                animation: "dart-pulse 1.2s ease-in-out 3",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#4da862" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="6" stroke="#4da862" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="2.5" fill="#4da862" />
              </svg>
            </button>
            <span style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 9,
              color: "#4da862",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              textShadow: "0 1px 4px rgba(0,0,0,0.6)",
            }}>
              Throw a Dart
            </span>
          </div>
        )}

        {/* B. Aiming overlay + crosshair */}
        {dartMode && dartPhase === "aiming" && (
          <div
            onClick={(e) => {
              if (!mapContainerRef.current) return;
              const rect = mapContainerRef.current.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              setDartPosition({ x, y });
              setDartPhase("thrown");

              const L = (window as any)._leafletL;
              if (L && mapRef.current && itineraries.length > 0) {
                const containerPoint = L.point(x, y);
                const latlng = mapRef.current.containerPointToLatLng(containerPoint);
                const wobbleLat = latlng.lat + (Math.random() - 0.5) * 1.0;
                const wobbleLng = latlng.lng + (Math.random() - 0.5) * 1.0;
                const result = findClosestItinerary(wobbleLat, wobbleLng, itineraries);
                setDartResult(result);

                // Haptic feedback on supported devices (mostly Android Chrome / iOS PWAs)
                if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                  try { navigator.vibrate([8, 40, 16]); } catch {}
                }

                fetch(`/api/itineraries/${result.id}/throw`, { method: "POST" }).catch(() => {});

                setTimeout(() => setDartPhase("revealing"), 850);
              } else {
                // Centroids haven't loaded yet — bail out gracefully
                setDartMode(false);
                setDartPhase("idle");
                setDartPosition(null);
              }
            }}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 600,
              background: "rgba(7,16,10,0.15)",
              cursor: "crosshair",
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDartMode(false);
                setDartPhase("idle");
              }}
              aria-label="Cancel"
              style={{
                position: "absolute",
                top: "max(env(safe-area-inset-top, 0px), 12px)",
                right: 16,
                width: 32, height: 32,
                borderRadius: "50%",
                background: "rgba(7,16,10,0.85)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
                fontSize: 16,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
              }}
            >✕</button>

            <div style={{
              position: "absolute",
              top: "16%",
              left: "50%",
              transform: "translateX(-50%)",
              textAlign: "center",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              textShadow: "0 1px 6px rgba(0,0,0,0.7)",
            }}>
              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 22,
                fontWeight: 700,
                color: "#fff",
                marginBottom: 4,
              }}>
                Tap anywhere
              </div>
              <div style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 11,
                color: "rgba(77,168,98,0.95)",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}>
                Your dart picks the trip
              </div>
            </div>

            <div style={{
              position: "absolute",
              top: "45%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              animation: "crosshair-drift 2.8s ease-in-out infinite",
              pointerEvents: "none",
            }}>
              <div style={{ position: "relative", width: 60, height: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ position: "absolute", width: 60, height: 60, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.4)" }} />
                <div style={{ position: "absolute", width: 30, height: 30, borderRadius: "50%", border: "1.5px solid rgba(77,168,98,0.6)" }} />
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4da862" }} />
              </div>
            </div>
          </div>
        )}

        {/* C. Dart landing — ripple + flying red dart */}
        {dartMode && dartPhase === "thrown" && dartPosition && (
          <div style={{ position: "absolute", inset: 0, zIndex: 600, pointerEvents: "none" }}>
            {/* Impact ripple — delayed slightly so it fires when the dart lands */}
            <div style={{
              position: "absolute",
              left: dartPosition.x - 22,
              top: dartPosition.y - 22,
              width: 44, height: 44,
              borderRadius: "50%",
              border: "2px solid #4da862",
              animation: "ripple-out 700ms ease-out 350ms forwards",
              opacity: 0,
            }} />
            <div style={{
              position: "absolute",
              left: dartPosition.x - 24,
              top: dartPosition.y - 24,
              width: 48, height: 48,
              borderRadius: "50%",
              border: "1.5px solid rgba(220, 38, 38, 0.7)",
              animation: "ripple-out 800ms ease-out 350ms forwards",
              opacity: 0,
            }} />

            {/* Realistic red dart, anchored so the tip lands on dartPosition */}
            <div style={{
              position: "absolute",
              left: dartPosition.x - 16,
              top: dartPosition.y - 56,
              width: 32, height: 56,
              transformOrigin: "50% 100%",
              animation: "dart-fly-in 480ms cubic-bezier(0.4, 1.4, 0.55, 1) forwards",
              filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.55))",
            }}>
              <svg width="32" height="56" viewBox="0 0 32 56" fill="none">
                {/* Flights — three red panels for a bit of dimensionality */}
                <path d="M16 2 L26 13 L16 9 Z"  fill="#dc2626" />
                <path d="M16 2 L6 13 L16 9 Z"   fill="#ef4444" />
                <path d="M6 13 L13 16 L16 9 Z"  fill="#b91c1c" />
                <path d="M26 13 L19 16 L16 9 Z" fill="#b91c1c" />
                {/* Shaft — white plastic */}
                <rect x="14" y="13" width="4" height="22" fill="#f3f4f6" />
                <line x1="14" y1="13" x2="14" y2="35" stroke="#9ca3af" strokeWidth="0.5" />
                <line x1="18" y1="13" x2="18" y2="35" stroke="#9ca3af" strokeWidth="0.5" />
                {/* Barrel — silver grip */}
                <rect x="13" y="33" width="6" height="13" rx="1" fill="#71717a" />
                <line x1="13" y1="36" x2="19" y2="36" stroke="#3f3f46" strokeWidth="0.5" />
                <line x1="13" y1="40" x2="19" y2="40" stroke="#3f3f46" strokeWidth="0.5" />
                <line x1="13" y1="44" x2="19" y2="44" stroke="#3f3f46" strokeWidth="0.5" />
                {/* Tip — silver point */}
                <path d="M13 46 L19 46 L16 55 Z" fill="#a1a1aa" />
                <path d="M16 49 L16 55 L19 46 Z" fill="#71717a" />
              </svg>
            </div>
          </div>
        )}

        {/* D. Reveal sheet */}
        {dartMode && dartPhase === "revealing" && dartResult && (
          <>
            <div
              onClick={() => { setDartMode(false); setDartPhase("idle"); setDartResult(null); setDartPosition(null); }}
              style={{ position: "absolute", inset: 0, zIndex: 601 }}
            />
            <div style={{
              position: "absolute",
              bottom: 0, left: 0, right: 0,
              zIndex: 602,
              background: "#0e1a13",
              borderRadius: "20px 20px 0 0",
              border: "1px solid rgba(77,168,98,0.25)",
              padding: "20px 20px",
              paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
              animation: "reveal-up 380ms cubic-bezier(0.34,1.56,0.64,1) forwards",
            }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", margin: "0 auto 20px" }} />

              <div style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 10,
                color: "#4da862",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}>
                🎯 Your dart landed on...
              </div>

              <div style={{
                display: "inline-block",
                border: "1px solid rgba(77,168,98,0.4)",
                borderRadius: 20,
                padding: "3px 10px",
                fontFamily: "'Outfit', sans-serif",
                fontSize: 10,
                color: "#4da862",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginTop: 4,
                marginBottom: 16,
              }}>
                {dartResult.vibeTag.replace(/_/g, " ")}
              </div>

              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 26, fontWeight: 700, color: "#fff",
                lineHeight: 1.2, marginBottom: 6,
              }}>
                {dartResult.name}
              </div>

              <div style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 14, color: "rgba(255,255,255,0.65)",
                marginBottom: 16, lineHeight: 1.5,
              }}>
                {dartResult.tagline}
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {[`${dartResult.durationDays} ${dartResult.durationDays === 1 ? "Day" : "Days"}`, dartResult.costBand].map((p) => (
                  <div key={p} style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 20,
                    padding: "4px 12px",
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.7)",
                  }}>{p}</div>
                ))}
              </div>

              <button
                onClick={() => router.push(`/trip-ideas/${dartResult.slug}`)}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "#2d7a42",
                  border: "1px solid #4da862",
                  borderRadius: 12,
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#fff",
                  cursor: "pointer",
                  marginBottom: 10,
                }}
              >
                See the Itinerary →
              </button>

              <button
                onClick={() => {
                  setDartResult(null);
                  setDartPosition(null);
                  setDartPhase("aiming");
                }}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 12,
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 14,
                  color: "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  marginBottom: 16,
                }}
              >
                Throw Again
              </button>

              <div style={{
                textAlign: "center",
                fontFamily: "'Outfit', sans-serif",
                fontSize: 11,
                color: "rgba(255,255,255,0.25)",
              }}>
                Thrown {dartResult.dartThrowCount.toLocaleString()} {dartResult.dartThrowCount === 1 ? "time" : "times"}
              </div>
            </div>
          </>
        )}

        <BottomNav />
      </div>
    </>
  );
}
