// ============================================================
// RLS APPLY — BATCH 8. Golf-trip data (membership-gated).
// ============================================================
//
// Two SECURITY DEFINER helpers (bypass RLS, so no policy recursion):
//   is_trip_owner(trip_id)  -> caller is GolfTrip.createdBy
//   is_trip_member(trip_id) -> caller has an accepted GolfTripMember row
//                              for the trip, OR is the owner
//
// Verified client paths (Explore map, 2026-06-09). Membership model:
// GolfTripMember(tripId,userId,status) is the join table; status
// 'accepted' = active; trip creator is GolfTrip.createdBy. Every
// browser read of trip data is already filtered to the caller's
// accepted memberships, and the trip page hard-gates non-members.
//
//   GolfTrip          -> member/public read (isPublic trips stay
//                        viewable) + own-INSERT + owner UPDATE/DELETE.
//   GolfTripMember    -> read own rows + full roster when you're a
//                        member; INSERT own row or owner-invites;
//                        UPDATE/DELETE own (accept/decline) or owner.
//   GolfTripCourse    -> member read + owner write (creator manages
//                        the itinerary).
//   GolfTripNote      -> member read + member-authored INSERT + author
//                        DELETE.
//   GolfTripRyderTeam -> member read + owner write (creator assigns).
//   TripMessage       -> DEFAULT-DENY: only touched by the service_role
//                        messages API route, which bypasses RLS.
//
// DEFERRED (batch 9): TripGame — read cross-member (shareable game
// detail page /games/[id] + ProfileStats H2H read other users' shared
// game settlements). Needs a share/public read path before locking, or
// a deliberate public-read decision. Writes are already member-gated.
//
// Idempotent. Run:  node src/scripts/rls-apply-batch8-trips.mjs

import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL in environment (.env). Aborting.");
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

const HELPERS = `
CREATE OR REPLACE FUNCTION public.is_trip_owner(trip_id text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public."GolfTrip" t
    WHERE t.id = trip_id AND t."createdBy" = auth.uid()::text
  );
$fn$;

CREATE OR REPLACE FUNCTION public.is_trip_member(trip_id text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $fn$
  SELECT public.is_trip_owner(trip_id) OR EXISTS (
    SELECT 1 FROM public."GolfTripMember" m
    WHERE m."tripId" = trip_id
      AND m."userId" = auth.uid()::text
      AND m.status = 'accepted'
  );
$fn$;
`;

const PLAN = {
  GolfTrip: [
    ["GolfTrip_read", `FOR SELECT TO anon, authenticated USING (public.is_trip_member(id) OR "isPublic" = true)`],
    ["GolfTrip_insert_own", `FOR INSERT TO authenticated WITH CHECK ("createdBy" = auth.uid()::text)`],
    ["GolfTrip_owner_update", `FOR UPDATE TO authenticated USING ("createdBy" = auth.uid()::text) WITH CHECK ("createdBy" = auth.uid()::text)`],
    ["GolfTrip_owner_delete", `FOR DELETE TO authenticated USING ("createdBy" = auth.uid()::text)`],
  ],
  GolfTripMember: [
    ["GolfTripMember_read", `FOR SELECT TO authenticated USING (public.is_trip_member("tripId") OR "userId" = auth.uid()::text)`],
    ["GolfTripMember_insert", `FOR INSERT TO authenticated WITH CHECK ("userId" = auth.uid()::text OR public.is_trip_owner("tripId"))`],
    ["GolfTripMember_update", `FOR UPDATE TO authenticated USING ("userId" = auth.uid()::text OR public.is_trip_owner("tripId")) WITH CHECK ("userId" = auth.uid()::text OR public.is_trip_owner("tripId"))`],
    ["GolfTripMember_delete", `FOR DELETE TO authenticated USING ("userId" = auth.uid()::text OR public.is_trip_owner("tripId"))`],
  ],
  GolfTripCourse: [
    ["GolfTripCourse_read", `FOR SELECT TO authenticated USING (public.is_trip_member("tripId"))`],
    ["GolfTripCourse_owner_insert", `FOR INSERT TO authenticated WITH CHECK (public.is_trip_owner("tripId"))`],
    ["GolfTripCourse_owner_update", `FOR UPDATE TO authenticated USING (public.is_trip_owner("tripId")) WITH CHECK (public.is_trip_owner("tripId"))`],
    ["GolfTripCourse_owner_delete", `FOR DELETE TO authenticated USING (public.is_trip_owner("tripId"))`],
  ],
  GolfTripNote: [
    ["GolfTripNote_read", `FOR SELECT TO authenticated USING (public.is_trip_member("tripId"))`],
    ["GolfTripNote_insert", `FOR INSERT TO authenticated WITH CHECK ("userId" = auth.uid()::text AND public.is_trip_member("tripId"))`],
    ["GolfTripNote_author_delete", `FOR DELETE TO authenticated USING ("userId" = auth.uid()::text)`],
  ],
  GolfTripRyderTeam: [
    ["GolfTripRyderTeam_read", `FOR SELECT TO authenticated USING (public.is_trip_member("tripId"))`],
    ["GolfTripRyderTeam_owner_insert", `FOR INSERT TO authenticated WITH CHECK (public.is_trip_owner("tripId"))`],
    ["GolfTripRyderTeam_owner_update", `FOR UPDATE TO authenticated USING (public.is_trip_owner("tripId")) WITH CHECK (public.is_trip_owner("tripId"))`],
    ["GolfTripRyderTeam_owner_delete", `FOR DELETE TO authenticated USING (public.is_trip_owner("tripId"))`],
  ],
  TripMessage: [], // default-deny: only the service_role messages API touches it
};

async function main() {
  await client.connect();
  await client.query(HELPERS);
  console.log("  is_trip_owner() / is_trip_member() helpers created/updated.");
  for (const [table, policies] of Object.entries(PLAN)) {
    await client.query(`ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY;`);
    for (const [name, def] of policies) {
      await client.query(`DROP POLICY IF EXISTS "${name}" ON public."${table}";`);
      await client.query(`CREATE POLICY "${name}" ON public."${table}" ${def};`);
    }
    const { rows } = await client.query(
      `SELECT relrowsecurity AS on, (SELECT COUNT(*) FROM pg_policy WHERE polrelid = c.oid) AS policies
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname='public' AND c.relname=$1`,
      [table]
    );
    const r = rows[0];
    const note = policies.length === 0 ? "  (default-deny)" : "";
    console.log(`  ${table.padEnd(18)} RLS=${r.on ? "ON" : "OFF"}  policies=${r.policies}${note}`);
  }
  console.log("\nDone. Batch 8 applied.");
}

main()
  .catch((e) => { console.error("RLS apply failed:", e.message); process.exitCode = 1; })
  .finally(() => client.end());
