import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { searchLogId, courseId, courseName, position } = await req.json();
    if (!searchLogId || !courseId) return NextResponse.json({ ok: false });

    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();

    await supabaseAdmin.from("SearchClick").insert({
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
