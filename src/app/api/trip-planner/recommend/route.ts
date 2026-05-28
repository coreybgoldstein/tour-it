import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { rateLimit } from "@/lib/rateLimit";
import { TRIP_ENRICHMENT, BEST_FOR_TAGS } from "@/lib/tripEnrichment";

// Cache TTL — long enough that 7-day repeat queries are free, short
// enough that newly-added itineraries surface within a week.
const CACHE_TTL_DAYS = 7;

// POST /api/trip-planner/recommend
//
// Inputs (all optional unless noted):
//   groupSize: number                — 1, 2-4, 5-8, 9+
//   budgetPerPerson: number          — total spend per head, USD
//   originCity, originState: string  — flight-distance hint
//   rounds: number                   — 2, 3, 4, 5+
//   days: number                     — trip length in nights
//   months: number[]                 — REQUIRED. Acceptable months 1-12
//   vibes: string[]                  — bestFor tags + free-form (e.g. "casino", "foodie")
//   notes: string                    — free text the user wrote
//
// Returns:
//   { explanation, recommendations: [{ slug, name, heroImageUrl, matchScore, reasoning, caveat? }] }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type PlannerInput = {
  groupSize?: number;
  budgetPerPerson?: number;
  originCity?: string;
  originState?: string;
  rounds?: number;
  days?: number;
  months: number[];
  vibes?: string[];
  notes?: string;
};

// Cost-band ranges, in USD per person inclusive of golf+lodging+food
// (rough — used for hard-budget pre-filter, not surfaced to the user).
const COST_BAND_FLOORS: Record<string, number> = {
  "$$": 600,
  "$$$": 1200,
  "$$$$": 2200,
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`trip-planner:${ip}`, 6, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const input = (await req.json()) as PlannerInput;
  if (!Array.isArray(input.months) || input.months.length === 0) {
    return NextResponse.json({ error: "months[] is required" }, { status: 400 });
  }

  // Canonicalize the brief inputs into a deterministic JSON string and
  // hash it — two users with the same group/budget/months/vibes/notes/
  // origin share the LLM call.
  const briefKey = JSON.stringify({
    groupSize: input.groupSize ?? null,
    budgetPerPerson: input.budgetPerPerson ?? null,
    originCity: (input.originCity ?? "").trim().toLowerCase() || null,
    originState: (input.originState ?? "").trim().toUpperCase() || null,
    rounds: input.rounds ?? null,
    days: input.days ?? null,
    months: [...input.months].sort((a, b) => a - b),
    vibes: [...(input.vibes ?? [])].sort(),
    notes: (input.notes ?? "").trim().toLowerCase() || null,
  });
  const briefHash = createHash("sha256").update(briefKey).digest("hex");

  // ─── Cache lookup ───────────────────────────────────────────────────────
  // Cache the full hydrated response keyed by brief hash. Skip the
  // catalog fetch and LLM call entirely on a hit. Increments hits for
  // visibility (admin can see which briefs are popular).
  {
    const { data: cached } = await sb
      .from("TripPlannerCache")
      .select("response, expiresAt")
      .eq("briefHash", briefHash)
      .gt("expiresAt", new Date().toISOString())
      .maybeSingle();
    if (cached) {
      sb.from("TripPlannerCache").update({ hits: (cached as any).hits != null ? (cached as any).hits + 1 : 1 }).eq("briefHash", briefHash).then(() => {}, () => {});
      return NextResponse.json(cached.response);
    }
  }

  // ─── Pull catalog ────────────────────────────────────────────────────────
  const { data: itineraries, error } = await sb
    .from("TripItinerary")
    .select("id, slug, name, tagline, heroImageUrl, vibeTag, costBand, bestSeasonStart, bestSeasonEnd, durationDays, region, stayRec");
  if (error || !itineraries) {
    return NextResponse.json({ error: error?.message ?? "Catalog fetch failed" }, { status: 500 });
  }

  // ─── Hard pre-filter ────────────────────────────────────────────────────
  // Apply cheap, deterministic filters BEFORE the LLM so we don't pay tokens
  // for impossible matches.
  const monthsSet = new Set(input.months);

  type Candidate = {
    slug: string;
    name: string;
    tagline: string;
    heroImageUrl: string | null;
    vibeTag: string;
    costBand: string;
    region: string;
    durationDays: number;
    bestSeasonStart: number;
    bestSeasonEnd: number;
    stayRec: string;
    enrichment: ReturnType<typeof getOptionalEnrichment>;
  };

  function monthsOverlap(start: number, end: number, allow: Set<number>) {
    // bestSeasonStart > bestSeasonEnd means wraparound (e.g. Nov-Apr = 11..4)
    const range: number[] = [];
    if (start <= end) {
      for (let m = start; m <= end; m++) range.push(m);
    } else {
      for (let m = start; m <= 12; m++) range.push(m);
      for (let m = 1; m <= end; m++) range.push(m);
    }
    return range.some((m) => allow.has(m));
  }

  function durationOk(itDays: number, wanted?: number) {
    if (!wanted) return true;
    // Allow ±2 day flex — user "wants ~4 days" is fine with a 3 or 5-day trip
    return Math.abs(itDays - wanted) <= 2;
  }

  function budgetOk(band: string, perPerson?: number) {
    if (!perPerson) return true;
    const floor = COST_BAND_FLOORS[band] ?? 0;
    return perPerson >= floor;
  }

  const candidates: Candidate[] = (itineraries as any[])
    .filter((it) => monthsOverlap(it.bestSeasonStart, it.bestSeasonEnd, monthsSet))
    .filter((it) => durationOk(it.durationDays, input.days))
    .filter((it) => budgetOk(it.costBand, input.budgetPerPerson))
    .map((it) => ({
      slug: it.slug,
      name: it.name,
      tagline: it.tagline,
      heroImageUrl: it.heroImageUrl,
      vibeTag: it.vibeTag,
      costBand: it.costBand,
      region: it.region,
      durationDays: it.durationDays,
      bestSeasonStart: it.bestSeasonStart,
      bestSeasonEnd: it.bestSeasonEnd,
      stayRec: it.stayRec,
      enrichment: getOptionalEnrichment(it.slug),
    }));

  if (candidates.length === 0) {
    return NextResponse.json({
      explanation: "Nothing in our catalog matches your dates and budget — try widening the window or adjusting the budget.",
      recommendations: [],
    });
  }

  // ─── LLM ranking + reasoning ────────────────────────────────────────────
  // Pass the shortlist (already filtered) to Claude with the user's full
  // brief so it can rank and explain. The model picks 5 and writes a
  // 1-sentence "why" + optional caveat for each.
  const validTagIds = BEST_FOR_TAGS.map((t) => t.id);

  const catalogJson = candidates.map((c) => ({
    slug: c.slug,
    name: c.name,
    tagline: c.tagline,
    region: c.region,
    durationDays: c.durationDays,
    costBand: c.costBand,
    bestMonths: c.enrichment?.bestMonths ?? null,
    bestFor: c.enrichment?.bestFor ?? [],
    oneLiner: c.enrichment?.oneLiner ?? null,
    primaryAirport: c.enrichment?.primaryAirport?.code ?? null,
    walkingFriendly: c.enrichment?.walkingFriendly ?? null,
    rentalCarNeeded: c.enrichment?.rentalCarNeeded ?? null,
  }));

  const brief = {
    groupSize: input.groupSize ?? null,
    budgetPerPerson: input.budgetPerPerson ?? null,
    originCity: input.originCity ?? null,
    originState: input.originState ?? null,
    rounds: input.rounds ?? null,
    days: input.days ?? null,
    months: input.months,
    vibes: input.vibes ?? [],
    notes: input.notes ?? null,
  };

  const systemPrompt = `You are a golf-trip planner for Tour It. You rank pre-filtered US golf-trip itineraries against a user brief and explain why each is a fit.

Rules:
- All trips in the candidate list are publicly accessible (no private clubs). You don't need to filter for that.
- All trips have already passed a hard month / duration / budget filter.
- Your job: pick the 3-5 BEST matches and rank them by how well they fit the brief.
- Weight time-of-year heavily. A "great" trip in the wrong season is a "wrong" trip.
- Weight vibes (buddies, bachelor, couples, foodie, etc.) against the user's stated vibes/notes.
- Weight origin distance: pick trips with shorter flights from the user's origin when possible. NYC origin should slightly prefer Carolinas/FL over Hawaii.
- CRITICAL: every "slug" field in your output MUST be character-for-character identical to a slug in the candidate list. Do NOT invent variations, do NOT add suffixes like "-loop". Copy-paste the slug exactly. If you can't, exclude that itinerary.
- Output STRICT JSON only, no markdown fences, no preamble.

Output schema:
{
  "explanation": "1-sentence summary of how you matched the brief",
  "recommendations": [
    {
      "slug": "exact-slug-from-candidates",
      "matchScore": 1-100,
      "reasoning": "1-2 sentence justification, written in Tour It's voice (casual, confident, specific). Mention 1-2 concrete reasons.",
      "caveat": "Optional 1-line caveat (snow risk, long flight, expensive, etc.) — omit if none"
    }
  ]
}

Tour It voice rules: lowercase casual where it fits, specific over generic, no 'world-class' or 'something for everyone'. Address the user directly when natural.

Valid bestFor tag ids: ${validTagIds.join(", ")}.`;

  const userPrompt = `User brief:\n${JSON.stringify(brief, null, 2)}\n\nCandidate itineraries:\n${JSON.stringify(catalogJson, null, 2)}\n\nRank the best 3-5 matches. Return STRICT JSON only.`;

  let parsed: { explanation: string; recommendations: Array<{ slug: string; matchScore: number; reasoning: string; caveat?: string }> };
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const raw = (msg.content[0] as any).text?.trim() ?? "{}";
    // Strip any markdown fences just in case.
    const stripped = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    parsed = JSON.parse(stripped);
  } catch (e: any) {
    console.error("Trip planner LLM error", e);
    return NextResponse.json({ error: "Planner brain is offline. Try again in a moment." }, { status: 502 });
  }

  // Map slugs back to full candidate rows so the client gets hero images +
  // taglines without a second fetch.
  const bySlug = new Map(candidates.map((c) => [c.slug, c]));
  const recommendations = (parsed.recommendations ?? [])
    .filter((r) => bySlug.has(r.slug))
    .slice(0, 5)
    .map((r) => {
      const c = bySlug.get(r.slug)!;
      return {
        slug: r.slug,
        name: c.name,
        tagline: c.tagline,
        heroImageUrl: c.heroImageUrl,
        region: c.region,
        durationDays: c.durationDays,
        costBand: c.costBand,
        matchScore: r.matchScore,
        reasoning: r.reasoning,
        caveat: r.caveat,
      };
    });

  const responseBody = {
    explanation: parsed.explanation ?? "Here are your best matches.",
    recommendations,
  };

  // Cache the full response for CACHE_TTL_DAYS. Fire-and-forget so we
  // don't block the user on a write.
  const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  sb.from("TripPlannerCache").upsert({
    briefHash,
    brief: {
      groupSize: input.groupSize ?? null,
      budgetPerPerson: input.budgetPerPerson ?? null,
      originCity: input.originCity ?? null,
      originState: input.originState ?? null,
      rounds: input.rounds ?? null,
      days: input.days ?? null,
      months: input.months,
      vibes: input.vibes ?? [],
      notes: input.notes ?? null,
    },
    response: responseBody,
    hits: 0,
    expiresAt,
  }, { onConflict: "briefHash" }).then(() => {}, () => {});

  return NextResponse.json(responseBody);
}

function getOptionalEnrichment(slug: string) {
  return TRIP_ENRICHMENT[slug] ?? null;
}
