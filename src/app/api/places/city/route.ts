import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

// City / town search proxy. Mirrors the lodging route's two-backend
// pattern (Google Places when GOOGLE_PLACES_API_KEY is set, else
// Nominatim) but is tuned for populated places — cities, towns,
// villages — so the trip "Cities" field auto-completes as the user
// types instead of forcing freehand entry.
//
// Response shape: { results: CityHit[] } where each hit carries a
// pretty `display` ("Harbor Springs, MI") plus structured city/state.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "TourItGolf/1.0 (https://touritgolf.com; coreybgoldstein@gmail.com)";

type CityHit = {
  display: string;       // "City, ST" — also what gets stored
  city: string;
  state: string | null;
};

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`city-search:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });
  const state = (url.searchParams.get("state") || "").trim();

  // ─── Google Places (preferred) ─────────────────────────────────
  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  if (googleKey) {
    try {
      const queryStr = state ? `${q} ${state}` : q;
      // types=(cities) restricts Autocomplete to localities /
      // administrative areas — exactly the populated places we want.
      const params = new URLSearchParams({
        input: queryStr,
        types: "(cities)",
        components: "country:us",
        key: googleKey,
      });
      const gUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;
      const gRes = await fetch(gUrl, { cache: "force-cache", next: { revalidate: 60 * 60 * 24 } });
      if (gRes.ok) {
        const gData = await gRes.json();
        const gResults: CityHit[] = ((gData.predictions ?? []) as any[])
          .slice(0, 8)
          .map((p) => {
            const main = p.structured_formatting?.main_text || p.description || "";
            const city = String(main).trim();
            // secondary_text is usually "MI, USA" or "County, MI, USA".
            const secondary: string = p.structured_formatting?.secondary_text || "";
            let stateCode: string | null = null;
            const m = secondary.match(/\b([A-Z]{2})\b(?:,\s*USA)?\s*$/);
            if (m) stateCode = m[1];
            const display = stateCode ? `${city}, ${stateCode}` : city;
            return { display, city, state: stateCode };
          })
          .filter((r) => r.city.length > 0);
        if (gResults.length > 0) {
          return NextResponse.json({ results: dedupe(gResults) });
        }
      }
    } catch (e) {
      console.warn("Google Places city lookup failed, falling back to Nominatim", e);
    }
  }

  // ─── Nominatim fallback ────────────────────────────────────────
  async function nominatim(searchQ: string): Promise<any[]> {
    const params = new URLSearchParams({
      q: searchQ,
      format: "json",
      limit: "12",
      addressdetails: "1",
      countrycodes: "us",
      featuretype: "city",
    });
    const u = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const res = await fetch(u, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    return res.json();
  }

  let hits: any[] = [];
  try {
    hits = await nominatim(state ? `${q}, ${state}` : q);
    if (hits.length === 0 && state) hits = await nominatim(q);
  } catch (e) {
    return NextResponse.json({ error: `City search failed: ${(e as Error).message}` }, { status: 502 });
  }

  const PLACE_TYPES = new Set(["city", "town", "village", "hamlet", "municipality", "administrative"]);

  const results: CityHit[] = hits
    .filter((h) => {
      const t = (h.type || "").toLowerCase();
      const cls = (h.class || "").toLowerCase();
      return cls === "place" || cls === "boundary" || PLACE_TYPES.has(t);
    })
    .map((h) => {
      const addr = h.address || {};
      const city = addr.city || addr.town || addr.village || addr.hamlet || addr.municipality || (h.display_name as string)?.split(",")[0] || "";
      const stateName = addr.state || null;
      const stateCode = stateName ? shortenState(stateName) : null;
      const display = stateCode ? `${city}, ${stateCode}` : city;
      return { display, city: city.trim(), state: stateCode };
    })
    .filter((r) => r.city.length > 0);

  return NextResponse.json({ results: dedupe(results).slice(0, 8) });
}

function dedupe(arr: CityHit[]): CityHit[] {
  return arr.filter((r, i, all) => all.findIndex((x) => x.display === r.display) === i);
}

function shortenState(s: string): string {
  if (s.length <= 3) return s;
  return STATE_ABBR[s] ?? s;
}
const STATE_ABBR: Record<string, string> = {
  "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO",
  "Connecticut":"CT","Delaware":"DE","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID",
  "Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA",
  "Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN",
  "Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV",
  "New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC",
  "North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA",
  "Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX",
  "Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV",
  "Wisconsin":"WI","Wyoming":"WY","District of Columbia":"DC",
};
