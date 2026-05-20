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

const PROMPT = `You are extracting per-hole data from a photograph of a golf course scorecard.

Return JSON only — no commentary, no markdown, no code fences. Schema:
{
  "holeCount": 9 | 18,
  "tee": "string identifying which tee column you used for yardage (e.g. 'Championship', 'Blue', 'Black', 'Tips')",
  "holes": [
    {
      "holeNumber": number (1-18),
      "par": number (3 | 4 | 5) | null,
      "handicapRank": number (1-18) | null,
      "yardage": number | null,
      "confidence": {
        "par": "high" | "medium" | "low",
        "handicapRank": "high" | "medium" | "low",
        "yardage": "high" | "medium" | "low"
      }
    }
  ]
}

Rules:
- Yardage: ALWAYS use the tips (the LONGEST tee column on the card). It may be labeled "Black", "Tips", "Championship", "Champ", "Tournament", "Gold", "Pro", or similar — but always the one with the highest yardages. NEVER use middle or forward tees. If only one tee is visible, use that one. Identify which column you used in the top-level "tee" field.
- Handicap rank (also called HCP, HDCP, or Stroke Index) is a row with values 1-18, each appearing exactly once across all 18 holes.
- Ignore total / Out / In / 9 / 18 totals columns — only return per-hole values.
- If a cell is illegible or absent, return null for that field with confidence "low".
- If the image is not a golf scorecard, return {"error": "not_a_scorecard"}.`;

export const maxDuration = 30;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: { user }, error: authError } = await sb().auth.getUser(authHeader.slice(7));
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing course id" }, { status: 400 });

  if (!rateLimit(`scorecard-extract:${user.id}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many scorecard extractions — try again later" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const imageUrl = body?.imageUrl;
  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
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

    let parsed: { error?: string; tee?: string; holeCount?: number; holes?: Array<{
      holeNumber: number; par: number | null; handicapRank: number | null; yardage: number | null;
      confidence?: { par: string; yardage: string; handicapRank: string };
    }> };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "AI returned malformed output" }, { status: 502 });
    }

    if (parsed?.error === "not_a_scorecard") {
      return NextResponse.json({ error: "That doesn't look like a scorecard" }, { status: 400 });
    }

    if (!Array.isArray(parsed?.holes)) {
      return NextResponse.json({ error: "AI returned no holes" }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      tee: parsed.tee ?? null,
      holeCount: parsed.holeCount === 9 ? 9 : 18,
      holes: parsed.holes,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Extraction failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
