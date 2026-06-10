// ============================================================
// RLS APPLY — BATCH 6. Admin / moderation / search-analytics.
// ============================================================
//
// Verified client paths (grep'd 2026-06-09):
//
//   ModerationReport -> client INSERT via the cookie (authenticated)
//                       client with reportedById = me.id (feed/course/
//                       hole/profile/home report sheets). Admin pages +
//                       TourItTopBar badge read PENDING counts via the
//                       authenticated browser client; admin/page updates
//                       status. Deletes are service_role (user/delete).
//                       -> own-INSERT + admin SELECT + admin UPDATE.
//   CourseClaim      -> client INSERT via authenticated with userId =
//                       user.id (claim route). The same route reads the
//                       user's own existing claim. Admin verify/reject
//                       routes (authenticated + requireAdmin) read +
//                       UPDATE status; TourItTopBar reads PENDING count.
//                       -> own-INSERT + owner/admin SELECT + admin UPDATE.
//   CourseManager    -> client SELECT eq(userId = user.id) for own-
//                       managership checks (course page, manage page,
//                       courseManagerAuth). INSERT only from the admin
//                       verify route (authenticated + requireAdmin).
//                       Deletes service_role. -> owner/admin SELECT +
//                       admin INSERT.
//   SearchLog        -> INSERT from api/ai-search (anon-key server
//                       client). Admin dashboard reads counts/rows.
//                       -> anon+auth INSERT + admin SELECT.
//   SearchClick      -> INSERT from api/ai-search/click (cookie client,
//                       user may be logged-out -> userId null). Admin
//                       dashboard reads counts. -> anon+auth INSERT +
//                       admin SELECT.
//   TripPlannerCache -> read/upsert from api/trip-planner/recommend.
//                       That route was just switched to service_role
//                       (same commit), and api/tour/search already uses
//                       service_role, so all writes bypass RLS. Admin
//                       dashboard reads it. -> admin SELECT only
//                       (default-deny for everyone else).
//
// DEFERRED to batch 7 (need an is_course_manager(courseId) helper —
// their writes come through the authenticated role gated only by the
// server-side requireCourseManager check):
//   CourseStaff, CourseOfficialMedia
//
// Idempotent. Run:  node src/scripts/rls-apply-batch6-admin-mod.mjs

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
  ModerationReport: [
    ["ModerationReport_insert_own", `FOR INSERT TO authenticated WITH CHECK ("reportedById" = auth.uid()::text)`],
    ["ModerationReport_admin_read", `FOR SELECT TO authenticated USING (public.is_admin())`],
    ["ModerationReport_admin_update", `FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())`],
  ],
  CourseClaim: [
    ["CourseClaim_insert_own", `FOR INSERT TO authenticated WITH CHECK ("userId" = auth.uid()::text)`],
    ["CourseClaim_owner_read", `FOR SELECT TO authenticated USING ("userId" = auth.uid()::text OR public.is_admin())`],
    ["CourseClaim_admin_update", `FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())`],
  ],
  CourseManager: [
    ["CourseManager_owner_read", `FOR SELECT TO authenticated USING ("userId" = auth.uid()::text OR public.is_admin())`],
    ["CourseManager_admin_insert", `FOR INSERT TO authenticated WITH CHECK (public.is_admin())`],
  ],
  SearchLog: [
    ["SearchLog_insert_any", `FOR INSERT TO anon, authenticated WITH CHECK (true)`],
    ["SearchLog_admin_read", `FOR SELECT TO authenticated USING (public.is_admin())`],
  ],
  SearchClick: [
    ["SearchClick_insert_any", `FOR INSERT TO anon, authenticated WITH CHECK (true)`],
    ["SearchClick_admin_read", `FOR SELECT TO authenticated USING (public.is_admin())`],
  ],
  TripPlannerCache: [
    ["TripPlannerCache_admin_read", `FOR SELECT TO authenticated USING (public.is_admin())`],
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
  console.log("\nDone. Batch 6 applied.");
}

main()
  .catch((e) => { console.error("RLS apply failed:", e.message); process.exitCode = 1; })
  .finally(() => client.end());
