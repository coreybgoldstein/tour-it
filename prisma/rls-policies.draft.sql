-- ============================================================================
-- Tour It — DRAFT Row Level Security policies.   *** DO NOT APPLY AS-IS ***
-- ============================================================================
--
-- Run src/scripts/rls-audit.mjs first to see today's state. Most public tables
-- currently have RLS DISABLED, which means the browser's ANON key can read
-- (and in many cases write) every row — including stakes, emails, and private
-- trip data.
--
-- WHY THIS IS DANGEROUS TO APPLY BLIND:
--   The web client reads through the anon/authenticated PostgREST roles. The
--   moment you `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, every read those
--   roles do is DENIED until a matching SELECT policy exists. Enable a table
--   without first shipping a correct SELECT policy and that surface goes blank
--   in production instantly. Roll out ONE table at a time, behind testing.
--   (The SUPABASE service_role key bypasses RLS, so server-side routes that
--   use it keep working regardless — only client-side reads are gated.)
--
-- KEY ASSUMPTION (verify with the audit script's assumption check):
--   public."User".id stores the Supabase auth uid for real users (set in
--   src/app/auth/callback/route.ts). So ownership is `auth.uid()::text = "userId"`.
--   auth.uid() is a uuid; our id columns are text → always cast.
--
-- COLUMN-LEVEL CAVEAT:
--   RLS gates ROWS, not COLUMNS. "User" rows must be world-readable for
--   profiles to render, but that also exposes User.email/ghinNumber to anyone.
--   Fix that with a public view (see the User section) — not RLS alone.
--
-- ============================================================================

-- ---------------------------------------------------------------------------
-- HARD GUARD: forces a conscious decision before this file can run.
-- Delete this block only when you actually intend to apply (table by table).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  RAISE EXCEPTION
    'rls-policies.draft.sql is a DRAFT and must not be applied wholesale. '
    'Review each section, then remove this guard and apply one table at a time.';
END $$;

-- ---------------------------------------------------------------------------
-- Helper: trip membership test as SECURITY DEFINER so policies on the trip
-- tables can ask "is the caller a member of this trip?" without triggering
-- recursive RLS on GolfTripMember itself.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_trip_member(trip_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."GolfTripMember" m
    WHERE m."tripId" = trip_id
      AND m."userId" = auth.uid()::text
      AND m.status = 'accepted'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."User" u
    WHERE u.id = auth.uid()::text AND u."isAdmin" = true
  );
$$;

-- ===========================================================================
-- TIER 1 — PUBLIC REFERENCE / CONTENT (anyone may SELECT; no client writes;
-- all mutation goes through service-role server routes).
-- ===========================================================================
-- Course, Hole, TeeBox, Badge, TripItinerary, TripItineraryStop
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Course','Hole','TeeBox','Badge','TripItinerary','TripItineraryStop'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true);',
      t || '_read_all', t);
    -- No INSERT/UPDATE/DELETE policy → client roles cannot write; service
    -- role (seeder scripts, API routes) bypasses RLS and still can.
  END LOOP;
END $$;

-- Operator content shown publicly only when flagged public.
ALTER TABLE public."CourseStaff" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CourseStaff_read_public" ON public."CourseStaff"
  FOR SELECT TO anon, authenticated USING ("isPublic" = true);

ALTER TABLE public."CourseOfficialMedia" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CourseOfficialMedia_read_all" ON public."CourseOfficialMedia"
  FOR SELECT TO anon, authenticated USING (true);

-- ===========================================================================
-- TIER 2 — PUBLIC-READ UGC, OWNER-WRITE.
-- Approved uploads are visible to everyone; the owner also sees their own
-- pending/rejected. Engagement rows are world-readable (counts/are-you-liked
-- checks) but only the owner can insert/delete their own.
-- ===========================================================================
ALTER TABLE public."Upload" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Upload_read_approved_or_own" ON public."Upload"
  FOR SELECT TO anon, authenticated
  USING ("moderationStatus" = 'APPROVED' OR "userId" = auth.uid()::text);
CREATE POLICY "Upload_owner_write" ON public."Upload"
  FOR ALL TO authenticated
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

ALTER TABLE public."UploadPhoto" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "UploadPhoto_read_all" ON public."UploadPhoto"
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "UploadPhoto_owner_write" ON public."UploadPhoto"
  FOR ALL TO authenticated
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

ALTER TABLE public."Comment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comment_read_all" ON public."Comment"
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Comment_owner_write" ON public."Comment"
  FOR ALL TO authenticated
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

ALTER TABLE public."Like" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Like_read_all" ON public."Like"
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Like_owner_write" ON public."Like"
  FOR ALL TO authenticated
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

ALTER TABLE public."Save" ENABLE ROW LEVEL SECURITY;
-- Saves are private to the user (your bucket list is yours).
CREATE POLICY "Save_owner_all" ON public."Save"
  FOR ALL TO authenticated
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

ALTER TABLE public."Follow" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follow_read_all" ON public."Follow"
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Follow_owner_write" ON public."Follow"
  FOR ALL TO authenticated
  USING ("followerId" = auth.uid()::text) WITH CHECK ("followerId" = auth.uid()::text);

ALTER TABLE public."UploadTag" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "UploadTag_read_all" ON public."UploadTag"
  FOR SELECT TO anon, authenticated USING (true);
-- The tagged user can approve/decline their own tag; tag creation happens
-- server-side during upload (service role), so no client INSERT policy.
CREATE POLICY "UploadTag_subject_update" ON public."UploadTag"
  FOR UPDATE TO authenticated
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

-- View rows are write-mostly analytics; let anyone insert a view, nobody read.
ALTER TABLE public."View" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View_insert_any" ON public."View"
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ===========================================================================
-- TIER 3 — USER PROFILES.
-- Rows must be readable for profiles to render, but email/ghinNumber are
-- sensitive. RECOMMENDED: keep "User" itself owner-read only, and expose a
-- public view with just the safe columns. Point the client at the view for
-- profile reads. (Sketch below — wire the client over before enabling.)
-- ===========================================================================
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User_read_own" ON public."User"
  FOR SELECT TO authenticated USING (id = auth.uid()::text);
CREATE POLICY "User_update_own" ON public."User"
  FOR UPDATE TO authenticated
  USING (id = auth.uid()::text) WITH CHECK (id = auth.uid()::text);

-- Safe public projection — no email, ghinNumber, pushSubscription.
CREATE OR REPLACE VIEW public.user_public AS
  SELECT id, username, "displayName", "avatarUrl", "bannerUrl", bio,
         "handicapIndex", "homeCourseId", "isVerified", "uploadCount",
         "reputationScore", "createdAt"
  FROM public."User";
GRANT SELECT ON public.user_public TO anon, authenticated;
-- NOTE: switch profile/feed/comment author lookups in the client from
-- .from("User") to .from("user_public") before enabling User RLS, or those
-- surfaces break.

-- ===========================================================================
-- TIER 4 — STRICTLY PRIVATE TO THE OWNER (no public read at all).
-- ===========================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Round','Notification','RewardsWaitlist','CourseRequest',
    'UserPointsLedger','CourseContribution'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);',
      t || '_owner_all', t);
  END LOOP;
END $$;

-- Progression + badges: owner-write, but world-readable so leaderboards and
-- other players' profiles can show rank/points/badges.
ALTER TABLE public."UserProgression" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "UserProgression_read_all" ON public."UserProgression"
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "UserProgression_owner_write" ON public."UserProgression"
  FOR UPDATE TO authenticated
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

ALTER TABLE public."UserBadge" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "UserBadge_read_all" ON public."UserBadge"
  FOR SELECT TO anon, authenticated USING (true);

-- ===========================================================================
-- TIER 5 — TRIP DATA, MEMBERSHIP-GATED.
-- Only accepted members (is_trip_member) can read a trip and its children;
-- public trips are additionally readable by anyone. Writes are member-only;
-- destructive trip-level edits should stay server-side (creator checks live
-- in the API today) — these policies are the read/visibility floor.
-- ===========================================================================
ALTER TABLE public."GolfTrip" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "GolfTrip_read_member_or_public" ON public."GolfTrip"
  FOR SELECT TO anon, authenticated
  USING ("isPublic" = true OR public.is_trip_member(id));
CREATE POLICY "GolfTrip_creator_write" ON public."GolfTrip"
  FOR ALL TO authenticated
  USING ("createdBy" = auth.uid()::text) WITH CHECK ("createdBy" = auth.uid()::text);

-- Child tables keyed by tripId — readable by members (or when the parent trip
-- is public), writable by members. GolfTripMember gets its own non-recursive
-- policy via the SECURITY DEFINER helper.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'GolfTripCourse','TripMessage','TripGame','GolfTripNote','GolfTripRyderTeam'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated '
      'USING (public.is_trip_member("tripId") OR EXISTS '
      '(SELECT 1 FROM public."GolfTrip" g WHERE g.id = "tripId" AND g."isPublic" = true));',
      t || '_read', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING (public.is_trip_member("tripId")) WITH CHECK (public.is_trip_member("tripId"));',
      t || '_member_write', t);
  END LOOP;
END $$;

ALTER TABLE public."GolfTripMember" ENABLE ROW LEVEL SECURITY;
-- A member can see the roster of trips they belong to; can see/act on their
-- own row (accept/decline). Insert of new members is server-side (invite flow).
CREATE POLICY "GolfTripMember_read" ON public."GolfTripMember"
  FOR SELECT TO authenticated
  USING ("userId" = auth.uid()::text OR public.is_trip_member("tripId"));
CREATE POLICY "GolfTripMember_self_write" ON public."GolfTripMember"
  FOR ALL TO authenticated
  USING ("userId" = auth.uid()::text) WITH CHECK ("userId" = auth.uid()::text);

-- ===========================================================================
-- TIER 6 — SERVER / ADMIN ONLY. Enable RLS, write NO client policies. The
-- anon + authenticated roles get nothing; only the service_role key (which
-- bypasses RLS) touches these. This is the safe default-deny posture.
-- ===========================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ModerationReport','CourseClaim','CourseManager','SearchLog','SearchClick',
    'TripPlannerCache','LeaderboardSnapshot','CourseFieldContribution',
    'Referral','Badge'  -- Badge already public-read above; listed here only as a reminder it has no write policy
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    -- intentionally no CREATE POLICY → default deny for client roles
  END LOOP;
END $$;

-- ===========================================================================
-- ROLLOUT CHECKLIST (do this per table, not all at once):
--   1. Confirm the client's reads for that table use columns/filters the
--      SELECT policy allows (or repoint them at user_public for User).
--   2. Apply that table's section in a staging project.
--   3. Smoke-test the affected surface signed-in AND signed-out (anon).
--   4. Watch for empty feeds / 401s, then promote.
-- Reminder: service_role bypasses RLS, so cron + API routes are unaffected.
-- ===========================================================================
