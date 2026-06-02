import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit } from "@/lib/rateLimit";

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// One route, two source types. We let the model classify the image so the
// client doesn't have to ask the user "is this a card or a screenshot?".
//   - "scorecard": a physical card photo — MANY players, gross per hole.
//   - "ghin": a score-app screenshot (GHIN / TheGrint / 18Birdies / etc.) —
//     ONE player plus a stats block (GIR / fairways / putts / rating / slope).
const PROMPT = `You are extracting golf scores from an image. The image is EITHER:
(A) a photo of a physical scorecard listing one or more players' hole-by-hole gross scores, OR
(B) a screenshot from a golf score-tracking app (GHIN, TheGrint, 18Birdies, Golf Pad, Arccos, etc.) showing ONE player's round plus stats.

Return JSON only — no commentary, no markdown, no code fences. Schema:
{
  "kind": "scorecard" | "ghin",
  "holeCount": 9 | 18,
  "par": [number per hole, length = holeCount] | null,
  "players": [
    {
      "name": "player name exactly as written on the card/screenshot",
      "holeScores": [gross strokes per hole, length = holeCount; null for any blank/illegible hole],
      "total": number | null
    }
  ],
  "stats": {
    "scoreToPar": number | null,
    "greensInReg": number | null,
    "fairwaysHit": number | null,
    "fairwaysPossible": number | null,
    "putts": number | null,
    "courseRating": number | null,
    "slope": number | null,
    "tee": "string tee name or color" | null
  } | null
}

Rules:
- Physical scorecard (kind = "scorecard"): extract EVERY player row that has written scores. The player's name is at the start of their row. Do NOT treat the Par, Handicap/Index, Yardage, or tee rows as players. "stats" is null for scorecards.
- App screenshot (kind = "ghin"): exactly ONE player. Fill "stats" from the screenshot; use null for any stat not shown. scoreToPar is relative to par (e.g. +18 → 18, -2 → -2, even → 0).
- holeScores MUST have exactly holeCount entries. Use null for any hole you cannot confidently read — never guess.
- Ignore Out / In / Total / 9 / 18 summary columns for the per-hole arrays. You MAY use the total column to fill "total".
- holeCount is 9 only if the image clearly shows a 9-hole round; otherwise 18.
- If the image is neither a scorecard nor a score-app screenshot, return {"error": "not_a_scorecard"}.`;

export const maxDuration = 30;

type ExtractedPlayer = { name: string; holeScores: (number | null)[]; total: number | null };
type ExtractedStats = {
  scoreToPar: number | null; greensInReg: number | null; fairwaysHit: number | null;
  fairwaysPossible: number | null; putts: number | null; courseRating: number | null;
  slope: number | null; tee: string | null;
};

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: { user }, error: authError } = await sb().auth.getUser(authHeader.slice(7));
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`score-extract:${user.id}`, 8, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many score extractions — try again later" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const imageUrl = body?.imageUrl;
  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          { type: "text", text: PROMPT },
        ],
      }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed: {
      error?: string; kind?: string; holeCount?: number;
      par?: (number | null)[] | null; players?: ExtractedPlayer[]; stats?: ExtractedStats | null;
    };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "AI returned malformed output" }, { status: 502 });
    }

    if (parsed?.error === "not_a_scorecard") {
      return NextResponse.json({ error: "That doesn't look like a scorecard or score screenshot" }, { status: 400 });
    }
    if (!Array.isArray(parsed?.players) || parsed.players.length === 0) {
      return NextResponse.json({ error: "Couldn't read any scores from that image" }, { status: 502 });
    }

    const holeCount = parsed.holeCount === 9 ? 9 : 18;
    const norm = (arr: (number | null)[] | undefined): (number | null)[] => {
      const a = Array.isArray(arr) ? arr.slice(0, holeCount) : [];
      while (a.length < holeCount) a.push(null);
      return a.map(v => (typeof v === "number" && Number.isFinite(v) ? v : null));
    };

    const players = parsed.players
      .filter(p => p && typeof p.name === "string" && p.name.trim())
      .map(p => ({
        name: p.name.trim(),
        holeScores: norm(p.holeScores),
        total: typeof p.total === "number" ? p.total : null,
      }));

    return NextResponse.json({
      ok: true,
      kind: parsed.kind === "ghin" ? "ghin" : "scorecard",
      holeCount,
      par: Array.isArray(parsed.par) ? norm(parsed.par) : null,
      players,
      stats: parsed.kind === "ghin" ? (parsed.stats ?? null) : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Extraction failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
