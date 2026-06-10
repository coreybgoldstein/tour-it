import { awardPoints } from "./awardPoints";
import { checkBadgesForAction } from "./checkBadges";
import type { PointActionKey } from "@/config/points-system";

// Internal helper for cross-user awards. Callers MUST establish the actor's
// identity (typically via supabase.auth.getUser()) and the legitimacy of the
// triggering event (e.g. the like/comment/follow/tag actually exists in the DB)
// BEFORE invoking this. This bypasses the public /api/points/award HTTP route
// — which is now self-only — so an authenticated attacker cannot replay a
// stolen session cookie to award arbitrary points to another user.
//
// Side-effect: kicks off badge checks for the recipient. Fire-and-forget; the
// badge check failure must not block whatever flow called us.
export async function awardPointsToUser(opts: {
  userId: string;
  action: PointActionKey;
  referenceId?: string;
  metadata?: Record<string, unknown>;
  customAmount?: number;
}) {
  const result = await awardPoints(opts);
  checkBadgesForAction(opts.userId, opts.action, opts.referenceId).catch(() => {});
  return result;
}
