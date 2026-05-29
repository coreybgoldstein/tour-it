import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { rateLimit } from "@/lib/rateLimit";

// POST /api/tour/search
//
// Unified LLM-powered search across Courses + TripItineraries. Takes
// a free-text query, asks Claude Haiku to extract structured filters
// and decide whether to search courses, trips, or both, then runs
// the actual DB queries in parallel and returns a mixed result list.
//
// Cached by SHA-256 hash of the lowercased query — repeat searches
// are free.
//
// Body: { query: string }
// Returns: {
//   explanation: string,
//   intent: "courses" | "trips" | "both",
//   results: Array<
//     | { type: "course", id, name, city, state, logoUrl, coverImageUrl, uploadCount }
//     | { type: "trip", id, slug, name, tagline, heroImageUrl, region, durationDays, costBand }
//   >
// }

const CACHE_TTL_DAYS = 7;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const REGIONS: Record<string, string[]> = {
  midwest:    ["IL","IN","IA","KS","MI","MN","MO","NE","ND","OH","SD","WI"],
  southeast:  ["AL","AR","FL","GA","KY","LA","MS","NC","SC","TN","VA","WV"],
  northeast:  ["CT","DE","MA","MD","ME","NH","NJ","NY","PA","RI","VT"],
  southwest:  ["AZ","NM","OK","TX"],
  west:       ["AK","CA","CO","HI","ID","MT","NV","OR","UT","WA","WY"],
  "new england":  ["CT","MA","ME","NH","RI","VT"],
  "mid-atlantic": ["DE","MD","NJ","NY","PA","VA"],
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`tour-search:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { query?: string };
  const q = (body.query ?? "").trim();
  if (!q) return NextResponse.json({ error: "Empty query" }, { status: 400 });
  if (q.length > 200) return NextResponse.json({ error: "Query too long" }, { status: 400 });

  const cacheKey = createHash("sha256").update(q.toLowerCase()).digest("hex");

  // ─── Cache lookup ────────────────────────────────────────────────
  {
    const { data: cached } = await sb
      .from("TripPlannerCache")
      .select("response, expiresAt")
      .eq("briefHash", `tour-${cacheKey}`)
      .gt("expiresAt", new Date().toISOString())
      .maybeSingle();
    if (cached) {
      sb.from("TripPlannerCache").update({ hits: ((cached as any).hits ?? 0) + 1 }).eq("briefHash", `tour-${cacheKey}`).then(() => {}, () => {});
      return NextResponse.json(cached.response);
    }
  }

  // ─── LLM intent extraction ──────────────────────────────────────
  let parsed: {
    intent: "courses" | "trips" | "both";
    states: string[];
    region: string | null;
    nameKeywords: string[];
    cityKeywords: string[];
    isPublic: boolean | null;
    vibeKeywords: string[];
    explanation: string;
  };
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: `You are the unified search-intent classifier for Tour It, a US golf scouting + trip-planning app.

You receive a single free-text query and decide whether the user wants:
  - "courses": specific golf courses to scout/play
  - "trips":   curated multi-stop golf-trip itineraries from a 41-row catalog
  - "both":    both types should be surfaced

Return STRICT JSON only — no markdown fences, no preamble.

JSON schema:
{
  "intent":        "courses" | "trips" | "both",
  "states":        string[],       // US state codes the query mentions/implies
  "region":        string | null,  // midwest / southeast / northeast / southwest / west / new england / mid-atlantic
  "nameKeywords":  string[],       // lowercase tokens for course/trip name fuzzy match
  "cityKeywords":  string[],       // lowercase city tokens
  "isPublic":      boolean | null, // true if user explicitly wants public courses, null otherwise
  "vibeKeywords":  string[],       // tokens to match trip vibe/region (e.g. "buddies", "links", "bucket-list", "couples", "casino")
  "explanation":   string          // one short user-facing sentence describing what you're searching for
}

Guidelines:
- If the query mentions "trip", "buddy trip", "bachelor", "buddies", "weekend", "honeymoon", "itinerary" → intent likely "trips" or "both".
- If the query mentions a specific course name → intent likely "courses".
- "links courses near LAX" → intent "courses", nameKeywords ["links"], cityKeywords [], states [] (LAX → ~Los Angeles area but no clean state filter).
- "buddy trip in April with good bars" → intent "trips", vibeKeywords ["buddies","bachelor","nightlife"].
- "Pinehurst" → intent "both" (could mean the resort/course or the trip).
- Empty arrays beat guesses. Never invent a state that isn't implied.`,
      messages: [{ role: "user", content: q }],
    });
    const raw = (msg.content[0] as any).text?.trim() ?? "{}";
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    parsed = JSON.parse(stripped);
  } catch (e: any) {
    console.error("Tour search LLM failed", e);
    // Fall back to a literal-only search across both tables when the
    // LLM can't parse the query. Better than returning an error.
    parsed = {
      intent: "both",
      states: [],
      region: null,
      nameKeywords: [q.toLowerCase()],
      cityKeywords: [q.toLowerCase()],
      isPublic: null,
      vibeKeywords: [],
      explanation: `Showing matches for "${q}"`,
    };
  }

  // Expand region into states when explicit states list is empty.
  let states = parsed.states ?? [];
  if (states.length === 0 && parsed.region) {
    const key = parsed.region.toLowerCase();
    states = REGIONS[key] ?? [];
  }

  // ─── DB queries in parallel ─────────────────────────────────────
  const wantsCourses = parsed.intent === "courses" || parsed.intent === "both";
  const wantsTrips = parsed.intent === "trips" || parsed.intent === "both";

  const coursePromise = wantsCourses ? (async () => {
    let cq = sb
      .from("Course")
      .select("id, name, city, state, logoUrl, coverImageUrl, uploadCount, isPublic")
      .limit(12);
    if (states.length > 0) cq = cq.in("state", states);
    if (parsed.isPublic === true) cq = cq.eq("isPublic", true);
    const orParts: string[] = [];
    for (const c of parsed.cityKeywords ?? []) orParts.push(`city.ilike.%${c}%`);
    for (const n of parsed.nameKeywords ?? []) orParts.push(`name.ilike.%${n}%`);
    if (orParts.length > 0) cq = cq.or(orParts.join(","));
    cq = cq.order("uploadCount", { ascending: false, nullsFirst: false }).order("name");
    const { data } = await cq;
    return data ?? [];
  })() : Promise.resolve([]);

  const tripPromise = wantsTrips ? (async () => {
    // The catalog is small (~41 rows) — pull a bigger window and
    // JS-filter for fuzzy match against name/tagline/region/vibe.
    const { data } = await sb
      .from("TripItinerary")
      .select("id, slug, name, tagline, heroImageUrl, region, durationDays, costBand, vibeTag")
      .limit(60);
    if (!data) return [];
    const tokens = [...(parsed.nameKeywords ?? []), ...(parsed.cityKeywords ?? []), ...(parsed.vibeKeywords ?? [])].map((s) => s.toLowerCase()).filter(Boolean);
    if (tokens.length === 0) return data.slice(0, 8);
    const scored = (data as any[]).map((t) => {
      const hay = `${t.name} ${t.tagline} ${t.region} ${t.vibeTag}`.toLowerCase();
      const score = tokens.reduce((acc, tok) => acc + (hay.includes(tok) ? 1 : 0), 0);
      return { t, score };
    }).filter((x) => x.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 8).map((x) => x.t);
  })() : Promise.resolve([]);

  const [courseRows, tripRows] = await Promise.all([coursePromise, tripPromise]);

  // ─── Shape response ────────────────────────────────────────────
  const results = [
    ...courseRows.map((c: any) => ({
      type: "course" as const,
      id: c.id,
      name: c.name,
      city: c.city,
      state: c.state,
      logoUrl: c.logoUrl,
      coverImageUrl: c.coverImageUrl,
      uploadCount: c.uploadCount ?? 0,
      isPublic: c.isPublic,
    })),
    ...tripRows.map((t: any) => ({
      type: "trip" as const,
      id: t.id,
      slug: t.slug,
      name: t.name,
      tagline: t.tagline,
      heroImageUrl: t.heroImageUrl,
      region: t.region,
      durationDays: t.durationDays,
      costBand: t.costBand,
    })),
  ];

  const responseBody = {
    explanation: parsed.explanation ?? `Showing matches for "${q}"`,
    intent: parsed.intent,
    results,
  };

  // Cache for CACHE_TTL_DAYS via the existing TripPlannerCache table.
  const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  sb.from("TripPlannerCache").upsert({
    briefHash: `tour-${cacheKey}`,
    brief: { query: q },
    response: responseBody,
    hits: 0,
    expiresAt,
  }, { onConflict: "briefHash" }).then(() => {}, () => {});

  return NextResponse.json(responseBody);
}
