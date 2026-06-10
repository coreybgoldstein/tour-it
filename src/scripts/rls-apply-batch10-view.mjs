// ============================================================
// RLS APPLY — BATCH 10. View (admin-read only).
// ============================================================
//
// The View table has NO insert/update path anywhere in src/ (grep'd
// 2026-06-09): the only references are the admin dashboard count read
// (authenticated admin browser client) and service_role delete-cascade
// in api/user/delete + scripts. viewCount columns live on Course/Upload,
// not driven by this table. So: RLS on, admin SELECT only, everything
// else default-deny. service_role keeps working for the delete cascade.
//
// Idempotent. Run:  node src/scripts/rls-apply-batch10-view.mjs

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
  View: [
    ["View_admin_read", `FOR SELECT TO authenticated USING (public.is_admin())`],
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
  console.log("\nDone. Batch 10 applied.");
}

main()
  .catch((e) => { console.error("RLS apply failed:", e.message); process.exitCode = 1; })
  .finally(() => client.end());
