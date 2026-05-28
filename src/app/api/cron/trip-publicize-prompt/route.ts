import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Day-after-trip notifier.
//
// Every day this finds GolfTrips whose endDate was yesterday (UTC),
// are still private (isPublic=false), and haven't been prompted yet
// (publicizeNotifiedAt IS NULL). For each, drops a Notification into
// the creator's inbox suggesting they publish the trip as a public
// itinerary.
//
// The user clicks the notification → routes to /trips/[id]?publicize=1
// which opens the publicize confirmation sheet on the trip page.
//
// Idempotent: publicizeNotifiedAt is set the moment we insert the
// notification so a re-run on the same day is a no-op.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function yesterdayIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const isCron = req.headers.get("x-vercel-cron") === "1";
  const ok = isCron || auth === `Bearer ${process.env.INTERNAL_API_SECRET}`;
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const yesterday = yesterdayIso();
  const { data: trips, error } = await sb
    .from("GolfTrip")
    .select("id, name, createdBy, endDate")
    .eq("endDate", yesterday)
    .eq("isPublic", false)
    .is("publicizeNotifiedAt", null);

  if (error) {
    console.error("trip-publicize-prompt: fetch failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!trips || trips.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  const now = new Date().toISOString();
  const notifRows = trips.map((t) => ({
    id: randomUUID(),
    userId: t.createdBy,
    type: "trip_publicize_prompt",
    title: `How was ${t.name}?`,
    body: "Want to share this trip publicly so other golfers can find it? Tap to publish.",
    linkUrl: `/trips/${t.id}?publicize=1`,
    referenceId: t.id,
    read: false,
    createdAt: now,
    updatedAt: now,
  }));

  const { error: notifErr } = await sb.from("Notification").insert(notifRows);
  if (notifErr) {
    console.error("trip-publicize-prompt: notification insert failed", notifErr);
    return NextResponse.json({ error: notifErr.message }, { status: 500 });
  }

  // Mark each trip so we don't re-prompt tomorrow.
  await Promise.all(
    trips.map((t) =>
      sb.from("GolfTrip").update({ publicizeNotifiedAt: now }).eq("id", t.id)
    )
  );

  return NextResponse.json({ ok: true, notified: trips.length, trips: trips.map((t) => t.id) });
}
