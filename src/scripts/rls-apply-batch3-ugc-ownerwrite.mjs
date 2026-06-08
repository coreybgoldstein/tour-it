// ============================================================
// RLS APPLY — BATCH 3. UGC owner-write (the safe Tier-2 subset).
// ============================================================
//
// Public-read + owner-write on the engagement tables whose client
// writes are ALL keyed to the current auth uid, verified by reading
// every write path:
//
//   Comment      -> client insert sets userId:user.id; update/delete
//                   filter .eq(userId). Public read. (commentCount lives
//                   on Upload, which is intentionally left OPEN this batch
//                   so cross-user counter bumps keep working.)
//   Like         -> never written by the browser directly; all writes go
//                   through api/likes/toggle using service_role (bypasses
//                   RLS). Owner-write policy is belt-and-suspenders.
//   Follow       -> client insert sets followerId to current user;
//                   delete filters .eq(followerId). Public read (counts).
//   UploadPhoto  -> no browser writes at all (created via api/uploads/create
//                   service_role). Public read.
//   Save         -> private bucket list. useSave sets/filters userId =
//                   current user; profile read is gated `if (owner)`.
//                   Admin dashboard counts all saves -> add admin-read.
//
// DELIBERATELY EXCLUDED (need more work first, will break otherwise):
//   Upload    -> comment/like handlers bump commentCount/likeCount/rankScore
//                on OTHER users' rows from the browser; strict owner-write
//                blocks that. Needs a SECURITY DEFINER counter RPC (or move
//                those bumps server-side) + admin moderation policy + an
//                "APPROVED or own" read with an admin-read carve-out.
//   UploadTag -> uploader inserts tags client-side during upload; draft
//                wrongly assumed tag creation is server-side. Needs an
//                uploader-insert policy.
//   View      -> admin dashboard reads it client-side; needs admin-read
//                alongside the insert-any policy.
//
// Idempotent: drops+recreates policies; ENABLE RLS is a no-op if already on.
//
// Run:  node src/scripts/rls-apply-batch3-ugc-ownerwrite.mjs

import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL in environment (.env). Aborting.");
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

// Reusable admin predicate (SECURITY DEFINER so it can read User.isAdmin
// even after User gets RLS later). Read-only; safe to create now.
const IS_ADMIN_FN = `
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public."User" u WHERE u.id = auth.uid()::text AND u."isAdmin" = true);
$$;`;

// table -> ordered list of [policyName, sql-after-"CREATE POLICY name ON table"]
const PLAN = {
  Comment: [
    ["Comment_read_all", `FOR SELECT TO anon, authenticated USING (true)`],
    ["Comment_owner_write", `FOR ALL TO authenticated USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text)`],
  ],
  Like: [
    ["Like_read_all", `FOR SELECT TO anon, authenticated USING (true)`],
    ["Like_owner_write", `FOR ALL TO authenticated USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text)`],
  ],
  Follow: [
    ["Follow_read_all", `FOR SELECT TO anon, authenticated USING (true)`],
    ["Follow_owner_write", `FOR ALL TO authenticated USING ("followerId" = auth.uid()::text) WITH CHECK ("followerId" = auth.uid()::text)`],
  ],
  UploadPhoto: [
    ["UploadPhoto_read_all", `FOR SELECT TO anon, authenticated USING (true)`],
    ["UploadPhoto_owner_write", `FOR ALL TO authenticated USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text)`],
  ],
  Save: [
    ["Save_owner_all", `FOR ALL TO authenticated USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text)`],
    ["Save_admin_read", `FOR SELECT TO authenticated USING (public.is_admin())`],
  ],
};

async function main() {
  await client.connect();
  await client.query(IS_ADMIN_FN);
  console.log("  helper public.is_admin() created/updated\n");

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
    console.log(`  ${table.padEnd(14)} RLS=${r.on ? "ON" : "OFF"}  policies=${r.policies}`);
  }
  console.log("\nDone. Batch 3 applied.");
}

main()
  .catch((e) => { console.error("RLS apply failed:", e.message); process.exitCode = 1; })
  .finally(() => client.end());
