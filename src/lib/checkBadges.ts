import { createClient } from "@/lib/supabase/server";
import { awardBadge } from "@/lib/awardBadge";
import { PointAction, type PointActionKey } from "@/config/points-system";

/**
 * Called after every points award. Checks whether any badges have been unlocked.
 * Idempotent — awardBadge skips already-earned badges.
 */
export async function checkBadgesForAction(
  userId: string,
  action: PointActionKey,
  referenceId?: string
): Promise<void> {
  const supabase = await createClient();

  switch (action) {
    case PointAction.UPLOAD_CLIP: {
      const { count: uploadCount } = await supabase
        .from("Upload")
        .select("*", { count: "exact", head: true })
        .eq("userId", userId);

      const n = uploadCount ?? 0;
      if (n >= 1)   await awardBadge(userId, "first_clip");
      if (n >= 5)   await awardBadge(userId, "5_clips");
      if (n >= 10)  await awardBadge(userId, "10_clips");
      if (n >= 25)  await awardBadge(userId, "25_clips");
      if (n >= 50)  await awardBadge(userId, "50_clips");
      if (n >= 100) await awardBadge(userId, "100_clips");

      // Distinct course count (via CourseContribution)
      const { count: courseCount } = await supabase
        .from("CourseContribution")
        .select("*", { count: "exact", head: true })
        .eq("userId", userId);

      const c = courseCount ?? 0;
      if (c >= 5)  await awardBadge(userId, "5_courses");
      if (c >= 10) await awardBadge(userId, "10_courses");
      if (c >= 25) await awardBadge(userId, "25_courses");
      break;
    }

    case PointAction.UPLOAD_FIRST_FOR_COURSE:
      await awardBadge(userId, "course_pioneer");
      break;

    case PointAction.UPLOAD_FIRST_FOR_HOLE:
      await awardBadge(userId, "hole_trailblazer");
      break;

    case PointAction.LIKE_RECEIVED: {
      if (!referenceId) break;
      const { data: upload } = await supabase
        .from("Upload")
        .select("likeCount")
        .eq("id", referenceId)
        .maybeSingle();

      const likes = upload?.likeCount ?? 0;
      if (likes >= 10)   await awardBadge(userId, "popular_clip");
      if (likes >= 100)  await awardBadge(userId, "viral_clip");
      if (likes >= 1000) await awardBadge(userId, "legendary_clip");
      break;
    }

    case PointAction.FOLLOW_RECEIVED: {
      const { count: followerCount } = await supabase
        .from("Follow")
        .select("*", { count: "exact", head: true })
        .eq("followingId", userId)
        .eq("status", "ACTIVE");

      const f = followerCount ?? 0;
      if (f >= 10)  await awardBadge(userId, "10_followers");
      if (f >= 100) await awardBadge(userId, "100_followers");
      break;
    }
  }
}
