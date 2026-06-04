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

/** The permission to act on at app start. Use this instead of
 *  readPermission() in mount effects.
 *
 *  Self-heals the legacy bug where a transient timeout wrote "denied"
 *  over a real grant: if we still hold cached coords (proof the user
 *  granted at some point) but the flag says "denied", we trust the
 *  coords and restore "granted" — no extra "Enable" tap. If the user
 *  truly revoked at the OS level, the next background requestLocation()
 *  returns PERMISSION_DENIED and flips the flag back correctly. */
export function resolveInitialPermission(): LocationPermission {
  const p = readPermission();
  // Proof of a past grant is the existence of *any* stored coords, no
  // matter how old — we only need to know the user once said yes, not
  // where they were. Use a very wide window so the heal is reliable.
  if (p === "denied" && readCoords(Number.MAX_SAFE_INTEGER)) {
    setPermission("granted");
    return "granted";
  }
  return p;
}

export type CachedCoords = { lat: number; lng: number; ts: number };

export function readCoords(maxAgeMs = 24 * 60 * 60 * 1000): CachedCoords | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(COORDS_KEY) ?? localStorage.getItem("tour-it-location");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCoords;
    if (typeof parsed.lat !== "number" || typeof parsed.lng !== "number") return null;
    if (Date.now() - parsed.ts > maxAgeMs) return null;
    return parsed;
  } catch { return null; }
}

// Legacy coords key written by older surfaces (/tour main, HomeClassic).
// We mirror writes to it so a grant on any surface is honoured everywhere
// without a migration step.
const LEGACY_COORDS_KEY = "tour-it-location";

export function writeCoords(coords: { lat: number; lng: number }) {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({ ...coords, ts: Date.now() });
    localStorage.setItem(COORDS_KEY, payload);
    localStorage.setItem(LEGACY_COORDS_KEY, payload);
  } catch {}
}

/** Request the browser geolocation and, on success, persist coords + flip
 *  permission to "granted". Returns the resolved coords or null.
 *
 *  IMPORTANT: a transient failure (timeout / position-unavailable) must
 *  NOT wipe a previously-saved grant — on iOS getCurrentPosition times
 *  out routinely (indoors, weak GPS, cold first fix), and downgrading to
 *  "denied" is what made users have to re-tap "Enable" over and over.
 *  We therefore only persist "denied" on an actual PERMISSION_DENIED. */
export function requestLocation(): Promise<CachedCoords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      // Environment can't do geolocation — not a user denial. Don't
      // poison the saved permission; just resolve empty.
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
      (err) => {
        // err.code: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT.
        // Only a real denial clears the grant; everything else leaves the
        // stored permission untouched so the user is never re-prompted.
        if (err && err.code === err.PERMISSION_DENIED) setPermission("denied");
        resolve(null);
      },
      // Generous maximumAge lets the OS hand back a recent cached fix
      // instantly, which avoids most spurious timeouts on mobile.
      { timeout: 15000, maximumAge: 10 * 60 * 1000, enableHighAccuracy: false }
    );
  });
}
