import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { name, city, state } = await req.json();

  if (!name) {
    return NextResponse.json({ error: "Course name required" }, { status: 400 });
  }

  const location = [city, state].filter(Boolean).join(", ");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 120,
    messages: [
      {
        role: "user",
        content: `Write a 2-sentence description of the golf course "${name}"${location ? ` in ${location}` : ""}.

Write it the way a golfer who's played there would describe it to a friend — honest, specific, a little personality. No markdown, no headers, no bullet points. No marketing fluff. No "nestled", no "breathtaking views", no "world-class". Sound like you've actually walked the fairways. Keep it under 60 words. Start directly with the description.`,
      },
    ],
  });

  const raw = (message.content[0] as { type: string; text: string }).text;
  // Strip any leading markdown heading Claude might add
  const text = raw.replace(/^#+\s+.+\n+/, "").trim();
  return NextResponse.json({ description: text });
}
