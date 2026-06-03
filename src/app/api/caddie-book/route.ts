import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Caddie Book synthesis. Takes the raw scout notes golfers logged per hole,
// already bucketed by shot phase (tee / approach / green) on the client, and
// returns a condensed, de-duplicated version per phase. The model ONLY
// reshapes the supplied notes — it never invents intel, since this is a
// factual scouting product where a hallucinated "water left" would be worse
// than saying nothing.

type PhaseNotes = { tee: string[]; approach: string[]; green: string[]; general: string[] };
type HoleIn = { holeNumber: number; par: number | null; yardage: number | null } & PhaseNotes;

export async function POST(req: NextRequest) {
  const { courseName, holes } = (await req.json()) as { courseName?: string; holes?: HoleIn[] };

  if (!Array.isArray(holes) || holes.length === 0) {
    return NextResponse.json({ holes: [] });
  }

  // Trim payload defensively so a course with thousands of notes can't blow
  // the context window — cap notes per phase per hole.
  const trimmed = holes.map(h => ({
    holeNumber: h.holeNumber,
    par: h.par,
    yardage: h.yardage,
    tee: (h.tee ?? []).slice(0, 12),
    approach: (h.approach ?? []).slice(0, 12),
    green: (h.green ?? []).slice(0, 12),
    general: (h.general ?? []).slice(0, 12),
  }));

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are building the "Caddie Book" for ${courseName || "a golf course"} — a hole-by-hole intel digest synthesized strictly from notes real golfers logged while scouting each hole.

For each hole below you get the notes golfers wrote, already bucketed by shot phase (tee, approach, green). Some notes have no phase ("general").

Your job, per hole, per phase:
- Merge notes that say the same thing into ONE clear line. "Left is dead" and "Dead left, miss right" should become a single combined insight, not two bullets.
- Keep the blunt, useful golfer voice. Do not add marketing fluff.
- Use ONLY information present in the supplied notes. Never invent yardages, hazards, wind, or advice that isn't there. If a phase has no notes, omit it.
- Each phase value is a short synthesized string (one or two sentences). Combine multiple distinct points with "; " if needed.

Return ONLY valid JSON, no markdown, in exactly this shape:
{"holes":[{"holeNumber":1,"tee":"...","approach":"...","green":"...","general":"..."}]}
Omit any phase key that has no notes for that hole. Omit any hole that ends up with no content.

Here is the data:
${JSON.stringify(trimmed)}`,
      },
    ],
  });

  const raw = (message.content[0] as { type: string; text: string }).text.trim();
  // Strip code fences if the model wrapped the JSON.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({ holes: Array.isArray(parsed.holes) ? parsed.holes : [] });
  } catch {
    return NextResponse.json({ holes: [], error: "parse_failed" }, { status: 502 });
  }
}
