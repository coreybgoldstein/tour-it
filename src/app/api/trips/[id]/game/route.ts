import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

function sb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Course Handicap = HI × (Slope / 113) + (Rating − Par).
// Tee rating/slope are frequently unavailable (not stored course-level),
// so we neutralize gracefully: missing slope → 113, and the (rating − par)
// term drops to 0 unless BOTH rating and par are known. With neutral
// inputs this reduces to Course HCP = round(Handicap Index), the standard
// fallback — never NaN, never a silent 0 from null arithmetic.
function calcCourseHandicap(
  hi: number,
  slope?: number | null,
  rating?: number | null,
  par?: number | null
): number {
  const idx = Number(hi);
  if (!Number.isFinite(idx)) return 0;
  const s = slope && slope > 0 ? slope : 113;
  const ratingTerm = rating != null && par != null ? rating - par : 0;
  return Math.round(idx * (s / 113) + ratingTerm);
}

function getStrokeHoles(netStrokes: number, holeHandicaps: number[]): number[] {
  // holeHandicaps[i] = handicapRank for hole i+1 (1=hardest, 18=easiest)
  const sorted = holeHandicaps
    .map((rank, i) => ({ hole: i + 1, rank }))
    .sort((a, b) => a.rank - b.rank);

  const strokeHoles: number[] = [];
  let remaining = netStrokes;

  for (const { hole } of sorted) {
    if (remaining <= 0) break;
    strokeHoles.push(hole);
    remaining--;
  }
  // Wrap around if handicap > 18
  if (remaining > 0) {
    for (const { hole } of sorted) {
      if (remaining <= 0) break;
      strokeHoles.push(hole);
      remaining--;
    }
  }

  return strokeHoles.sort((a, b) => a - b);
}

const FORMAT_NAMES: Record<string, string> = {
  nassau: "Nassau",
  skins: "Skins",
  match_play: "Match Play",
  stableford: "Stableford",
  best_ball: "Best Ball",
  scramble: "Scramble",
};

// Tolerant JSON extractor — strips ```json fences, drops any
// preamble/postamble, and returns the largest valid {...} block.
// Throws when nothing parseable is in the response.
function parseLooseJson(raw: string): { rules?: string; tip?: string; shareText?: string } {
  // Fence strip first (common Haiku output shape).
  let s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(s); } catch { /* fall through */ }
  // Find the largest top-level {...} substring.
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const slice = s.slice(first, last + 1);
    return JSON.parse(slice);
  }
  throw new Error("No JSON object found in LLM response");
}

// Deterministic minimal game sheet — used when the LLM call fails for
// any reason. Keeps the round flow alive; the user can edit later.
function buildFallbackSheet(args: {
  courseName: string;
  format: string;
  formatConfig: Record<string, unknown>;
  players: Array<{ displayName: string; courseHandicap: number; netStrokes: number; teamId: string }>;
  teams: Array<{ name: string; playerIds: string[] }>;
}): { rules: string; tip: string; shareText: string } {
  const { courseName, format, formatConfig, players, teams } = args;
  const formatName = FORMAT_NAMES[format] || format;

  let stakesLine = "";
  if (format === "nassau") {
    stakesLine = `$${formatConfig.frontAmount} front 9 / $${formatConfig.backAmount} back 9 / $${formatConfig.totalAmount} overall.`;
  } else if (format === "skins") {
    stakesLine = `$${formatConfig.skinsAmount} per skin${formatConfig.carryover ? "; ties carry over" : ""}.`;
  } else if (format === "stableford") {
    stakesLine = `Scoring: bogey 1, par 2, birdie 3, eagle 4, albatross 5.`;
  } else if (format === "best_ball") {
    stakesLine = `Team best ball — lowest net score per hole counts.`;
  } else if (format === "match_play") {
    stakesLine = `Match play — win holes, halve ties.`;
  } else if (format === "scramble") {
    stakesLine = `Scramble — everyone hits, group plays the best ball.`;
  }

  const rules = `${formatName} at ${courseName}. ${stakesLine} Net strokes apply per each player's course handicap and stroke holes.`;
  const tip = "Play your own ball straight and play it fast — pace matters more than perfection.";

  const teamLines = teams.length > 0
    ? teams.map(t => `${t.name}: ${t.playerIds.map(pid => players.find(p => (p as any).userId === pid)?.displayName || pid).join(" & ")}`).join("\n")
    : "";
  const playerLines = players.map(p => `${p.displayName} — net ${p.netStrokes}`).join("\n");
  const shareText = [
    `${courseName} — ${formatName}`,
    stakesLine,
    teamLines,
    playerLines,
    "Good luck out there.",
  ].filter(Boolean).join("\n");

  return { rules, tip, shareText };
}

function buildPrompt(data: {
  courseName: string;
  coursePar: number;
  teeSlope: number;
  teeRating: number;
  format: string;
  formatConfig: Record<string, unknown>;
  players: Array<{ displayName: string; handicapIndex: number; courseHandicap: number; netStrokes: number; strokeHoles: number[]; teamId: string }>;
  holeHandicaps: number[];
  teams: Array<{ name: string; playerIds: string[] }>;
}): string {
  const { courseName, coursePar, teeSlope, teeRating, format, formatConfig, players, teams } = data;
  const formatName = FORMAT_NAMES[format] || format;

  const playerLines = players
    .map(p => `  ${p.displayName} (Team ${p.teamId}): HI ${p.handicapIndex} → Course HCP ${p.courseHandicap} → Net ${p.netStrokes} strokes → Holes with stroke: ${p.strokeHoles.length > 0 ? p.strokeHoles.join(", ") : "none"}`)
    .join("\n");

  let formatDetails = "";
  if (format === "nassau") {
    formatDetails = `Bets: $${formatConfig.frontAmount} front 9 / $${formatConfig.backAmount} back 9 / $${formatConfig.totalAmount} overall 18`;
  } else if (format === "skins") {
    formatDetails = `$${formatConfig.skinsAmount} per skin. Carryover on ties: ${formatConfig.carryover ? "yes" : "no"}`;
  } else if (format === "stableford") {
    formatDetails = `Points: 2+ over=0pts, bogey=1pt, par=2pts, birdie=3pts, eagle=4pts, albatross=5pts`;
  } else if (format === "best_ball") {
    formatDetails = `Team best-ball: lowest net score per hole counts for the team`;
  } else if (format === "match_play") {
    formatDetails = `Win holes (halved = tied). Most holes won wins the match`;
  } else if (format === "scramble") {
    formatDetails = `All players hit each shot; group plays from the best ball`;
  }

  const teamLines = teams.length > 0
    ? teams.map(t => `  ${t.name}: ${t.playerIds.map(pid => players.find(p => (p as any).userId === pid)?.displayName || pid).join(" & ")}`).join("\n")
    : "  Individual — no teams";

  return `You are a golf game expert. Generate rules and share text for this round.

Return ONLY valid JSON with exactly three string fields: "rules", "tip", and "shareText".
No markdown, no code blocks — just raw JSON.

COURSE: ${courseName} | TEE: Slope ${teeSlope} / Rating ${teeRating} / Par ${coursePar}
FORMAT: ${formatName} — ${formatDetails}

PLAYERS:
${playerLines}

TEAMS:
${teamLines}

For "rules" (3–5 sentences, plain text):
Explain exactly how ${formatName} works for THIS specific group. Mention: teams, ${formatDetails}, how net strokes apply, who wins and how. Be concrete — name teams/amounts where relevant.

For "tip" (1 sentence):
One practical, specific tip for this format and group (e.g. which holes matter most, pacing, strategy).

For "shareText" (SMS-ready plain text, under 280 words):
- Line 1: "${courseName} — ${formatName}"
- Line 2: Tee: Slope ${teeSlope} / Rating ${teeRating}
- Teams: brief breakdown
- Each player: name, net shots, stroke holes (compact)
- 1-line rules reminder
- Fun sign-off`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: games } = await sb()
    .from("TripGame")
    .select("id, courseId, courseName, format, formatConfig, players, gameSheet, shareText, createdAt, createdBy")
    .eq("tripId", id)
    .order("createdAt", { ascending: false });

  return NextResponse.json({ games: games || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: dbUser } = await sb().from("User").select("id").eq("email", user.email).single();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await sb()
    .from("GolfTripMember")
    .select("id")
    .eq("tripId", id)
    .eq("userId", dbUser.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const body = await req.json();
  const { courseId, courseName, coursePar, teeSlope, teeRating, format, formatConfig, players, holeHandicaps } = body;

  if (!courseId || !courseName || !format || !players?.length || !holeHandicaps?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Calculate course handicaps + stroke allocations
  const lowestCH = Math.min(...players.map((p: any) => calcCourseHandicap(p.handicapIndex, teeSlope, teeRating, coursePar)));

  const enrichedPlayers = players.map((p: any) => {
    const ch = calcCourseHandicap(p.handicapIndex, teeSlope, teeRating, coursePar);
    const net = Math.max(0, ch - lowestCH);
    return {
      ...p,
      courseHandicap: ch,
      netStrokes: net,
      strokeHoles: getStrokeHoles(net, holeHandicaps),
    };
  });

  // Build teams list for prompt
  const teamMap: Record<string, string[]> = {};
  for (const p of enrichedPlayers) {
    const teamId = p.teamId || "Solo";
    if (!teamMap[teamId]) teamMap[teamId] = [];
    teamMap[teamId].push(p.userId);
  }
  const teams = Object.entries(teamMap)
    .filter(([k]) => k !== "Solo")
    .map(([name, playerIds]) => ({ name, playerIds }));

  const prompt = buildPrompt({ courseName, coursePar, teeSlope, teeRating, format, formatConfig, players: enrichedPlayers, holeHandicaps, teams });

  let gameSheet = "";
  let shareText = "";
  try {
    const response = await anthropic.messages.create({
      // Haiku 4.5 handles short structured-JSON game-sheet generation
      // (rules + tip + share text) at ~5x lower cost than Sonnet.
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    const rawText = response.content[0].type === "text" ? response.content[0].text : "{}";
    // Tolerant parse: Haiku occasionally wraps output in ```json fences
    // OR adds a preamble despite the prompt asking for raw JSON. Strip
    // common fence shapes first, then fall back to extracting the
    // largest {...} block in the response.
    const parsed = parseLooseJson(rawText);
    gameSheet = JSON.stringify({ rules: parsed.rules || "", tip: parsed.tip || "" });
    shareText = parsed.shareText || rawText;
  } catch (e) {
    // Don't fail the request just because the LLM hiccuped. Fall back
    // to a deterministic minimal game sheet so the round still
    // creates and the user can play. The fallback is built from the
    // same structured data we already have — accurate, just lacking
    // Claude's flourish.
    console.error("game-sheet LLM failed, using fallback:", e);
    const fallback = buildFallbackSheet({ courseName, format, formatConfig, players: enrichedPlayers, teams });
    gameSheet = JSON.stringify({ rules: fallback.rules, tip: fallback.tip });
    shareText = fallback.shareText;
  }

  // Save hole handicaps to Hole table
  if (holeHandicaps.every((r: number) => r > 0)) {
    await Promise.allSettled(
      holeHandicaps.map((rank: number, i: number) =>
        sb()
          .from("Hole")
          .update({ handicapRank: rank })
          .eq("courseId", courseId)
          .eq("holeNumber", i + 1)
      )
    );
  }

  const gameId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { error: insertError } = await sb().from("TripGame").insert({
    id: gameId,
    tripId: id,
    courseId,
    courseName,
    format,
    formatConfig,
    players: enrichedPlayers,
    holeHandicaps,
    gameSheet,
    shareText,
    createdBy: dbUser.id,
    createdAt: now,
  });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({
    game: {
      id: gameId,
      courseId,
      courseName,
      format,
      formatConfig,
      players: enrichedPlayers,
      gameSheet,
      shareText,
      createdAt: now,
    },
  });
}
