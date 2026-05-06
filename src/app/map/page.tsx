"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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

const FALLBACK_CENTER: [number, number] = [39.5, -98.35];
const FALLBACK_ZOOM = 4;
const USER_ZOOM = 12;

// Golf flag icon used as pin fallback when no course logo
const flagSvg = `<svg width="18" height="22" viewBox="0 0 18 22" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="5" y1="2" x2="5" y2="20" stroke="#4da862" stroke-width="1.8" stroke-linecap="round"/><path d="M5 2 L15 6 L5 10Z" fill="#4da862"/><ellipse cx="5" cy="20" rx="3.5" ry="1.5" fill="rgba(77,168,98,0.25)"/></svg>`;

export default function MapPage() {
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextMoveRef = useRef(false);

  const [courses, setCourses] = useState<MapCourse[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [courseCount, setCourseCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const cardStripRef = useRef<HTMLDivElement>(null);

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
      const hasClips = course.uploadCount > 0;
      const count = course.uploadCount > 99 ? "99+" : String(course.uploadCount);
      const borderColor = hasClips ? "#4da862" : "rgba(77,168,98,0.45)";
      const fillColor = hasClips ? "#1e5c2e" : "#162b1e";

      // Clip count badge top-right of the pin
      const badgeHtml = hasClips
        ? `<div style="position:absolute;top:-5px;right:-7px;background:#4da862;color:#fff;font-family:'Outfit',sans-serif;font-size:9px;font-weight:700;border-radius:99px;padding:1px 5px;min-width:17px;text-align:center;line-height:15px;border:1.5px solid #07100a;z-index:2">${count}</div>`
        : "";

      // Square logo with rounded corners inside the pin — or a golf flag fallback
      const logoInner = course.logoUrl
        ? `<img src="${course.logoUrl}" style="width:34px;height:34px;border-radius:7px;object-fit:cover;border:1.5px solid rgba(255,255,255,0.15)" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div style="display:none;width:34px;height:34px;align-items:center;justify-content:center">${flagSvg}</div>`
        : `<div style="width:34px;height:34px;display:flex;align-items:center;justify-content:center">${flagSvg}</div>`;

      // Teardrop pin shape matching Tour It logo style
      // 54×68px total: 48px circle on top, 20px tail pointing down
      const pinHtml = `
        <div style="position:relative;width:54px;height:68px;cursor:pointer;filter:drop-shadow(0 3px 10px rgba(0,0,0,0.65))">
          <svg width="54" height="68" viewBox="0 0 54 68" style="position:absolute;top:0;left:0;pointer-events:none">
            <path d="M27 66 C27 66 3 44 3 26 C3 13.3 13.3 3 27 3 C40.7 3 51 13.3 51 26 C51 44 27 66 27 66Z"
              fill="${fillColor}" stroke="${borderColor}" stroke-width="2.5"/>
          </svg>
          <div style="position:absolute;top:9px;left:10px;width:34px;height:34px;border-radius:7px;overflow:hidden;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center">
            ${logoInner}
          </div>
          ${badgeHtml}
        </div>`;

      const icon = L.divIcon({
        html: pinHtml,
        className: "",
        iconSize: [54, 68],
        iconAnchor: [27, 68],
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

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q || !mapRef.current) return;
    setSearching(true);
    setSearchError("");
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=us`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const results = await res.json();
      if (!results?.length) {
        setSearchError("Location not found");
        return;
      }
      const { lat, lon, boundingbox } = results[0];
      if (boundingbox) {
        skipNextMoveRef.current = true;
        mapRef.current.fitBounds(
          [[parseFloat(boundingbox[0]), parseFloat(boundingbox[2])], [parseFloat(boundingbox[1]), parseFloat(boundingbox[3])]],
          { maxZoom: 12, duration: 1.2 }
        );
      } else {
        skipNextMoveRef.current = true;
        mapRef.current.flyTo([parseFloat(lat), parseFloat(lon)], 12, { duration: 1.2 });
      }
    } catch {
      setSearchError("Search failed — try again");
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

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

      // Zoom controls bottom-right, above the card strip
      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.control
        .attribution({ position: "bottomleft", prefix: "© OpenStreetMap © CARTO" })
        .addTo(map);

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
        .map-search-input::placeholder { color: rgba(255,255,255,0.3); }
        .map-search-input { background: none; border: none; outline: none; font-family: 'Outfit', sans-serif; font-size: 14px; color: #fff; flex: 1; min-width: 0; }
      `}</style>

      <div style={{ position: "fixed", inset: 0, background: "#07100a", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 500,
          paddingTop: "max(env(safe-area-inset-top, 0px), 12px)",
          paddingBottom: 10,
          paddingLeft: 16,
          paddingRight: 16,
          background: "linear-gradient(to bottom, rgba(7,16,10,0.95) 60%, transparent 100%)",
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
            <div style={{ flex: 1, pointerEvents: "none" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#fff", lineHeight: 1 }}>Courses Near Me</div>
              {courseCount > 0 && (
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {courseCount} course{courseCount !== 1 ? "s" : ""} in view
                </div>
              )}
            </div>
          </div>

          {/* Search bar */}
          <form
            onSubmit={e => { e.preventDefault(); handleSearch(); }}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "9px 12px", pointerEvents: "all" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              className="map-search-input"
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchError(""); }}
              placeholder="Search city or zip code…"
              autoComplete="off"
            />
            {searchQuery.length > 0 && (
              <button type="button" onClick={() => { setSearchQuery(""); setSearchError(""); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
            <button
              type="submit"
              disabled={searching || searchQuery.trim().length === 0}
              style={{ background: searching || searchQuery.trim().length === 0 ? "rgba(255,255,255,0.06)" : "#2d7a42", border: "none", borderRadius: 8, padding: "5px 10px", cursor: searching || searchQuery.trim().length === 0 ? "default" : "pointer", transition: "background 0.2s", flexShrink: 0 }}
            >
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: searching || searchQuery.trim().length === 0 ? "rgba(255,255,255,0.3)" : "#fff" }}>
                {searching ? "…" : "Go"}
              </span>
            </button>
          </form>
          {searchError && (
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "#e8353a", marginTop: 6, paddingLeft: 4, pointerEvents: "none" }}>{searchError}</div>
          )}
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
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {course.logoUrl ? (
                      <img src={course.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : course.coverImageUrl ? (
                      <img src={course.coverImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.45)" strokeWidth="2">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                        <circle cx="12" cy="9" r="2.5"/>
                      </svg>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3 }}>
                      {course.name}
                    </div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                      {course.city}, {course.state}
                    </div>
                    {course.uploadCount > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#4da862"><polygon points="5,3 19,12 5,21"/></svg>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "#4da862", fontWeight: 600 }}>
                          {course.uploadCount} clip{course.uploadCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                  </div>

                  {selectedId === course.id && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
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
