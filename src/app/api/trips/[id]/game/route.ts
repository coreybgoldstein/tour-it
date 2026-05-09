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

function calcCourseHandicap(hi: number, slope: number, rating: number, par: number): number {
  return Math.round(hi * (slope / 113) + (rating - par));
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
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    const rawText = response.content[0].type === "text" ? response.content[0].text : "{}";
    const parsed = JSON.parse(rawText);
    gameSheet = JSON.stringify({ rules: parsed.rules || "", tip: parsed.tip || "" });
    shareText = parsed.shareText || rawText;
  } catch (e) {
    return NextResponse.json({ error: "Failed to generate game sheet" }, { status: 500 });
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
