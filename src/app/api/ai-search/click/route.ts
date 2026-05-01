import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { searchLogId, courseId, courseName, position } = await req.json();
    if (!searchLogId || !courseId) return NextResponse.json({ ok: false });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("SearchClick").insert({
      id: crypto.randomUUID(),
      searchLogId,
      courseId,
      courseName: courseName || "",
      position: position ?? 0,
      userId: user?.id || null,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
