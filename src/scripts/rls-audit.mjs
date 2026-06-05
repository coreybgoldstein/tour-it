// ============================================================
// RLS AUDIT — READ ONLY. This script changes NOTHING.
// ============================================================
//
// Tour It's browser bundle talks to Postgres directly through Supabase
// PostgREST using the ANON key. If a table has Row Level Security
// DISABLED, the anon key can read (and often write) every row in it —
// stakes, emails, private trip data, the lot. This script surveys the
// current state so we know exactly what's exposed before drafting +
// applying policies (see prisma/rls-policies.draft.sql).
//
// It does three read-only things:
//   1. Lists every table in `public` with RLS enabled/forced + policy count
//   2. Dumps each existing policy (name, command, roles, expression)
//   3. Sanity-checks the core assumption behind the draft policies:
//      that public."User".id equals the Supabase auth uid (auth.users.id)
//
// Run:  node src/scripts/rls-audit.mjs
// Needs DATABASE_URL in .env (the same one Prisma uses). Uses a direct
// pg connection because pg_catalog / RLS metadata isn't reachable through
// the PostgREST client.

import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL in environment (.env). Aborting.");
  process.exit(1);
}

// Supabase pooled/direct URLs require SSL; allow the self-signed chain.
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

async function main() {
  await client.connect();

  // ── 1. RLS status per table ────────────────────────────────────────
  const { rows: tables } = await client.query(`
    SELECT
      c.relname              AS table,
      c.relrowsecurity       AS rls_enabled,
      c.relforcerowsecurity  AS rls_forced,
      COALESCE(p.cnt, 0)     AS policy_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN (
      SELECT polrelid, COUNT(*) AS cnt FROM pg_policy GROUP BY polrelid
    ) p ON p.polrelid = c.oid
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relrowsecurity ASC, c.relname ASC;
  `);

  console.log("\n=== RLS STATUS (public schema) ===\n");
  let exposed = 0;
  for (const t of tables) {
    const on = t.rls_enabled;
    const tag = on ? GREEN("RLS ON ") : RED("RLS OFF");
    const forced = t.rls_forced ? " (forced)" : "";
    const pol = `${t.policy_count} polic${t.policy_count === 1 ? "y" : "ies"}`;
    // A table with RLS on but zero policies denies all anon access (safe but
    // may break the app); RLS off = wide open to the anon key.
    const warn = !on ? RED("  <-- anon can read/write everything") :
      (t.policy_count === 0 ? DIM("  (RLS on, no policies -> anon denied)") : "");
    if (!on) exposed++;
    console.log(`  ${tag}${forced.padEnd(9)} ${String(t.table).padEnd(28)} ${pol}${warn}`);
  }
  console.log(`\n  ${exposed} of ${tables.length} tables have RLS DISABLED.`);

  // ── 2. Existing policies ───────────────────────────────────────────
  const { rows: policies } = await client.query(`
    SELECT
      schemaname, tablename, policyname,
      cmd, roles,
      qual        AS using_expr,
      with_check  AS check_expr
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);

  console.log("\n=== EXISTING POLICIES ===\n");
  if (policies.length === 0) {
    console.log("  (none)");
  } else {
    for (const p of policies) {
      console.log(`  ${p.tablename}.${p.policyname}`);
      console.log(`      cmd=${p.cmd}  roles=${p.roles}`);
      if (p.using_expr) console.log(`      USING ${p.using_expr}`);
      if (p.check_expr) console.log(`      WITH CHECK ${p.check_expr}`);
    }
  }

  // ── 3. User.id == auth.uid assumption check ────────────────────────
  // The draft policies key ownership on auth.uid()::text = "userId".
  // That only works if public."User".id is the Supabase auth uid. Spot
  // check: how many User rows have an id that exists in auth.users?
  console.log("\n=== ASSUMPTION CHECK: User.id == auth.users.id ===\n");
  try {
    const { rows } = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM public."User") AS total_users,
        (SELECT COUNT(*) FROM public."User" u
           WHERE EXISTS (SELECT 1 FROM auth.users a WHERE a.id::text = u.id)) AS matched
    `);
    const { total_users, matched } = rows[0];
    const ok = Number(matched) === Number(total_users);
    console.log(`  ${matched}/${total_users} User rows map to an auth.users id ` +
      (ok ? GREEN("(assumption holds)") : RED("(MISMATCH — review before applying owner policies)")));
  } catch (e) {
    console.log(DIM(`  Could not read auth.users (${e.message}). Run as a role that can see the auth schema.`));
  }

  console.log("\nDone. This was read-only. Draft policies: prisma/rls-policies.draft.sql\n");
}

main()
  .catch((e) => { console.error("RLS audit failed:", e.message); process.exitCode = 1; })
  .finally(() => client.end());
