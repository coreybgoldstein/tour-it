import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

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

// Persists hole-by-hole scores for a round/game. Creates (or updates) a
// Round ledger row for EVERY player matched to an app user, and writes the
// full per-player score map onto the game so the Phase 3 settlement engine
// can compute money. Guests (no userId) live only in the game's scores map.
type InPlayer = {
  key: string;                 // userId when matched, else display name
  userId: string | null;
  name: string;
  holeScores: (number | null)[];
  stats?: {
    scoreToPar?: number | null; greensInReg?: number | null; fairwaysHit?: number | null;
    fairwaysPossible?: number | null; putts?: number | null; courseRating?: number | null;
    slope?: number | null; tee?: string | null;
  } | null;
};

type Body = {
  tripId: string;
  courseId: string;
  date: string;                // YYYY-MM-DD
  tripGameId?: string | null;
  golfTripId?: string | null;
  par?: (number | null)[] | null;
  source?: "scorecard" | "ghin" | "manual";
  players: InPlayer[];
};

const sumNonNull = (a: (number | null)[]) =>
  a.reduce((s: number, v) => (typeof v === "number" ? s + v : s), 0);
const hasAnyScore = (a: (number | null)[]) => a.some(v => typeof v === "number");

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.tripId || !body.courseId || !body.date || !Array.isArray(body.players)) {
    return NextResponse.json({ error: "tripId, courseId, date, players required" }, { status: 400 });
  }

  const admin = sb();

  // Only a member/creator of the trip may record its scores.
  const { data: dbUser } = await admin.from("User").select("id").eq("id", user.id).maybeSingle();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [{ data: member }, { data: trip }] = await Promise.all([
    admin.from("GolfTripMember").select("id").eq("tripId", body.tripId).eq("userId", user.id).maybeSingle(),
    admin.from("GolfTrip").select("id, createdBy").eq("id", body.tripId).maybeSingle(),
  ]);
  if (!trip) return NextResponse.json({ error: "trip not found" }, { status: 404 });
  if (!member && trip.createdBy !== user.id) {
    return NextResponse.json({ error: "not a member of this trip" }, { status: 403 });
  }

  const parTotal = Array.isArray(body.par) ? sumNonNull(body.par) : 0;
  const source = body.source ?? "manual";
  const now = new Date().toISOString();

  // Score map written onto the game for settlement + H2H. Keyed by player
  // key (userId when matched, display name for guests).
  const scoreMap: Record<string, (number | null)[]> = {};
  const createdRounds: { userId: string; roundId: string }[] = [];

  for (const p of body.players) {
    if (!Array.isArray(p.holeScores) || !hasAnyScore(p.holeScores)) continue;
    scoreMap[p.key] = p.holeScores;
    if (!p.userId) continue; // guest — no ledger row

    const total = sumNonNull(p.holeScores);
    const st = p.stats ?? null;
    const scoreToPar = st?.scoreToPar ?? (parTotal > 0 ? total - parTotal : null);

    const { data: existing } = await admin
      .from("Round")
      .select("id")
      .eq("userId", p.userId)
      .eq("courseId", body.courseId)
      .eq("date", body.date)
      .maybeSingle();

    const fields = {
      userId: p.userId,
      courseId: body.courseId,
      date: body.date,
      totalScore: total,
      holeScores: p.holeScores,
      scoreToPar,
      greensInReg: st?.greensInReg ?? null,
      fairwaysHit: st?.fairwaysHit ?? null,
      fairwaysPossible: st?.fairwaysPossible ?? null,
      putts: st?.putts ?? null,
      courseRating: st?.courseRating ?? null,
      slope: st?.slope ?? null,
      teeColor: st?.tee ?? null,
      source,
      golfTripId: body.golfTripId ?? body.tripId,
      tripGameId: body.tripGameId ?? null,
      updatedAt: now,
    };

    if (existing?.id) {
      await admin.from("Round").update(fields).eq("id", existing.id);
      createdRounds.push({ userId: p.userId, roundId: existing.id });
    } else {
      const roundId = randomUUID();
      const { error: insErr } = await admin.from("Round").insert({ id: roundId, createdAt: now, ...fields });
      if (insErr) return NextResponse.json({ error: `round insert: ${insErr.message}` }, { status: 500 });
      createdRounds.push({ userId: p.userId, roundId });
    }
  }

  // Persist the per-player score map onto the game (settlement reads it).
  if (body.tripGameId) {
    await admin.from("TripGame").update({ scores: scoreMap }).eq("id", body.tripGameId);
  }

  return NextResponse.json({ ok: true, rounds: createdRounds, players: Object.keys(scoreMap).length });
}
