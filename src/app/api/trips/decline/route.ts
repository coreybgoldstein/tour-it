import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Decline a trip/round/game invite. Verifies the caller actually holds a
// (non-accepted) GolfTripMember row for this trip, deletes it, and
// notifies the trip creator — the cross-user Notification insert runs as
// service_role (owner-only RLS on the creator's row). Centralizing the
// delete here lets us prove the membership existed before notifying, so
// the "X declined" notification can't be spoofed.

type Body = { tripId: string };

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
  if (!body.tripId) {
    return NextResponse.json({ error: "tripId required" }, { status: 400 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: member } = await admin
    .from("GolfTripMember")
    .select("id, status")
    .eq("userId", user.id)
    .eq("tripId", body.tripId)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "not a member" }, { status: 409 });

  await admin.from("GolfTripMember").delete().eq("userId", user.id).eq("tripId", body.tripId);

  const { data: trip } = await admin
    .from("GolfTrip")
    .select("name, createdBy")
    .eq("id", body.tripId)
    .maybeSingle();

  if (trip?.createdBy && trip.createdBy !== user.id) {
    const { data: me } = await admin
      .from("User")
      .select("displayName, username")
      .eq("id", user.id)
      .maybeSingle();
    const myName = me?.displayName || me?.username || "Someone";
    const now = new Date().toISOString();
    await admin.from("Notification").insert({
      id: randomUUID(),
      userId: trip.createdBy,
      type: "invite_declined",
      title: "Invite declined",
      body: `${myName} can't make "${trip.name}"`,
      linkUrl: `/trips/${body.tripId}`,
      referenceId: body.tripId,
      read: false,
      createdAt: now,
      updatedAt: now,
    });
    const origin = new URL(req.url).origin;
    const cookie = req.headers.get("cookie") ?? "";
    fetch(`${origin}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ type: "invite_declined", recipientUserId: trip.createdBy, referenceId: body.tripId }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
