import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// POST /api/trips/[id]/publicize
//
// Converts a private GolfTrip into a public TripItinerary. Only the
// trip creator can do this.
//
// Body: { name?, tagline?, vibeTag?, costBand?, region? }  (overrides;
//   sensible defaults are derived from the source trip + courses if
//   omitted)
//
// What lands in the catalog:
//   - A new TripItinerary row with a unique slug, hero image (from
//     source trip OR first course's coverImageUrl), tagline, etc.
//   - TripItineraryStop rows mirroring the GolfTripCourse rows, with
//     each note copied across
//   - sourceGolfTripId + submittedByUserId set so the trip-ideas page
//     can show "Submitted by @username"
//
// What does NOT land in the catalog:
//   - Specific play dates (we strip them — "broad details only")
//   - Member list
//   - Trip messages / chat
//   - Individual notes are NOT copied here in v1; future work can
//     surface GolfTripNote as a tips section on the public itinerary.
//
// The source GolfTrip's isPublic flips true + publicizedAt stamped so
// the cron doesn't re-prompt and the UI can hide the "publicize" CTA.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Common-word slug normaliser.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[''']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  if (!tripId) return NextResponse.json({ error: "Missing trip id" }, { status: 400 });

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });

  // Bearer auth via the user-side client per the project's API-auth pattern.
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const body = (await req.json().catch(() => ({}))) as {
    tagline?: string;
    vibeTag?: string;
    costBand?: string;
    region?: string;
  };

  const { data: trip, error: tripErr } = await admin
    .from("GolfTrip")
    .select("id, name, description, createdBy, imageUrl, arrivalAirport, lodging, isPublic, startDate, endDate")
    .eq("id", tripId)
    .maybeSingle();
  if (tripErr || !trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  if (trip.createdBy !== user.id) return NextResponse.json({ error: "Only the creator can publish a trip" }, { status: 403 });
  if (trip.isPublic) return NextResponse.json({ error: "Trip is already public" }, { status: 409 });

  // Pull courses with coords (needed for the itinerary centroid). The
  // joined Course is what the public itinerary will reference.
  const { data: stops } = await admin
    .from("GolfTripCourse")
    .select("courseId, sortOrder, course:Course!GolfTripCourse_courseId_fkey(id, name, city, state, latitude, longitude, coverImageUrl)")
    .eq("tripId", tripId)
    .order("sortOrder");

  // Supabase types the foreign-key join as an array even when there's
  // exactly one related row, so normalize to a single object up front.
  type JoinedStop = {
    courseId: string;
    sortOrder: number;
    course: { id: string; name: string; city: string; state: string; latitude: number | null; longitude: number | null; coverImageUrl: string | null } | null;
  };
  const normalized: JoinedStop[] = ((stops ?? []) as any[]).map((s) => ({
    courseId: s.courseId,
    sortOrder: s.sortOrder,
    course: Array.isArray(s.course) ? s.course[0] ?? null : s.course ?? null,
  }));
  const validStops = normalized.filter((s) => s.course && s.course.latitude != null && s.course.longitude != null) as Array<JoinedStop & { course: NonNullable<JoinedStop["course"]> }>;
  if (validStops.length === 0) {
    return NextResponse.json({ error: "This trip needs at least one course with coordinates before it can be publicized." }, { status: 400 });
  }

  // Centroid for the TripItinerary lat/lng — same convention used by
  // the curated catalog seeder.
  const lats = validStops.map((s) => s.course.latitude as number);
  const lngs = validStops.map((s) => s.course.longitude as number);
  const centLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const centLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

  // Hero image — prefer the trip's imageUrl, fall back to the first
  // course's coverImageUrl.
  const heroImageUrl =
    trip.imageUrl ||
    (validStops.find((s) => s.course.coverImageUrl)?.course.coverImageUrl ?? null);

  // Region inference — first stop's state, capitalized. The creator
  // can pass a body.region override (e.g. "Carolina Sandhills").
  const region =
    body.region ||
    validStops[0].course.state ||
    "United States";

  // Slug uniqueness — append a short suffix if a curated trip already
  // owns the natural slug.
  const baseSlug = slugify(trip.name);
  let slug = baseSlug || `trip-${randomUUID().slice(0, 6)}`;
  const { data: clash } = await admin.from("TripItinerary").select("id").eq("slug", slug).maybeSingle();
  if (clash) slug = `${slug}-${randomUUID().slice(0, 4)}`;

  // Duration — prefer real endDate-startDate, else stop count.
  let durationDays = validStops.length;
  if (trip.startDate && trip.endDate) {
    const s = new Date(trip.startDate + "T00:00:00Z");
    const e = new Date(trip.endDate + "T00:00:00Z");
    const diff = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
    if (diff > 0 && diff <= 14) durationDays = diff;
  }

  // Best-season window from the trip's actual played month (gives the
  // /search planner a real seasonal signal).
  const monthFrom = (iso?: string | null) => (iso ? new Date(iso + "T00:00:00Z").getUTCMonth() + 1 : 1);
  const bestSeasonStart = monthFrom(trip.startDate);
  const bestSeasonEnd = monthFrom(trip.endDate ?? trip.startDate);

  const itineraryId = randomUUID();
  const now = new Date().toISOString();

  const itineraryRow = {
    id: itineraryId,
    slug,
    name: trip.name,
    tagline: body.tagline?.trim() || trip.description || `A ${durationDays}-day trip from a Tour It member`,
    whyThisTrip:
      trip.description?.trim()
        ? trip.description
        : `Shared by a Tour It member who actually went. ${validStops.length} stops, ${durationDays} days.${trip.arrivalAirport ? ` Flew into ${trip.arrivalAirport}.` : ""}${trip.lodging ? ` Stayed at ${trip.lodging}.` : ""}`,
    heroImageUrl,
    vibeTag: body.vibeTag || "WILD_CARD",
    costBand: body.costBand || "$$$",
    bestSeasonStart,
    bestSeasonEnd,
    durationDays,
    stayRec: trip.lodging || "Member-submitted — see notes for lodging",
    latitude: centLat,
    longitude: centLng,
    region,
    sourceGolfTripId: trip.id,
    submittedByUserId: trip.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  const { error: insErr } = await admin.from("TripItinerary").insert(itineraryRow);
  if (insErr) return NextResponse.json({ error: `Itinerary insert: ${insErr.message}` }, { status: 500 });

  const stopRows = validStops.map((s, idx) => ({
    id: randomUUID(),
    itineraryId,
    courseId: s.course.id,
    day: idx + 1,
    order: 1,
    note: null,
  }));
  await admin.from("TripItineraryStop").insert(stopRows);

  // Flip the source trip's flag so the publicize CTA stops showing up
  // and the day-after cron no longer prompts.
  await admin.from("GolfTrip").update({
    isPublic: true,
    publicizedAt: now,
    publicizeNotifiedAt: now,
  }).eq("id", trip.id);

  return NextResponse.json({ slug, itineraryId });
}
