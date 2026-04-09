import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// US region → state codes
const REGIONS: Record<string, string[]> = {
  midwest:   ["IL","IN","IA","KS","MI","MN","MO","NE","ND","OH","SD","WI"],
  southeast: ["AL","AR","FL","GA","KY","LA","MS","NC","SC","TN","VA","WV"],
  northeast: ["CT","DE","MA","MD","ME","NH","NJ","NY","PA","RI","VT"],
  southwest: ["AZ","NM","OK","TX"],
  west:      ["AK","CA","CO","HI","ID","MT","NV","OR","UT","WA","WY"],
  "new england": ["CT","MA","ME","NH","RI","VT"],
  "mid-atlantic": ["DE","MD","NJ","NY","PA","VA"],
};

type AIParams = {
  states: string[];
  region: string | null;
  cityKeywords: string[];
  nameKeywords: string[];
  isPublic: boolean | null;
  sortBy: "uploadCount" | "name";
  limit: number;
  hasClipsOnly: boolean;
  nearLat: number | null;
  nearLng: number | null;
  radiusMiles: number | null;
  explanation: string;
};

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query?.trim()) return NextResponse.json({ error: "No query" }, { status: 400 });

    // Ask Claude to extract structured search parameters
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: `You are a golf course search assistant for Tour It, a US golf scouting app with 11,000+ courses.
Extract structured search parameters from natural language golf course queries.
Respond ONLY with valid JSON — no markdown, no explanation outside the JSON.

JSON schema:
{
  "states": string[],        // US state codes e.g. ["FL","GA"]. Empty array if no state filter.
  "region": string | null,   // Region name if used (midwest, southeast, northeast, southwest, west, new england). null otherwise.
  "cityKeywords": string[],  // City names to search for. Empty if none.
  "nameKeywords": string[],  // Style/descriptor words to match against course name e.g. ["links","national","pines"]. Empty if none.
  "isPublic": boolean | null, // true = public courses only, null = no filter
  "sortBy": "uploadCount" | "name", // uploadCount for "best/popular/bucket list", name for alphabetical
  "limit": number,           // 1-20 results to return
  "hasClipsOnly": boolean,   // true if user wants courses with scouting clips
  "nearLat": number | null,  // Approximate latitude if near a landmark/airport/city
  "nearLng": number | null,  // Approximate longitude if near a landmark/airport/city
  "radiusMiles": number | null, // Search radius in miles if distance-based
  "explanation": string      // One sentence describing what you're searching for (shown to user)
}

Examples:
- "links style courses in the Southeast" → states from southeast region, nameKeywords:["links"], sortBy:"uploadCount"
- "Courses within 10 miles of JFK airport" → nearLat:40.6413, nearLng:-73.7781, radiusMiles:10
- "Best guys golf trip destinations in Florida" → states:["FL"], sortBy:"uploadCount", hasClipsOnly:true
- "Bucket list courses under $150" → sortBy:"uploadCount", hasClipsOnly:true (note: no pricing data available)
- "Public courses in Scottsdale" → cityKeywords:["Scottsdale"], isPublic:true`,
      messages: [{ role: "user", content: query }],
    });

    const raw = (msg.content[0] as any).text?.trim() ?? "{}";
    let params: AIParams;
    try {
      params = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
    }

    // Expand region into states if no explicit states given
    let states = params.states || [];
    if (states.length === 0 && params.region) {
      const key = params.region.toLowerCase();
      states = REGIONS[key] || [];
    }

    // Build Supabase query
    let dbQuery = supabase
      .from("Course")
      .select("id, name, city, state, holeCount, isPublic, uploadCount, logoUrl, latitude, longitude");

    if (states.length > 0) {
      dbQuery = dbQuery.in("state", states);
    }

    if (params.isPublic === true) {
      dbQuery = dbQuery.eq("isPublic", true);
    }

    if (params.hasClipsOnly) {
      dbQuery = dbQuery.gt("uploadCount", 0);
    }

    // City or name keywords — build OR filter
    const orParts: string[] = [];
    for (const city of (params.cityKeywords || [])) {
      orParts.push(`city.ilike.%${city}%`);
    }
    for (const kw of (params.nameKeywords || [])) {
      orParts.push(`name.ilike.%${kw}%`);
    }
    if (orParts.length > 0) {
      dbQuery = dbQuery.or(orParts.join(","));
    }

    // Distance filter: bounding box from nearLat/nearLng/radiusMiles
    if (params.nearLat != null && params.nearLng != null && params.radiusMiles != null) {
      const deg = params.radiusMiles / 69;
      const lngDeg = deg / Math.cos((params.nearLat * Math.PI) / 180);
      dbQuery = dbQuery
        .gte("latitude", params.nearLat - deg)
        .lte("latitude", params.nearLat + deg)
        .gte("longitude", params.nearLng - lngDeg)
        .lte("longitude", params.nearLng + lngDeg)
        .not("latitude", "is", null);
    }

    dbQuery = dbQuery
      .order(params.sortBy === "name" ? "name" : "uploadCount", {
        ascending: params.sortBy === "name",
        nullsFirst: false,
      })
      .limit(Math.min(params.limit || 15, 20));

    const { data: courses, error } = await dbQuery;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If distance search, sort results by actual distance and attach it
    let results = courses || [];
    if (params.nearLat != null && params.nearLng != null) {
      results = results
        .filter(c => c.latitude != null && c.longitude != null)
        .map(c => {
          const dLat = (c.latitude - params.nearLat!) * (Math.PI / 180);
          const dLng = (c.longitude - params.nearLng!) * (Math.PI / 180);
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(params.nearLat! * Math.PI / 180) * Math.cos(c.latitude * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
          const distMi = 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return { ...c, distanceMiles: Math.round(distMi * 10) / 10 };
        })
        .sort((a, b) => (a as any).distanceMiles - (b as any).distanceMiles);
    }

    // Log the search (fire-and-forget)
    const userId = req.headers.get("x-user-id") || null;
    const searchLogId = crypto.randomUUID();
    supabase.from("SearchLog").insert({
      id: searchLogId,
      query,
      params,
      resultIds: results.map((c: any) => c.id),
      resultCount: results.length,
      userId,
      createdAt: new Date().toISOString(),
    }).then(() => {}).catch(() => {});

    return NextResponse.json({ courses: results, explanation: params.explanation, searchLogId });
  } catch (err: any) {
    console.error("AI search error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
