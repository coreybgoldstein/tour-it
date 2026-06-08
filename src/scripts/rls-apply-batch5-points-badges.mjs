// ============================================================
// RLS APPLY — BATCH 5. Points + badges (after service_role switch).
// ============================================================
//
// Prereq (shipped in the same commit): awardPoints.ts, awardBadge.ts and
// checkBadges.ts now use createAdminClient() (service_role) instead of the
// cookie-based client, so their cross-user writes (e.g. like-received
// points/badges land on the clip owner's row) bypass RLS. All their callers
// are authenticated server routes; cron/streak has no user context and now
// also works because service_role needs no auth.uid.
//
//   UserProgression  -> PUBLIC read (leaderboards, profile rank, feed rank
//                       chips read it by userId) + owner UPDATE (onboarding
//                       reset edits the user's own row; RLS also constrains
//                       it to own regardless of the client filter). New rows
//                       come from service_role.
//   UserPointsLedger -> owner-read only (private history; ProgressionTracker
//                       reads the user's own ledger). All writes service_role.
//   UserBadge        -> PUBLIC read (badges render on every profile). All
//                       writes via awardBadge service_role.
//
// Idempotent. Run:  node src/scripts/rls-apply-batch5-points-badges.mjs

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
  UserProgression: [
    ["UserProgression_read_all", `FOR SELECT TO anon, authenticated USING (true)`],
    ["UserProgression_owner_update", `FOR UPDATE TO authenticated USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text)`],
  ],
  UserPointsLedger: [
    ["UserPointsLedger_owner_read", `FOR SELECT TO authenticated USING ("userId" = auth.uid()::text)`],
  ],
  UserBadge: [
    ["UserBadge_read_all", `FOR SELECT TO anon, authenticated USING (true)`],
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
  console.log("\nDone. Batch 5 applied.");
}

main()
  .catch((e) => { console.error("RLS apply failed:", e.message); process.exitCode = 1; })
  .finally(() => client.end());
