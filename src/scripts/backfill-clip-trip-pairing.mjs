// backfill-clip-trip-pairing.mjs
// Retroactively links existing Rounds (and their clips) to the shared
// GolfTrip that covers the same course + date, mirroring the auto-pairing
// now done at upload time in /api/uploads/create.
//
// Only pairs when exactly ONE of the user's trips matches that course+date
// — ambiguous cases (played the same course twice in a day) are left for
// the user to resolve, same as the live flow.
//
// Usage: node src/scripts/backfill-clip-trip-pairing.mjs [--dry]

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");

const DRY = process.argv.includes("--dry");
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function fetchAll(table, columns) {
  const PAGE = 1000;
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

const dateOnly = (s) => (s ? String(s).split("T")[0] : null);

async function main() {
  console.log(`=== backfill-clip-trip-pairing ${DRY ? "(dry run)" : ""} ===`);

  const [members, trips, stops] = await Promise.all([
    fetchAll("GolfTripMember", "tripId, userId"),
    fetchAll("GolfTrip", "id, name, createdBy, startDate, endDate"),
    fetchAll("GolfTripCourse", "tripId, courseId, secondaryCourseId, playDate"),
  ]);

  // userId -> Set(tripId) the user belongs to (membership or creator)
  const userTrips = new Map();
  const addUserTrip = (uid, tid) => {
    if (!userTrips.has(uid)) userTrips.set(uid, new Set());
    userTrips.get(uid).add(tid);
  };
  for (const m of members) addUserTrip(m.userId, m.tripId);
  for (const t of trips) addUserTrip(t.createdBy, t.id);

  const tripById = new Map(trips.map((t) => [t.id, t]));
  const stopsByTrip = new Map();
  for (const s of stops) {
    if (!stopsByTrip.has(s.tripId)) stopsByTrip.set(s.tripId, []);
    stopsByTrip.get(s.tripId).push(s);
  }

  const candidatesFor = (userId, courseId, roundDate) => {
    const tids = userTrips.get(userId);
    if (!tids) return [];
    const out = [];
    for (const tid of tids) {
      const trip = tripById.get(tid);
      if (!trip) continue;
      const tStops = (stopsByTrip.get(tid) ?? []).filter(
        (s) => s.courseId === courseId || s.secondaryCourseId === courseId
      );
      if (tStops.length === 0) continue;
      const dateMatch = tStops.some((s) => {
        const pd = dateOnly(s.playDate);
        if (pd) return pd === roundDate;
        const sd = dateOnly(trip.startDate);
        const ed = dateOnly(trip.endDate);
        if (sd && ed) return roundDate >= sd && roundDate <= ed;
        if (sd) return roundDate === sd;
        return true;
      });
      if (dateMatch) out.push(trip);
    }
    return out;
  };

  const rounds = await fetchAll("Round", "id, userId, courseId, date, golfTripId");
  console.log(`Rounds: ${rounds.length}`);

  let paired = 0, ambiguous = 0, noMatch = 0, alreadyLinked = 0, clipsLinked = 0;
  for (const r of rounds) {
    if (r.golfTripId) { alreadyLinked++; continue; }
    const cands = candidatesFor(r.userId, r.courseId, dateOnly(r.date));
    if (cands.length === 0) { noMatch++; continue; }
    if (cands.length > 1) { ambiguous++; continue; }
    const trip = cands[0];
    paired++;
    if (DRY) {
      console.log(`  would pair round ${r.id} -> ${trip.name}`);
      continue;
    }
    await db.from("Round").update({ golfTripId: trip.id }).eq("id", r.id);
    const { data: upd } = await db
      .from("Upload")
      .update({ tripId: trip.id })
      .eq("roundId", r.id)
      .is("tripId", null)
      .select("id");
    clipsLinked += upd?.length ?? 0;
  }

  console.log("");
  console.log("=== DONE ===");
  console.log(`Paired rounds:    ${paired}`);
  console.log(`Clips linked:     ${clipsLinked}`);
  console.log(`Ambiguous (skip): ${ambiguous}`);
  console.log(`No matching trip: ${noMatch}`);
  console.log(`Already linked:   ${alreadyLinked}`);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
