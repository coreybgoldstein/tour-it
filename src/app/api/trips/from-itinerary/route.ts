import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// POST /api/trips/from-itinerary
//
// Bootstraps a real GolfTrip row from a TripItinerary blueprint. Lifts
// the itinerary's pre-attached courses into GolfTripCourse rows and
// puts the requesting user on the GolfTripMember table as owner.
// Returns the new tripId so the client can route to /trips/[id].
//
// The trip lands in the user's Tee Up "Trips" tab pre-populated with
// the recommended courses. From there the trip-onboarding flow asks
// the rest (dates, members, lodging notes, etc.).
//
// Body: { itinerarySlug: string }
// Returns: { tripId: string }

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itinerarySlug } = (await req.json()) as { itinerarySlug?: string };
  if (!itinerarySlug) return NextResponse.json({ error: "Missing itinerarySlug" }, { status: 400 });

  // Admin client for the multi-table writes — RLS doesn't matter here
  // because the user is creating their own trip.
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: itinerary, error: itinErr } = await admin
    .from("TripItinerary")
    .select("id, name, tagline, heroImageUrl, durationDays")
    .eq("slug", itinerarySlug)
    .maybeSingle();
  if (itinErr || !itinerary) {
    return NextResponse.json({ error: "Itinerary not found" }, { status: 404 });
  }

  const { data: stops } = await admin
    .from("TripItineraryStop")
    .select("courseId, day, order, note")
    .eq("itineraryId", itinerary.id)
    .order("day", { ascending: true })
    .order("order", { ascending: true });

  const now = new Date().toISOString();
  const tripId = randomUUID();

  // GolfTrip — basic shell. Name = itinerary name + "(trip)" so the
  // user can tell at a glance it was bootstrapped. They can rename.
  const { error: tripErr } = await admin.from("GolfTrip").insert({
    id: tripId,
    name: itinerary.name,
    description: itinerary.tagline,
    imageUrl: itinerary.heroImageUrl ?? null,
    createdBy: user.id,
    createdAt: now,
    updatedAt: now,
  });
  if (tripErr) return NextResponse.json({ error: `Trip insert: ${tripErr.message}` }, { status: 500 });

  // Owner membership row so the user shows in the trip's member list.
  await admin.from("GolfTripMember").insert({
    id: randomUUID(),
    tripId,
    userId: user.id,
    role: "owner",
  });

  // Pre-attach the itinerary's courses. Each course becomes a
  // GolfTripCourse with the day order preserved. Future-dated trips
  // don't get specific play dates yet — the user fills those during
  // the onboarding prompts. courseOrder is global across the trip,
  // not per-day, so we flatten by traversal order.
  if (stops && stops.length > 0) {
    const tripCourseRows = stops.map((s: { courseId: string; day: number; order: number; note: string | null }, idx: number) => ({
      id: randomUUID(),
      tripId,
      courseId: s.courseId,
      playDate: null,
      teeTime: null,
      courseOrder: idx + 1,
      // Stash the itinerary day + note so the trip page can show
      // "Day 1 - Morning" hints if it ever wants to.
      notes: s.note ?? null,
    }));
    await admin.from("GolfTripCourse").insert(tripCourseRows);
  }

  // Award CREATE_TRIP points exactly like the regular create-trip flow.
  fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/points/award`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cookie": req.headers.get("cookie") || "" },
    body: JSON.stringify({ action: "create_trip", referenceId: tripId }),
  }).catch(() => {});

  return NextResponse.json({ tripId });
}
