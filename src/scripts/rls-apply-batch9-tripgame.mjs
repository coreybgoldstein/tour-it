// ============================================================
// RLS APPLY — BATCH 9. TripGame (public-read, member-gated writes).
// ============================================================
//
// TripGame is the only trip table read by NON-members:
//   - /games/[id] is a shareable game-detail page (reads by id)
//   - ProfileStats H2H reads other users' shared game settlements
// So SELECT stays public-read to preserve sharing. Game rows hold
// recreational golf scores/settlements/player handles — shared by
// design via shareText + the share link. Writes are locked:
//   - INSERT: the game creator, who must be a trip member
//   - UPDATE/DELETE: the game creator OR the trip owner
// (Server score-save + game-create routes use service_role and bypass
// these anyway; the policies cover the browser create/update/delete in
// trips/[id]/page.tsx, CreateGameSheet.tsx, tee-up/page.tsx.)
//
// Relies on is_trip_owner()/is_trip_member() from batch 8.
//
// Idempotent. Run:  node src/scripts/rls-apply-batch9-tripgame.mjs

import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL in environment (.env). Aborting.");
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

const PLAN = {
  TripGame: [
    ["TripGame_read_all", `FOR SELECT TO anon, authenticated USING (true)`],
    ["TripGame_member_insert", `FOR INSERT TO authenticated WITH CHECK ("createdBy" = auth.uid()::text AND public.is_trip_member("tripId"))`],
    ["TripGame_creator_update", `FOR UPDATE TO authenticated USING ("createdBy" = auth.uid()::text OR public.is_trip_owner("tripId")) WITH CHECK ("createdBy" = auth.uid()::text OR public.is_trip_owner("tripId"))`],
    ["TripGame_creator_delete", `FOR DELETE TO authenticated USING ("createdBy" = auth.uid()::text OR public.is_trip_owner("tripId"))`],
  ],
};

async function main() {
  await client.connect();
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
    console.log(`  ${table.padEnd(18)} RLS=${r.on ? "ON" : "OFF"}  policies=${r.policies}`);
  }
  console.log("\nDone. Batch 9 applied.");
}

main()
  .catch((e) => { console.error("RLS apply failed:", e.message); process.exitCode = 1; })
  .finally(() => client.end());
