// ============================================================
// RLS APPLY — BATCH 2. Read-only reference tables.
// ============================================================
//
// Enables RLS + a public SELECT (USING true) on tables that the
// browser only READS; every write goes through service_role
// (API routes / seed scripts), which bypasses RLS. Net effect:
// public reads keep working, client roles can no longer write.
//
// Verified before writing:
//   - Badge              -> no client writes anywhere; reference data
//   - TripItinerary      -> writes only via service_role
//                           (api/itineraries/[id]/throw, api/trips/[id]/publicize)
//   - TripItineraryStop  -> writes only via service_role (api/trips/[id]/publicize)
//
// (CourseOfficialMedia was intentionally EXCLUDED: its POST route uses
//  the cookie-based authenticated client, so a read-only policy would
//  break course managers adding media. It needs an INSERT policy first.)
//
// Idempotent: drops+recreates each SELECT policy; ENABLE RLS is a no-op
// if already on. Re-runnable.
//
// Run:  node src/scripts/rls-apply-batch2-readonly-ref.mjs

import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const TABLES = ["Badge", "TripItinerary", "TripItineraryStop"];

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL in environment (.env). Aborting.");
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  for (const t of TABLES) {
    const pol = `${t}_read_all`;
    await client.query(`ALTER TABLE public."${t}" ENABLE ROW LEVEL SECURITY;`);
    await client.query(`DROP POLICY IF EXISTS "${pol}" ON public."${t}";`);
    await client.query(
      `CREATE POLICY "${pol}" ON public."${t}" FOR SELECT TO anon, authenticated USING (true);`
    );
    const { rows } = await client.query(
      `SELECT relrowsecurity AS on, (SELECT COUNT(*) FROM pg_policy WHERE polrelid = c.oid) AS policies
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname='public' AND c.relname=$1`,
      [t]
    );
    const r = rows[0];
    console.log(`  ${t.padEnd(20)} RLS=${r.on ? "ON" : "OFF"}  policies=${r.policies}  (public SELECT only; client writes denied)`);
  }
  console.log("\nDone. Batch 2 applied.");
}

main()
  .catch((e) => { console.error("RLS apply failed:", e.message); process.exitCode = 1; })
  .finally(() => client.end());
