import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { awardPoints } from "@/lib/awardPoints";
import { PointAction, POINT_VALUES, type PointActionKey } from "@/config/points-system";
import { checkBadgesForAction } from "@/lib/checkBadges";

// The only actions whose point value is variable and therefore legitimately
// driven by a client-supplied customAmount, with the maximum the client may
// request. Anything outside this map ignores customAmount entirely, and any
// request above the cap is clamped — clients can never self-award arbitrary
// points. INTEL_BONUS maxes at 10 (see calcIntelBonus).
const CUSTOM_AMOUNT_CAPS: Partial<Record<PointActionKey, number>> = {
  [PointAction.INTEL_BONUS]: 10,
};

// Actions where the caller is the recipient
const SELF_ACTIONS = new Set<PointActionKey>([
  PointAction.SIGNUP,
  PointAction.COMPLETE_PROFILE,
  PointAction.ENABLE_NOTIFICATIONS,
  PointAction.UPLOAD_CLIP,
  PointAction.UPLOAD_FIRST_FOR_COURSE,
  PointAction.UPLOAD_SERIES,
  PointAction.INTEL_BONUS,
  PointAction.ADD_HOLE_PHOTO,
  PointAction.UPLOAD_DELETED,
  PointAction.CREATE_TRIP,
  PointAction.CREATE_GAME,
  PointAction.ENABLE_RYDER_CUP,
  PointAction.TRIP_DELETED,
  PointAction.GAME_DELETED,
  PointAction.ROUND_DELETED,
  PointAction.LOG_FIRST_ROUND,
  PointAction.LOG_COMPLETE_ROUND,
  PointAction.ADD_COVER_PHOTO,
  PointAction.ADD_COURSE_LOGO,
  PointAction.ADD_YEAR_ESTABLISHED,
  PointAction.ADD_COURSE_TYPE,
  PointAction.ADD_ZIP_CODE,
  PointAction.ADD_WEBSITE_URL,
  PointAction.ADD_COURSE_DESCRIPTION,
  PointAction.COURSE_PROFILE_COMPLETE,
]);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, recipientUserId, referenceId, metadata, customAmount } = await req.json();
  if (!action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

  // Allowlist: reject any action that isn't a known point action.
  if (!Object.prototype.hasOwnProperty.call(POINT_VALUES, action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  const actionKey = action as PointActionKey;

  // The public HTTP endpoint only accepts SELF_ACTIONS. Cross-user awards
  // (LIKE_RECEIVED, COMMENT_RECEIVED, FOLLOW_RECEIVED, CLIP_UPLOADED_FOR_OTHER,
  // MILESTONE_*, etc.) MUST go through `@/lib/awardPointsToUser` invoked
  // in-process after server-side verification that the triggering event
  // (like/comment/follow/tag) actually exists. Previously this route accepted
  // a client-supplied `recipientUserId` for non-self actions and trusted the
  // session cookie to mean "this action legitimately happened" — a stolen or
  // replayed cookie could award arbitrary points to any user.
  const isSelf = SELF_ACTIONS.has(actionKey);
  if (!isSelf) {
    return NextResponse.json(
      { error: "Cross-user awards must go through the internal helper" },
      { status: 403 }
    );
  }
  // Self-actions are always awarded to the authenticated caller. A client
  // attempting to set `recipientUserId` to someone else is silently ignored.
  const targetUserId = user.id;

  if (!targetUserId) return NextResponse.json({ error: "Missing recipientUserId" }, { status: 400 });
  // `recipientUserId` is accepted in the body shape but intentionally
  // discarded above — keep it referenced so linters don't flag the
  // destructure as unused.
  void recipientUserId;

  // Only honor a client-supplied customAmount for actions whose value is
  // genuinely variable, and clamp it to the action's cap. Everything else
  // uses the fixed POINT_VALUES amount, so a client can't self-award points.
  let safeCustomAmount: number | undefined;
  const cap = CUSTOM_AMOUNT_CAPS[actionKey];
  if (cap !== undefined && typeof customAmount === "number" && Number.isFinite(customAmount)) {
    safeCustomAmount = Math.max(0, Math.min(customAmount, cap));
  }

  const result = await awardPoints({
    userId: targetUserId,
    action: actionKey,
    referenceId,
    metadata,
    customAmount: safeCustomAmount,
  });

  // Badge checks run async — don't block the response
  checkBadgesForAction(targetUserId, actionKey, referenceId).catch(() => {});

  // Broadcast handled inside awardPoints() — fires on every code path now,
  // not just this route.

  return NextResponse.json({ ok: true, result });
}
