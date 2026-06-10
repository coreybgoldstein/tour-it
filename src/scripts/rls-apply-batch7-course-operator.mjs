// ============================================================
// RLS APPLY — BATCH 7. Course-operator layer (manager-gated writes).
// ============================================================
//
// Creates public.is_course_manager(course_id) — true when the caller is
// a Tour It admin OR holds a CourseManager row for that course. Mirrors
// src/lib/courseManagerAuth.ts (existence check, no status column).
//
// Verified client paths (grep'd 2026-06-09):
//
//   CourseStaff        -> public list route returns only isPublic rows
//                         (anon/authenticated cookie client). The /manage
//                         page reads ALL rows (incl. non-public) directly
//                         via the browser client as the manager. All
//                         writes go through manager-gated API routes
//                         (authenticated role + requireCourseManager).
//                         -> public read (isPublic=true) + manager ALL.
//   CourseOfficialMedia-> fully public list ("From the course" block).
//                         Writes via manager-gated API routes.
//                         -> public read (true) + manager ALL.
//
// Idempotent. Run:  node src/scripts/rls-apply-batch7-course-operator.mjs

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
CREATE OR REPLACE FUNCTION public.is_course_manager(course_id text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $fn$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public."CourseManager" cm
    WHERE cm."courseId" = course_id AND cm."userId" = auth.uid()::text
  );
$fn$;
`;

const PLAN = {
  CourseStaff: [
    ["CourseStaff_public_read", `FOR SELECT TO anon, authenticated USING ("isPublic" = true)`],
    ["CourseStaff_manager_all", `FOR ALL TO authenticated USING (public.is_course_manager("courseId")) WITH CHECK (public.is_course_manager("courseId"))`],
  ],
  CourseOfficialMedia: [
    ["CourseOfficialMedia_public_read", `FOR SELECT TO anon, authenticated USING (true)`],
    ["CourseOfficialMedia_manager_all", `FOR ALL TO authenticated USING (public.is_course_manager("courseId")) WITH CHECK (public.is_course_manager("courseId"))`],
  ],
};

async function main() {
  await client.connect();
  await client.query(HELPER);
  console.log("  is_course_manager() helper created/updated.");
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
    console.log(`  ${table.padEnd(20)} RLS=${r.on ? "ON" : "OFF"}  policies=${r.policies}`);
  }
  console.log("\nDone. Batch 7 applied.");
}

main()
  .catch((e) => { console.error("RLS apply failed:", e.message); process.exitCode = 1; })
  .finally(() => client.end());
