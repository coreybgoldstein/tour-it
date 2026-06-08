// ============================================================
// RLS APPLY — SAFE BATCH 1. Server-only tables, default-deny.
// ============================================================
//
// Enables Row Level Security with NO client policies on the three
// tables that are ONLY ever touched by service_role (API routes +
// admin delete scripts). service_role bypasses RLS, so those server
// paths keep working; the browser's anon/authenticated key is denied.
//
// Verified zero browser (anon-key) access before writing this:
//   - Referral                 -> only api/referral/*, api/invites/me,
//                                 api/user/delete (all serviceDb / admin)
//   - CourseFieldContribution  -> only api/user/delete + delete-test-users
//   - LeaderboardSnapshot      -> only api/user/delete + delete-test-users
//
// Idempotent: ENABLE RLS is a no-op if already enabled. Re-runnable.
//
// Run:  node src/scripts/rls-apply-safe-batch.mjs
// Needs DATABASE_URL in .env.

import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const TABLES = ["Referral", "CourseFieldContribution", "LeaderboardSnapshot"];

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL in environment (.env). Aborting.");
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  for (const t of TABLES) {
    await client.query(`ALTER TABLE public."${t}" ENABLE ROW LEVEL SECURITY;`);
    const { rows } = await client.query(
      `SELECT relrowsecurity AS on, (SELECT COUNT(*) FROM pg_policy WHERE polrelid = c.oid) AS policies
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname='public' AND c.relname=$1`,
      [t]
    );
    const r = rows[0];
    console.log(`  ${t.padEnd(26)} RLS=${r.on ? "ON" : "OFF"}  policies=${r.policies}  (0 policies => client roles denied, service_role bypasses)`);
  }
  console.log("\nDone. Safe batch applied.");
}

main()
  .catch((e) => { console.error("RLS apply failed:", e.message); process.exitCode = 1; })
  .finally(() => client.end());
