"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import "mapbox-gl/dist/mapbox-gl.css";

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

const FALLBACK_CENTER: [number, number] = [-98.35, 39.5];
const FALLBACK_ZOOM = 4;
const USER_ZOOM = 11;

export default function MapPage() {
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextMoveRef = useRef(false);

  const [courses, setCourses] = useState<MapCourse[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const cardStripRef = useRef<HTMLDivElement>(null);

  const selectedCourse = courses.find(c => c.id === selectedId) ?? null;

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
  }, []);

  const addMarkers = useCallback((map: any, data: MapCourse[]) => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    data.forEach(course => {
      const el = document.createElement("div");
      el.style.cssText = `
        width: 36px; height: 36px; border-radius: 50%;
        background: ${course.uploadCount > 0 ? "#2d7a42" : "#1a3d22"};
        border: 2px solid ${course.uploadCount > 0 ? "#4da862" : "rgba(77,168,98,0.4)"};
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; position: relative;
        box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        transition: transform 0.15s;
      `;

      if (course.logoUrl) {
        const img = document.createElement("img");
        img.src = course.logoUrl;
        img.style.cssText = "width: 24px; height: 24px; border-radius: 50%; object-fit: cover;";
        img.onerror = () => { img.style.display = "none"; el.innerHTML += `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da862" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`; };
        el.appendChild(img);
      } else {
        el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4da862" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>`;
      }

      if (course.uploadCount > 0) {
        const badge = document.createElement("div");
        badge.style.cssText = `
          position: absolute; top: -5px; right: -5px;
          background: #4da862; color: #fff;
          font-family: 'Outfit', sans-serif; font-size: 9px; font-weight: 700;
          border-radius: 99px; padding: 1px 4px; min-width: 16px;
          text-align: center; line-height: 14px;
          border: 1.5px solid #07100a;
        `;
        badge.textContent = course.uploadCount > 99 ? "99+" : String(course.uploadCount);
        el.appendChild(badge);
      }

      const { mapboxgl } = window as any;
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([course.longitude, course.latitude])
        .addTo(map);

      el.addEventListener("click", () => {
        setSelectedId(course.id);
        skipNextMoveRef.current = true;
        map.flyTo({ center: [course.longitude, course.latitude], zoom: Math.max(map.getZoom(), 12), duration: 600 });
      });

      markersRef.current.push(marker);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      if (!mapContainerRef.current) return;

      const mapboxgl = (await import("mapbox-gl")).default;

      if (cancelled) return;

      (window as any).mapboxgl = mapboxgl;
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: "mapbox://styles/mapbox/dark-v11",
        center: FALLBACK_CENTER,
        zoom: FALLBACK_ZOOM,
        attributionControl: false,
      });

      mapRef.current = map;

      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

      map.on("load", () => {
        if (cancelled) return;
        fetchByBounds(map);

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
            setUserLocation(coords);
            skipNextMoveRef.current = true;
            map.flyTo({ center: coords, zoom: USER_ZOOM, duration: 1800 });

            const userDot = document.createElement("div");
            userDot.style.cssText = `
              width: 14px; height: 14px; border-radius: 50%;
              background: #4da862;
              border: 2.5px solid #fff;
              box-shadow: 0 0 0 4px rgba(77,168,98,0.25);
            `;
            new mapboxgl.Marker({ element: userDot, anchor: "center" })
              .setLngLat(coords)
              .addTo(map);
          },
          () => {},
          { enableHighAccuracy: false, timeout: 8000 }
        );
      });

      map.on("moveend", () => {
        if (skipNextMoveRef.current) { skipNextMoveRef.current = false; return; }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchByBounds(map), 300);
      });
    };

    initMap();
    return () => { cancelled = true; mapRef.current?.remove(); };
  }, [fetchByBounds]);

  useEffect(() => {
    if (mapRef.current) addMarkers(mapRef.current, courses);
  }, [courses, addMarkers]);

  useEffect(() => {
    if (!selectedId || !cardStripRef.current) return;
    const idx = courses.findIndex(c => c.id === selectedId);
    if (idx === -1) return;
    const card = cardStripRef.current.children[idx] as HTMLElement;
    if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedId, courses]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#07100a", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
        display: "flex", alignItems: "center", gap: 12,
        padding: "env(safe-area-inset-top, 0px) 16px 0",
        paddingTop: "max(env(safe-area-inset-top, 0px), 12px)",
        paddingBottom: 12,
        background: "linear-gradient(to bottom, rgba(7,16,10,0.9) 0%, transparent 100%)",
      }}>
        <button
          onClick={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#fff", lineHeight: 1 }}>Courses Near Me</div>
          {courses.length > 0 && (
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
              {courses.length} course{courses.length !== 1 ? "s" : ""} in view
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div ref={mapContainerRef} style={{ flex: 1, width: "100%" }} />

      {/* Bottom card strip */}
      {courses.length > 0 && (
        <div style={{
          position: "absolute", bottom: 80, left: 0, right: 0, zIndex: 20,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          <div
            ref={cardStripRef}
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
                    router.push(`/courses/${course.id}`);
                  } else {
                    setSelectedId(course.id);
                    if (mapRef.current) {
                      skipNextMoveRef.current = true;
                      mapRef.current.flyTo({ center: [course.longitude, course.latitude], zoom: Math.max(mapRef.current.getZoom(), 12), duration: 600 });
                    }
                  }
                }}
                style={{
                  flexShrink: 0, width: 200,
                  background: selectedId === course.id ? "rgba(45,122,66,0.25)" : "rgba(7,16,10,0.85)",
                  border: `1px solid ${selectedId === course.id ? "rgba(77,168,98,0.6)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 14, padding: "10px 12px",
                  display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer", textAlign: "left",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  transition: "border-color 0.2s, background 0.2s",
                }}
              >
                {/* Logo / cover thumbnail */}
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
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(77,168,98,0.5)" strokeWidth="2">
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
  );
}
