import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Approve/deny a user-submitted CourseRequest. Verifies the caller is an
// admin, updates the request, and (on approval) notifies the requester —
// the cross-user Notification insert runs as service_role so it survives
// owner-only RLS once enabled.

type Body = { requestId: string; action: "approve" | "deny" };

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
  if (!body.requestId || (body.action !== "approve" && body.action !== "deny")) {
    return NextResponse.json({ error: "requestId and action required" }, { status: 400 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: me } = await admin.from("User").select("isAdmin").eq("id", user.id).maybeSingle();
  if (!me?.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: request } = await admin
    .from("CourseRequest")
    .select("userId, name")
    .eq("id", body.requestId)
    .maybeSingle();
  if (!request) return NextResponse.json({ error: "request not found" }, { status: 404 });

  await admin
    .from("CourseRequest")
    .update({ status: body.action === "approve" ? "APPROVED" : "DENIED" })
    .eq("id", body.requestId);

  if (body.action === "approve" && request.userId) {
    const now = new Date().toISOString();
    await admin.from("Notification").insert({
      id: randomUUID(),
      userId: request.userId,
      type: "course_request",
      title: "Course request approved",
      body: `Your request to add ${request.name} has been approved. It will appear in search soon.`,
      linkUrl: "/search",
      read: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  return NextResponse.json({ ok: true });
}
