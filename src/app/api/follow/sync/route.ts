import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Notify a user that someone followed them. The follower row itself is
// written client-side (followerId = self, owner-write RLS). This route
// only fans out the cross-user Notification (owner-only RLS on the
// recipient's row) as service_role, after verifying the follow actually
// exists so the notification can't be spoofed.

type Body = { targetUserId: string };

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
  if (!body.targetUserId || body.targetUserId === user.id) {
    return NextResponse.json({ error: "targetUserId required" }, { status: 400 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: follow } = await admin
    .from("Follow")
    .select("id")
    .eq("followerId", user.id)
    .eq("followingId", body.targetUserId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (!follow) return NextResponse.json({ error: "follow not found" }, { status: 409 });

  const { data: follower } = await admin
    .from("User")
    .select("displayName, username")
    .eq("id", user.id)
    .maybeSingle();
  const followerName = follower?.displayName || follower?.username || "Someone";
  const now = new Date().toISOString();

  await admin.from("Notification").insert({
    id: randomUUID(),
    userId: body.targetUserId,
    type: "follow",
    title: "New follower",
    body: `${followerName} started following you`,
    linkUrl: `/profile/${user.id}`,
    read: false,
    createdAt: now,
    updatedAt: now,
  });

  const origin = new URL(req.url).origin;
  const cookie = req.headers.get("cookie") ?? "";
  fetch(`${origin}/api/push/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ type: "follow_received", recipientUserId: body.targetUserId }),
  }).catch(() => {});
  fetch(`${origin}/api/points/award`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ action: "follow_received", recipientUserId: body.targetUserId }),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
