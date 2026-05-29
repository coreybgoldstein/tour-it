// Location-permission helpers — single source of truth for how we
// remember whether the user has previously enabled location.
//
// Rule (per user request): once a user enables location anywhere in
// Tour It (map, home Near-Me, tour-page Near-Me), every other
// surface should ALREADY be in the granted state without re-prompting
// for a tap on an "Enable location" CTA. The OS-level permission
// prompt is unavoidable on first grant; but our app-level CTAs only
// surface when the user has NEVER granted permission OR has revoked it.
//
// Storage: localStorage (persistent across sessions), not
// sessionStorage. Cleared only when the user explicitly opts out OR
// when navigator.geolocation later errors with PERMISSION_DENIED.

const PERMISSION_KEY = "tourit-location-permission"; // "granted" | "denied"
const COORDS_KEY = "tourit-loc-coords";              // last { lat, lng, ts }

export type LocationPermission = "unknown" | "granted" | "denied";

export function readPermission(): LocationPermission {
  if (typeof window === "undefined") return "unknown";
  try {
    const v = localStorage.getItem(PERMISSION_KEY);
    if (v === "granted" || v === "denied") return v;
  } catch {}
  return "unknown";
}

export function setPermission(p: LocationPermission) {
  if (typeof window === "undefined") return;
  try {
    if (p === "unknown") localStorage.removeItem(PERMISSION_KEY);
    else localStorage.setItem(PERMISSION_KEY, p);
  } catch {}
}

export type CachedCoords = { lat: number; lng: number; ts: number };

export function readCoords(maxAgeMs = 24 * 60 * 60 * 1000): CachedCoords | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCoords;
    if (Date.now() - parsed.ts > maxAgeMs) return null;
    return parsed;
  } catch { return null; }
}

export function writeCoords(coords: { lat: number; lng: number }) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COORDS_KEY, JSON.stringify({ ...coords, ts: Date.now() }));
  } catch {}
}

/** Request the browser geolocation, persist coords + flip permission
 *  to "granted" on success or "denied" on error. Returns the resolved
 *  coords or null. Safe to call even if perm was previously denied
 *  (it'll just resolve to null again). */
export function requestLocation(): Promise<CachedCoords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setPermission("denied");
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now() };
        writeCoords(c);
        setPermission("granted");
        resolve(c);
      },
      () => {
        setPermission("denied");
        resolve(null);
      },
      { timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  });
}
