// ============================================================
// RLS APPLY — BATCH 12. Course, Hole, TeeBox. (Final non-User tier.)
// ============================================================
//
// These three tables are public reference content (11,000+ courses).
// Everyone reads them; only signed-in users edit them (community
// scorecard editor, hole creation during upload, admin course editor).
// Verified by grep 2026-06-09.
//
// Course
//   - SELECT public (true) — course pages, feed, search all read anon.
//   - UPDATE: authenticated (scorecard image, contribute/official routes
//     use the cookie/authenticated client; admin editor too). USING(true)
//     because community edits aren't owner-scoped — any signed-in user can
//     enrich a course. Image/seed scripts + uploads/create counter bumps
//     run service_role and bypass.
//   - INSERT/DELETE: none → service_role only. The browser NEVER inserts
//     or deletes a course (standing "never insert new courses" rule); all
//     course creation is seed scripts running service_role.
//
// Hole
//   - SELECT public (true).
//   - INSERT/UPDATE/DELETE: authenticated. Holes are created on the fly
//     during upload (upload/page, BatchUpload, profile re-tag, EditClipSheet)
//     and edited in the scorecard editor + admin. contribute route deletes
//     holes via the authenticated cookie client. All behind login.
//
// TeeBox
//   - SELECT public (true).
//   - INSERT/UPDATE/DELETE: authenticated. Scorecard editor upserts tee
//     rows (needs INSERT+UPDATE for ON CONFLICT) and the admin editor
//     upserts/deletes them.
//
// Idempotent. Run:  node src/scripts/rls-apply-batch12-courses.mjs

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
  Course: [
    ["Course_public_read", `FOR SELECT USING (true)`],
    ["Course_auth_update", `FOR UPDATE TO authenticated USING (true) WITH CHECK (true)`],
  ],
  Hole: [
    ["Hole_public_read", `FOR SELECT USING (true)`],
    ["Hole_auth_insert", `FOR INSERT TO authenticated WITH CHECK (true)`],
    ["Hole_auth_update", `FOR UPDATE TO authenticated USING (true) WITH CHECK (true)`],
    ["Hole_auth_delete", `FOR DELETE TO authenticated USING (true)`],
  ],
  TeeBox: [
    ["TeeBox_public_read", `FOR SELECT USING (true)`],
    ["TeeBox_auth_insert", `FOR INSERT TO authenticated WITH CHECK (true)`],
    ["TeeBox_auth_update", `FOR UPDATE TO authenticated USING (true) WITH CHECK (true)`],
    ["TeeBox_auth_delete", `FOR DELETE TO authenticated USING (true)`],
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
    console.log(`  ${table.padEnd(8)} RLS=${r.on ? "ON" : "OFF"}  policies=${r.policies}`);
  }
  console.log("\nDone. Batch 12 applied.");
}

main()
  .catch((e) => { console.error("RLS apply failed:", e.message); process.exitCode = 1; })
  .finally(() => client.end());
