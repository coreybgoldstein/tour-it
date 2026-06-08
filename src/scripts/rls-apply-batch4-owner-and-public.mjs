// ============================================================
// RLS APPLY — BATCH 4. Owner-scoped + one public-read table.
// ============================================================
//
// All verified to have NO cross-user writes from the browser:
//
//   Round              -> PUBLIC read (profiles + ProfileStats H2H show
//                         other users' rounds; preserves today's behavior)
//                         + owner-write. Inserts come from service_role
//                         (api/rounds/score-save, api/uploads/create);
//                         client delete/update touch the user's own rounds
//                         and the owner policy enforces that.
//   CourseRequest      -> owner-write (add-course + tour both insert
//                         userId:user.id) + admin-read (admin reviews all).
//   CourseContribution -> owner-all. Written client-side only in the
//                         upload flow with userId:user.id; read only by
//                         checkBadges for the uploader themselves.
//   RewardsWaitlist    -> default-deny. No browser access at all (only
//                         service_role api/user/delete + delete script).
//
// DEFERRED (cross-user writes via the cookie-based awardPoints/awardBadge,
// which write the RECIPIENT's row — e.g. like-received points/badges go to
// the clip owner, not the actor). These need awardPoints/awardBadge moved
// to service_role first, then they can be locked:
//   UserProgression, UserPointsLedger, UserBadge
//
// Idempotent. Run:  node src/scripts/rls-apply-batch4-owner-and-public.mjs

import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL in environment (.env). Aborting.");
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

// table -> [policyName, definition-after-"CREATE POLICY name ON table"][]
// RewardsWaitlist intentionally has zero policies (default-deny).
const PLAN = {
  Round: [
    ["Round_read_all", `FOR SELECT TO anon, authenticated USING (true)`],
    ["Round_owner_write", `FOR ALL TO authenticated USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text)`],
  ],
  CourseRequest: [
    ["CourseRequest_owner_write", `FOR ALL TO authenticated USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text)`],
    ["CourseRequest_admin_read", `FOR SELECT TO authenticated USING (public.is_admin())`],
  ],
  CourseContribution: [
    ["CourseContribution_owner_all", `FOR ALL TO authenticated USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text)`],
  ],
  RewardsWaitlist: [], // default-deny: RLS on, no client policies
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
    const note = policies.length === 0 ? "  (default-deny)" : "";
    console.log(`  ${table.padEnd(20)} RLS=${r.on ? "ON" : "OFF"}  policies=${r.policies}${note}`);
  }
  console.log("\nDone. Batch 4 applied.");
}

main()
  .catch((e) => { console.error("RLS apply failed:", e.message); process.exitCode = 1; })
  .finally(() => client.end());
