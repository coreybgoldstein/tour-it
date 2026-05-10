import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// POST /api/itineraries/:id/throw — increment dartThrowCount on the itinerary.
// Fire-and-forget on the client; failures here log but don't break the UX.
//
// Implementation note: read-then-write pattern. Race conditions can lose ~one
// throw if two land in the same millisecond, which is fine for a non-critical
// counter. If we ever need exact accuracy, swap this for a Postgres RPC
// (CREATE FUNCTION ... UPDATE ... SET count = count + 1) and call via .rpc().
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: row, error: readErr } = await supabase
    .from("TripItinerary")
    .select("dartThrowCount")
    .eq("id", id)
    .single();

  if (readErr) {
    console.error("dart throw read error:", readErr.message);
    return NextResponse.json({ ok: true });
  }

  const next = (row?.dartThrowCount ?? 0) + 1;
  const { error: writeErr } = await supabase
    .from("TripItinerary")
    .update({ dartThrowCount: next, updatedAt: new Date().toISOString() })
    .eq("id", id);

  if (writeErr) console.error("dart throw write error:", writeErr.message);
  return NextResponse.json({ ok: true });
}
