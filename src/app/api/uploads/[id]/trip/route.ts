import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Assigns a clip to a shared trip/round page after the user picks one in
// the "which round is this for?" disambiguation prompt (fired when a clip
// matched more than one of their trips on the same course+date).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: uploadId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { tripId: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Only the clip owner may reassign it.
  const { data: upload } = await admin
    .from("Upload")
    .select("id, userId, roundId")
    .eq("id", uploadId)
    .maybeSingle();
  if (!upload) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (upload.userId !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Clearing the pairing.
  if (!body.tripId) {
    await admin.from("Upload").update({ tripId: null }).eq("id", uploadId);
    if (upload.roundId) await admin.from("Round").update({ golfTripId: null }).eq("id", upload.roundId);
    return NextResponse.json({ ok: true, tripId: null });
  }

  // The user must belong to the trip they're pairing to.
  const [{ data: membership }, { data: trip }] = await Promise.all([
    admin.from("GolfTripMember").select("id").eq("tripId", body.tripId).eq("userId", user.id).maybeSingle(),
    admin.from("GolfTrip").select("id, createdBy").eq("id", body.tripId).maybeSingle(),
  ]);
  if (!trip) return NextResponse.json({ error: "trip not found" }, { status: 404 });
  if (!membership && trip.createdBy !== user.id) {
    return NextResponse.json({ error: "not a member of this trip" }, { status: 403 });
  }

  await admin.from("Upload").update({ tripId: body.tripId }).eq("id", uploadId);
  if (upload.roundId) await admin.from("Round").update({ golfTripId: body.tripId }).eq("id", upload.roundId);

  return NextResponse.json({ ok: true, tripId: body.tripId });
}
