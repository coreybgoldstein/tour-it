// ============================================================
// RLS APPLY — BATCH 11. Upload, Notification, UploadTag.
// ============================================================
//
// The cross-user write paths on these three tables were all moved to
// service_role server routes first (comments/sync, uploads/sync,
// follow/sync, trips/decline + notify-members, uploads/hero-approve,
// admin/course-request/respond, likes/toggle). After that migration the
// ONLY client writes left are owner-scoped (or admin), so we can turn on
// owner-write RLS without breaking the app. Verified by grep 2026-06-09.
//
// Upload
//   - SELECT public (true) — clips are public content; logged-out feed
//     browsing uses the anon role, and the app filters moderationStatus
//     itself. No TO clause so anon + authenticated both read.
//   - INSERT: none → service_role only. The browser no longer inserts
//     Upload directly; upload + batch flows POST /api/uploads/create.
//   - UPDATE/DELETE: row owner ("userId" = auth.uid()) OR admin (the
//     admin dashboard moderates clips with the authenticated browser
//     client). All counter bumps run service_role and bypass RLS.
//
// Notification
//   - SELECT: own rows OR admin.
//   - UPDATE: own rows (mark-as-read).  DELETE: own rows.
//   - INSERT: none → service_role only. Every notification is inherently
//     a cross-user write and now flows through a server route.
//
// UploadTag
//   - SELECT public (true) — tags drive the "uploaded by @x" attribution
//     chip shown on every clip surface.
//   - INSERT/DELETE: the upload owner manages tags on their own clip
//     (is_upload_owner). The tagged user can also remove their own tag.
//   - UPDATE: upload owner OR the tagged user (the tagged user flips
//     `approved` to accept/deny a hero tag).
//   - Hero-tag inserts from the upload flow run service_role and bypass.
//
// Idempotent. Run:  node src/scripts/rls-apply-batch11-engagement.mjs

import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL in environment (.env). Aborting.");
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

const HELPER = `
CREATE OR REPLACE FUNCTION public.is_upload_owner(upload_id text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public."Upload" u
    WHERE u.id = upload_id AND u."userId" = auth.uid()::text
  );
$fn$;
`;

const PLAN = {
  Upload: [
    ["Upload_public_read", `FOR SELECT USING (true)`],
    ["Upload_owner_update", `FOR UPDATE TO authenticated USING ("userId" = auth.uid()::text OR public.is_admin()) WITH CHECK ("userId" = auth.uid()::text OR public.is_admin())`],
    ["Upload_owner_delete", `FOR DELETE TO authenticated USING ("userId" = auth.uid()::text OR public.is_admin())`],
  ],
  Notification: [
    ["Notification_own_read", `FOR SELECT TO authenticated USING ("userId" = auth.uid()::text OR public.is_admin())`],
    ["Notification_own_update", `FOR UPDATE TO authenticated USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text)`],
    ["Notification_own_delete", `FOR DELETE TO authenticated USING ("userId" = auth.uid()::text)`],
  ],
  UploadTag: [
    ["UploadTag_public_read", `FOR SELECT USING (true)`],
    ["UploadTag_owner_insert", `FOR INSERT TO authenticated WITH CHECK (public.is_upload_owner("uploadId"))`],
    ["UploadTag_update", `FOR UPDATE TO authenticated USING (public.is_upload_owner("uploadId") OR "userId" = auth.uid()::text) WITH CHECK (public.is_upload_owner("uploadId") OR "userId" = auth.uid()::text)`],
    ["UploadTag_delete", `FOR DELETE TO authenticated USING (public.is_upload_owner("uploadId") OR "userId" = auth.uid()::text)`],
  ],
};

async function main() {
  await client.connect();
  await client.query(HELPER);
  console.log("Helper is_upload_owner(text) created.\n");
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
  console.log("\nDone. Batch 11 applied.");
}

main()
  .catch((e) => { console.error("RLS apply failed:", e.message); process.exitCode = 1; })
  .finally(() => client.end());
