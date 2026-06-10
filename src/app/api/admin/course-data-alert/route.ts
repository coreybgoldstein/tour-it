import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Any authenticated user can flag that a course they just added to a trip
// is missing hole-handicap data; this notifies the admin team so the
// scorecard can be seeded. The cross-user Notification inserts (to admin
// accounts) run as service_role so they survive owner-only RLS.

type Body = { courseId: string; courseName: string };

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.courseId || !body.courseName) {
    return NextResponse.json({ error: "courseId and courseName required" }, { status: 400 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: admins } = await admin.from("User").select("id").eq("isAdmin", true);
  if (!admins?.length) return NextResponse.json({ ok: true, sent: 0 });

  const now = new Date().toISOString();
  await admin.from("Notification").insert(
    admins.map((a: { id: string }) => ({
      id: randomUUID(),
      userId: a.id,
      type: "admin_alert",
      title: "Course needs scorecard data",
      body: `"${body.courseName}" was added to a trip — hole handicap rankings may be missing`,
      linkUrl: `/courses/${body.courseId}`,
      read: false,
      createdAt: now,
      updatedAt: now,
    }))
  );

  return NextResponse.json({ ok: true, sent: admins.length });
}
