// ============================================================
// RLS APPLY — BATCH 13. User. (Final table — 41/41.)
// ============================================================
//
// User is special: RLS is row-level, not column-level, so a public
// SELECT policy alone would expose email + ghinNumber + pushSubscription
// to anon. Scoping (grep, 2026-06-09) confirmed the BROWSER never reads
// those three columns from public."User" — email comes from auth.users
// (data.user.email); the email-lookup queries in trips routes use the
// service-role client. So we combine:
//
//   1. RLS with a public SELECT policy USING(true) → every existing read
//      keeps working (no view, no repointing 40 read sites).
//   2. COLUMN-LEVEL privileges: REVOKE SELECT on the whole table from
//      anon+authenticated, then GRANT SELECT only on the safe columns.
//      email, ghinNumber, pushSubscription are then service-role only.
//
// Writes:
//   - INSERT: authenticated, own row only (signup/page.tsx inserts the
//     User row with id = the just-created auth user). auth/callback's
//     insert uses the service-role client and bypasses.
//   - UPDATE: own row OR admin (profile edit, avatar, reset flow,
//     push/subscribe route via the cookie client; admin moderation).
//     Counter bumps (uploads/create) run service_role and bypass.
//   - DELETE: none → service_role only (/api/user/delete uses admin).
//
// Note: the admin dashboard count queries were changed from select("*")
// to select("id") first, because select=* would hit the revoked columns
// and 403 under column privileges.
//
// Idempotent. Run:  node src/scripts/rls-apply-batch13-user.mjs

import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL in environment (.env). Aborting.");
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

// Everything EXCEPT email, ghinNumber, pushSubscription.
const SAFE_COLUMNS = [
  "id", "username", "displayName", "avatarUrl", "bio", "handicapIndex",
  "homeCourseId", "isVerified", "isAdmin", "uploadCount", "reputationScore",
  "createdAt", "updatedAt", "bannerUrl", "firstName", "lastName",
];

const POLICIES = [
  ["User_public_read", `FOR SELECT USING (true)`],
  ["User_self_insert", `FOR INSERT TO authenticated WITH CHECK (id = auth.uid()::text)`],
  ["User_self_update", `FOR UPDATE TO authenticated USING (id = auth.uid()::text OR public.is_admin()) WITH CHECK (id = auth.uid()::text OR public.is_admin())`],
];

async function main() {
  await client.connect();

  await client.query(`ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;`);
  for (const [name, def] of POLICIES) {
    await client.query(`DROP POLICY IF EXISTS "${name}" ON public."User";`);
    await client.query(`CREATE POLICY "${name}" ON public."User" ${def};`);
  }

  // Column-level hardening: hide email / ghinNumber / pushSubscription.
  await client.query(`REVOKE SELECT ON public."User" FROM anon, authenticated;`);
  const cols = SAFE_COLUMNS.map((c) => `"${c}"`).join(", ");
  await client.query(`GRANT SELECT (${cols}) ON public."User" TO anon, authenticated;`);

  const { rows } = await client.query(
    `SELECT relrowsecurity AS on, (SELECT COUNT(*) FROM pg_policy WHERE polrelid = c.oid) AS policies
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname='public' AND c.relname='User'`
  );
  const r = rows[0];
  console.log(`  User RLS=${r.on ? "ON" : "OFF"}  policies=${r.policies}`);

  // Show which columns anon/authenticated can now SELECT.
  const { rows: grants } = await client.query(
    `SELECT grantee, column_name FROM information_schema.column_privileges
     WHERE table_schema='public' AND table_name='User' AND privilege_type='SELECT'
       AND grantee IN ('anon','authenticated')
     ORDER BY grantee, column_name`
  );
  const byRole = {};
  for (const g of grants) (byRole[g.grantee] ??= []).push(g.column_name);
  for (const [role, list] of Object.entries(byRole)) {
    console.log(`  ${role} SELECT cols: ${list.join(", ")}`);
  }
  console.log("\nDone. Batch 13 applied. 41/41 tables now have RLS.");
}

main()
  .catch((e) => { console.error("RLS apply failed:", e.message); process.exitCode = 1; })
  .finally(() => client.end());
