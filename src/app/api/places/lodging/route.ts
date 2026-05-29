import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

// Lodging search proxy.
//
// Currently fronts OpenStreetMap's Nominatim service (free, no key,
// 1 req/sec global rate limit). Returns up to 8 hotel / resort / B&B
// hits matching the query string, biased to the US.
//
// Upgrade path (when traffic > Nominatim's polite limit or quality
// slips): swap the fetch URL to Google Places Autocomplete with
// types=lodging. The response shape we return is intentionally
// minimal — name + city/state/country — so the client code doesn't
// need to change.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "TourItGolf/1.0 (https://touritgolf.com; coreybgoldstein@gmail.com)";

type LodgingHit = {
  name: string;
  display: string;       // pretty single-line label for the dropdown
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
};

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  // Hard cap: 20 searches/min/IP. Nominatim's policy is generous but
  // we want to be polite and keep our app-wide quota healthy.
  if (!rateLimit(`lodging-search:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  // We bias by state/city when provided (the trip page knows where the
  // courses are located, so passing state in narrows results).
  const state = (url.searchParams.get("state") || "").trim();

  // Two-stage Nominatim search. First try with the state hint
  // suffixed; if that returns nothing, retry the bare query. This
  // covers cases like "Alpine Village, MI" where the property is
  // actually tagged in OSM as just "Alpine Village" (no state in
  // its name) and the suffixed query confuses the geocoder.
  async function nominatim(searchQ: string): Promise<any[]> {
    const params = new URLSearchParams({
      q: searchQ,
      format: "json",
      limit: "12",
      addressdetails: "1",
      countrycodes: "us",
    });
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const res = await fetch(url, {
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
    if (hits.length === 0 && state) {
      // Bare-query fallback — Nominatim sometimes doesn't recognize
      // the "Name, ST" form for properties tagged without state.
      hits = await nominatim(q);
    }
  } catch (e) {
    return NextResponse.json({ error: `Lodging search failed: ${(e as Error).message}` }, { status: 502 });
  }

  // Stop-list. Nominatim tags real condos / lodges across many
  // class buckets (tourism / leisure / building / amenity), and an
  // allow-list approach kept losing legitimate properties. Pivoted
  // to: let everything through EXCEPT obvious non-lodging buckets
  // (churches, schools, restaurants, banks, libraries, etc.).
  const EXCLUDED_TYPES = new Set([
    "church", "place_of_worship", "chapel", "cathedral", "mosque", "synagogue", "temple",
    "school", "kindergarten", "university", "college",
    "restaurant", "fast_food", "cafe", "bar", "pub", "biergarten",
    "bank", "atm", "fuel", "pharmacy", "hospital", "clinic", "doctors", "dentist",
    "library", "museum", "theatre", "cinema",
    "post_office", "police", "fire_station", "townhall",
    "supermarket", "marketplace", "convenience",
  ]);

  const results: LodgingHit[] = hits
    .filter((h) => {
      const t = (h.type || "").toLowerCase();
      // Just exclude the obvious bad types — churches, schools,
      // restaurants, banks, etc. Everything else passes through.
      // The previous class-allowlist was still too strict (real
      // condos under unusual classes were dropped).
      return !EXCLUDED_TYPES.has(t);
    })
    .slice(0, 8)
    .map((h) => {
      const addr = h.address || {};
      const city = addr.city || addr.town || addr.village || addr.hamlet || addr.county || null;
      const stateName = addr.state || addr["ISO3166-2-lvl4"] || null;
      // Nominatim's display_name is verbose ("The Lodge, 100 Main St,
      // ZIP, County, State, USA"). Shorten to "Name — City, ST" so
      // the dropdown stays scannable.
      const name = (h.name || (h.display_name as string).split(",")[0] || "").trim();
      const display = city && stateName
        ? `${name} — ${city}, ${shortenState(stateName)}`
        : name;
      return {
        name,
        display,
        city,
        state: stateName,
        lat: h.lat ? Number(h.lat) : null,
        lng: h.lon ? Number(h.lon) : null,
      };
    })
    // De-dupe by display string — Nominatim sometimes returns near-
    // duplicate entries for the same property.
    .filter((r, i, all) => all.findIndex((x) => x.display === r.display) === i);

  return NextResponse.json({ results });
}

// Quick state-name → 2-letter code converter. Returns the input
// unchanged when it's already short or not in the table.
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
