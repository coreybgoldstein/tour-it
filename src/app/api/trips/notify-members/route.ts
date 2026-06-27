import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Fan out trip/game invite + challenge notifications to members of a trip
// the caller owns. The GolfTripMember rows are still written client-side
// (owner-insert RLS); this route only performs the cross-user Notification
// inserts (owner-only RLS) as service_role. Guards: the caller must own
// the trip, and every recipient must already be a member of it — so the
// content can vary per call site but no one can be spammed off-trip.

type NotifRow = {
  userId: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string;
  referenceId?: string;
  pushType?: string;
};

type Body = { tripId: string; notifications: NotifRow[] };

// Accept a web cookie session OR a native Bearer token. Token first, cookie
// fallback (Expo app sends Authorization: Bearer <token>, no cookies).
async function getAuthedUser(req: Request): Promise<{ id: string } | null> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (token) {
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: { user } } = await svc.auth.getUser(token);
    if (user) return user;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.tripId || !Array.isArray(body.notifications) || body.notifications.length === 0) {
    return NextResponse.json({ error: "tripId and notifications required" }, { status: 400 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Authorize: caller created the trip OR is an accepted owner-role member.
  const { data: trip } = await admin
    .from("GolfTrip")
    .select("createdBy")
    .eq("id", body.tripId)
    .maybeSingle();
  let authorized = trip?.createdBy === user.id;
  if (!authorized) {
    const { data: ownerMember } = await admin
      .from("GolfTripMember")
      .select("id")
      .eq("tripId", body.tripId)
      .eq("userId", user.id)
      .eq("role", "owner")
      .eq("status", "accepted")
      .maybeSingle();
    authorized = !!ownerMember;
  }
  if (!authorized) return NextResponse.json({ error: "not trip owner" }, { status: 403 });

  // Constrain recipients to actual members of this trip.
  const { data: members } = await admin
    .from("GolfTripMember")
    .select("userId")
    .eq("tripId", body.tripId);
  const memberIds = new Set((members ?? []).map((m: { userId: string }) => m.userId));

  const valid = body.notifications.filter(n => n.userId && memberIds.has(n.userId) && n.userId !== user.id);
  if (valid.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const now = new Date().toISOString();
  await admin.from("Notification").insert(
    valid.map(n => ({
      id: randomUUID(),
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      linkUrl: n.linkUrl,
      referenceId: n.referenceId ?? body.tripId,
      read: false,
      createdAt: now,
      updatedAt: now,
    }))
  );

  const origin = new URL(req.url).origin;
  const cookie = req.headers.get("cookie") ?? "";
  for (const n of valid) {
    if (!n.pushType) continue;
    fetch(`${origin}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ type: n.pushType, recipientUserId: n.userId, referenceId: n.referenceId ?? body.tripId }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, sent: valid.length });
}
