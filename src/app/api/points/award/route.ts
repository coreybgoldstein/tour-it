import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { awardPoints } from "@/lib/awardPoints";
import { PointAction, type PointActionKey } from "@/config/points-system";
import { checkBadgesForAction } from "@/lib/checkBadges";

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

  const isSelf = SELF_ACTIONS.has(action as PointActionKey);
  const targetUserId = isSelf ? user.id : recipientUserId;

  if (!targetUserId) return NextResponse.json({ error: "Missing recipientUserId" }, { status: 400 });
  if (!isSelf && targetUserId === user.id) {
    return NextResponse.json({ error: "Cannot award received action to yourself" }, { status: 400 });
  }

  const result = await awardPoints({
    userId: targetUserId,
    action: action as PointActionKey,
    referenceId,
    metadata,
    customAmount: typeof customAmount === "number" ? customAmount : undefined,
  });

  // Badge checks run async — don't block the response
  checkBadgesForAction(targetUserId, action as PointActionKey, referenceId).catch(() => {});

  // Broadcast handled inside awardPoints() — fires on every code path now,
  // not just this route.

  return NextResponse.json({ ok: true, result });
}
