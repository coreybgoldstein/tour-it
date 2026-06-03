import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Caddie Book synthesis. Takes the raw scout notes golfers logged per hole,
// already bucketed by shot phase (tee / approach / green) on the client, and
// returns a condensed, de-duplicated version per phase. The model ONLY
// reshapes the supplied notes — it never invents intel, since this is a
// factual scouting product where a hallucinated "water left" would be worse
// than saying nothing.
//
// Result is cached on the Course row keyed by a signature of the input notes,
// so only the first viewer after the intel changes pays the token cost.

type PhaseNotes = { tee: string[]; approach: string[]; green: string[]; general: string[] };
type HoleIn = { holeNumber: number; par: number | null; yardage: number | null; overview: string | null } & PhaseNotes;
type HoleOut = { holeNumber: number; overview?: string; tee?: string; approach?: string; green?: string; general?: string };

// Stable signature of the notes, independent of clip/note ordering, so the
// cache only busts when the actual intel content changes.
function signature(holes: HoleIn[]): string {
  const normalized = holes
    .map(h => ({
      n: h.holeNumber,
      o: h.overview ?? "",
      t: [...(h.tee ?? [])].sort(),
      a: [...(h.approach ?? [])].sort(),
      g: [...(h.green ?? [])].sort(),
      x: [...(h.general ?? [])].sort(),
    }))
    .sort((a, b) => a.n - b.n);
  return createHash("sha1").update(JSON.stringify(normalized)).digest("hex");
}

export async function POST(req: NextRequest) {
  const { courseId, courseName, holes } = (await req.json()) as {
    courseId?: string;
    courseName?: string;
    holes?: HoleIn[];
  };

  if (!Array.isArray(holes) || holes.length === 0) {
    return NextResponse.json({ holes: [] });
  }

  const sig = signature(holes);
  const supabase = courseId ? createAdminClient() : null;

  // Cache hit — return the stored synthesis without calling the model.
  if (supabase && courseId) {
    const { data } = await supabase
      .from("Course")
      .select("caddieBookJson, caddieBookSig")
      .eq("id", courseId)
      .maybeSingle();
    if (data?.caddieBookSig === sig && data.caddieBookJson) {
      try {
        return NextResponse.json({ holes: JSON.parse(data.caddieBookJson) as HoleOut[], cached: true });
      } catch {
        // fall through to regenerate on corrupt cache
      }
    }
  }

  // Trim payload defensively so a course with thousands of notes can't blow
  // the context window — cap notes per phase per hole.
  const trimmed = holes.map(h => ({
    holeNumber: h.holeNumber,
    par: h.par,
    yardage: h.yardage,
    overview: h.overview ?? null,
    tee: (h.tee ?? []).slice(0, 12),
    approach: (h.approach ?? []).slice(0, 12),
    green: (h.green ?? []).slice(0, 12),
    general: (h.general ?? []).slice(0, 12),
  }));

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3500,
    messages: [
      {
        role: "user",
        content: `You are building the "Caddie Book" for ${courseName || "a golf course"} — a hole-by-hole intel digest synthesized strictly from notes real golfers logged while scouting each hole.

For each hole below you may get two kinds of source material:
1. An "overview" — a seeded editorial description of the hole (may be null).
2. Notes golfers wrote, already bucketed by shot phase (tee, approach, green). Some notes have no phase ("general").

Your job, per hole:
- "overview": If an overview is supplied, condense it into one or two tight, useful sentences that set up the hole (its character, the strategic challenge). Drop marketing fluff. If no overview is supplied, omit this key.
- Per phase (tee/approach/green/general): Merge notes that say the same thing into ONE clear line. "Left is dead" and "Dead left, miss right" should become a single combined insight, not two bullets. Keep the blunt, useful golfer voice.
- Use ONLY information present in the supplied overview and notes. Never invent yardages, hazards, wind, or advice that isn't there. If a phase has no notes, omit it.
- Each phase value is a short synthesized string (one or two sentences). Combine multiple distinct points with "; " if needed.

Return ONLY valid JSON, no markdown, in exactly this shape:
{"holes":[{"holeNumber":1,"overview":"...","tee":"...","approach":"...","green":"...","general":"..."}]}
Omit any key (including "overview") that has no source material for that hole. Omit any hole that ends up with no content.

Here is the data:
${JSON.stringify(trimmed)}`,
      },
    ],
  });

  const raw = (message.content[0] as { type: string; text: string }).text.trim();
  // Strip code fences if the model wrapped the JSON.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let outHoles: HoleOut[];
  try {
    const parsed = JSON.parse(cleaned);
    outHoles = Array.isArray(parsed.holes) ? parsed.holes : [];
  } catch {
    return NextResponse.json({ holes: [], error: "parse_failed" }, { status: 502 });
  }

  // Persist the fresh synthesis so subsequent viewers read it for free.
  if (supabase && courseId) {
    await supabase
      .from("Course")
      .update({ caddieBookJson: JSON.stringify(outHoles), caddieBookSig: sig, caddieBookAt: new Date().toISOString() })
      .eq("id", courseId);
  }

  return NextResponse.json({ holes: outHoles });
}
