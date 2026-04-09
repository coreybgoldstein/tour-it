import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { searchLogId, courseId, courseName, position, userId } = await req.json();
    if (!searchLogId || !courseId) return NextResponse.json({ ok: false });

    await supabase.from("SearchClick").insert({
      id: crypto.randomUUID(),
      searchLogId,
      courseId,
      courseName: courseName || "",
      position: position ?? 0,
      userId: userId || null,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
