import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * DELETE /api/user/delete
 *
 * Permanently delete the authenticated user and every FK row that points
 * at them. Order matters: child rows MUST be deleted before parent rows
 * because Postgres FK constraints will block the final User row delete
 * otherwise.
 *
 * A handful of models cascade automatically on User delete (Round,
 * Notification, UploadTag, UserProgression, UserPointsLedger, UserBadge,
 * CourseContribution, TripMessage, GolfTripMember, GolfTripRyderTeam).
 * We still clean those rows explicitly so a partial failure leaves the
 * smallest possible footprint instead of half-orphaned state.
 *
 * Every step is wrapped in try/catch — if one step fails we log it and
 * keep going so subsequent cleanup still happens. The response notes
 * which steps failed.
 */
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uid = user.id;
  const admin = createAdminClient();
  const errors: { step: string; error: string }[] = [];

  const tryStep = async (label: string, fn: () => PromiseLike<unknown>) => {
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[user/delete] step "${label}" failed for ${uid}:`, msg);
      errors.push({ step: label, error: msg });
    }
  };

  // ---------------------------------------------------------------
  // Phase 1 — engagement the user produced on OTHER people's content.
  // ---------------------------------------------------------------

  await tryStep("Like (by user)", () =>
    admin.from("Like").delete().eq("userId", uid)
  );
  await tryStep("Comment (by user)", () =>
    admin.from("Comment").delete().eq("userId", uid)
  );
  await tryStep("View (by user)", () =>
    admin.from("View").delete().eq("userId", uid)
  );
  await tryStep("Save (by user)", () =>
    admin.from("Save").delete().eq("userId", uid)
  );
  await tryStep("UploadTag (by user)", () =>
    admin.from("UploadTag").delete().eq("userId", uid)
  );
  await tryStep("UploadPhoto (by user)", () =>
    admin.from("UploadPhoto").delete().eq("userId", uid)
  );

  // ---------------------------------------------------------------
  // Phase 2 — moderation reports (both directions).
  // The audit found this was filtering by the wrong column name
  // (reporterId). The actual schema column is `reportedById`. Also
  // wipe reports filed AGAINST the user via reportedUserId.
  // ---------------------------------------------------------------

  await tryStep("ModerationReport (filed by user)", () =>
    admin.from("ModerationReport").delete().eq("reportedById", uid)
  );
  await tryStep("ModerationReport (filed against user)", () =>
    admin.from("ModerationReport").delete().eq("reportedUserId", uid)
  );

  // ---------------------------------------------------------------
  // Phase 3 — social graph edges (follow both directions).
  // ---------------------------------------------------------------

  await tryStep("Follow (as follower)", () =>
    admin.from("Follow").delete().eq("followerId", uid)
  );
  await tryStep("Follow (as following)", () =>
    admin.from("Follow").delete().eq("followingId", uid)
  );

  // ---------------------------------------------------------------
  // Phase 4 — referrals (inviter + invitee directions).
  // ---------------------------------------------------------------

  await tryStep("Referral (as inviter)", () =>
    admin.from("Referral").delete().eq("inviterId", uid)
  );
  await tryStep("Referral (as invitee)", () =>
    admin.from("Referral").delete().eq("inviteeId", uid)
  );

  // ---------------------------------------------------------------
  // Phase 5 — user's own uploads. Clear everyone ELSE's engagement
  // off them first, then drop the uploads. UploadPhoto + Comment +
  // Like + View + ModerationReport cascade on Upload, but doing the
  // sweep explicitly keeps order predictable and survives schema
  // drift.
  // ---------------------------------------------------------------

  const { data: uploads } = await admin
    .from("Upload")
    .select("id")
    .eq("userId", uid);
  const uploadIds = (uploads ?? []).map((u: { id: string }) => u.id);

  if (uploadIds.length > 0) {
    await tryStep("Comment (on user's uploads)", () =>
      admin.from("Comment").delete().in("uploadId", uploadIds)
    );
    await tryStep("Like (on user's uploads)", () =>
      admin.from("Like").delete().in("uploadId", uploadIds)
    );
    await tryStep("View (on user's uploads)", () =>
      admin.from("View").delete().in("uploadId", uploadIds)
    );
    await tryStep("UploadTag (on user's uploads)", () =>
      admin.from("UploadTag").delete().in("uploadId", uploadIds)
    );
    await tryStep("UploadPhoto (on user's uploads)", () =>
      admin.from("UploadPhoto").delete().in("uploadId", uploadIds)
    );
    await tryStep("ModerationReport (against user's uploads)", () =>
      admin.from("ModerationReport").delete().in("uploadId", uploadIds)
    );
    await tryStep("Notification (referencing user's uploads)", () =>
      admin.from("Notification").delete().in("referenceId", uploadIds)
    );
  }

  await tryStep("Upload (by user)", () =>
    admin.from("Upload").delete().eq("userId", uid)
  );

  // ---------------------------------------------------------------
  // Phase 6 — trips and their nested data the user created.
  // GolfTrip.createdBy is not cascading, so we have to drop the
  // trips. The child models (GolfTripCourse, GolfTripMember,
  // GolfTripRyderTeam, TripMessage, TripGame) cascade on GolfTrip
  // delete, so a single GolfTrip.delete handles the subtree.
  // TripGame.createdBy on OTHER users' trips is a separate edge.
  // ---------------------------------------------------------------

  const { data: trips } = await admin
    .from("GolfTrip")
    .select("id")
    .eq("createdBy", uid);
  const tripIds = (trips ?? []).map((t: { id: string }) => t.id);

  if (tripIds.length > 0) {
    await tryStep("GolfTrip (created by user)", () =>
      admin.from("GolfTrip").delete().in("id", tripIds)
    );
  }

  await tryStep("TripGame (created by user on other trips)", () =>
    admin.from("TripGame").delete().eq("createdBy", uid)
  );

  // ---------------------------------------------------------------
  // Phase 7 — misc rows that reference the user as a plain string
  // column (no formal Prisma relation). These won't block the User
  // delete via FK, but leaving them around orphans data tied to the
  // deleted account.
  // ---------------------------------------------------------------

  await tryStep("CourseRequest (by user)", () =>
    admin.from("CourseRequest").delete().eq("userId", uid)
  );
  await tryStep("CourseFieldContribution (by user)", () =>
    admin.from("CourseFieldContribution").delete().eq("userId", uid)
  );
  await tryStep("CourseContribution (by user)", () =>
    admin.from("CourseContribution").delete().eq("userId", uid)
  );
  await tryStep("RewardsWaitlist (by user)", () =>
    admin.from("RewardsWaitlist").delete().eq("userId", uid)
  );
  await tryStep("LeaderboardSnapshot (by user)", () =>
    admin.from("LeaderboardSnapshot").delete().eq("userId", uid)
  );
  await tryStep("SearchClick (by user)", () =>
    admin.from("SearchClick").delete().eq("userId", uid)
  );
  await tryStep("SearchLog (by user)", () =>
    admin.from("SearchLog").delete().eq("userId", uid)
  );

  // ---------------------------------------------------------------
  // Phase 8 — progression + notifications + rounds. These cascade
  // on User delete, but doing them explicitly here lets a partial
  // failure still clear most of the user's footprint.
  // ---------------------------------------------------------------

  await tryStep("Notification (for user)", () =>
    admin.from("Notification").delete().eq("userId", uid)
  );
  await tryStep("UserBadge (for user)", () =>
    admin.from("UserBadge").delete().eq("userId", uid)
  );
  await tryStep("UserPointsLedger (for user)", () =>
    admin.from("UserPointsLedger").delete().eq("userId", uid)
  );
  await tryStep("UserProgression (for user)", () =>
    admin.from("UserProgression").delete().eq("userId", uid)
  );
  await tryStep("Round (for user)", () =>
    admin.from("Round").delete().eq("userId", uid)
  );

  // ---------------------------------------------------------------
  // Phase 9 — the User row itself, then the Supabase auth identity.
  // ---------------------------------------------------------------

  await tryStep("User", () =>
    admin.from("User").delete().eq("id", uid)
  );
  await tryStep("auth.admin.deleteUser", () =>
    admin.auth.admin.deleteUser(uid)
  );

  if (errors.length > 0) {
    console.warn(
      `[user/delete] completed with ${errors.length} step failures for ${uid}`,
      errors
    );
    return NextResponse.json(
      { ok: true, partial: true, errors },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true });
}
