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

  // featuretype=hotel is too narrow; use `class=tourism` + free-form
  // q so resorts/lodges/B&Bs all show up. Nominatim accepts up to ~50
  // results — we limit to a small set for the dropdown.
  const params = new URLSearchParams({
    q: state ? `${q}, ${state}` : q,
    format: "json",
    limit: "8",
    addressdetails: "1",
    countrycodes: "us",
  });

  const nominatimUrl = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
  let hits: any[] = [];
  try {
    const res = await fetch(nominatimUrl, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
      // Nominatim asks for caching to be respected — let CF do it.
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    hits = await res.json();
  } catch (e) {
    return NextResponse.json({ error: `Lodging search failed: ${(e as Error).message}` }, { status: 502 });
  }

  // Filter: keep the broad set of lodging-shaped results — Nominatim
  // tags real condos / lodges inconsistently across class buckets
  // (tourism, leisure, building, even amenity). Instead of a class
  // whitelist (which lost real Alpine-Village-style condos to the
  // void), exclude the type-buckets we KNOW are wrong: places of
  // worship, schools, restaurants, retail, etc.
  const LODGING_TYPES = new Set([
    "hotel", "motel", "resort", "guest_house", "guesthouse", "hostel",
    "chalet", "apartment", "apartments", "bed_and_breakfast", "lodging",
    "alpine_hut", "camp_site", "caravan_site", "wilderness_hut",
    "condominium", "condominiums",
  ]);
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
      const c = (h.class || "").toLowerCase();
      if (EXCLUDED_TYPES.has(t)) return false;
      // Explicit lodging types always pass.
      if (LODGING_TYPES.has(t)) return true;
      // Broad classes that legitimately contain condos / lodges /
      // rentals across Nominatim's data.
      return c === "tourism" || c === "leisure" || c === "building" || c === "amenity";
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
