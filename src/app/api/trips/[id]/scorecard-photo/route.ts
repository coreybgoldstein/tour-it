import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getAuthedUser(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await sb().auth.getUser(token);
  return user;
}

export const dynamic = "force-dynamic";

// Only a creator/member of the trip may touch its scorecard photos.
async function authorize(req: NextRequest, tripId: string) {
  const user = await getAuthedUser(req);
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = sb();
  const [{ data: trip }, { data: member }] = await Promise.all([
    admin.from("GolfTrip").select("id, createdBy, scorecardPhotos").eq("id", tripId).maybeSingle(),
    admin.from("GolfTripMember").select("id").eq("tripId", tripId).eq("userId", user.id).maybeSingle(),
  ]);
  if (!trip) return { error: NextResponse.json({ error: "not found" }, { status: 404 }) };
  if (!member && trip.createdBy !== user.id) {
    return { error: NextResponse.json({ error: "not a member of this trip" }, { status: 403 }) };
  }
  const photos: string[] = Array.isArray(trip.scorecardPhotos) ? (trip.scorecardPhotos as string[]) : [];
  return { admin, photos };
}

// Attach a scorecard photo URL (already uploaded to Supabase Storage).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const auth = await authorize(req, tripId);
  if ("error" in auth) return auth.error;

  let url: string;
  try {
    ({ url } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof url !== "string" || !url.startsWith("http")) {
    return NextResponse.json({ error: "valid url required" }, { status: 400 });
  }

  const next = auth.photos.includes(url) ? auth.photos : [...auth.photos, url];
  const { error } = await auth.admin.from("GolfTrip").update({ scorecardPhotos: next }).eq("id", tripId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, scorecardPhotos: next });
}

// Remove a scorecard photo URL.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const auth = await authorize(req, tripId);
  if ("error" in auth) return auth.error;

  let url: string;
  try {
    ({ url } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const next = auth.photos.filter((p) => p !== url);
  const { error } = await auth.admin.from("GolfTrip").update({ scorecardPhotos: next }).eq("id", tripId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, scorecardPhotos: next });
}
