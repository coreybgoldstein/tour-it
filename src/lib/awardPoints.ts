import { createClient } from "@/lib/supabase/server";
import {
  POINT_VALUES,
  ONE_TIME_ACTIONS,
  PointAction,
  type PointActionKey,
} from "@/config/points-system";
import { computeLevel, computeRank } from "@/lib/progression";

type AwardPointsOptions = {
  userId: string;
  action: PointActionKey;
  referenceId?: string;
  metadata?: Record<string, unknown>;
};

// Per-action daily caps (max awards per user per calendar day)
const DAILY_CAPS: Partial<Record<PointActionKey, number>> = {
  [PointAction.LIKE_RECEIVED]:    100,
  [PointAction.COMMENT_RECEIVED]:  50,
  [PointAction.FOLLOW_RECEIVED]:   25,
};

// Pioneer bonus actions share a group cap of 5/day
const PIONEER_ACTIONS = [
  PointAction.UPLOAD_FIRST_FOR_HOLE,
  PointAction.UPLOAD_FIRST_FOR_COURSE,
] as const;
const PIONEER_DAILY_CAP = 5;

// Course field actions share a group cap of 20/day
const COURSE_FIELD_ACTIONS = [
  PointAction.ADD_COVER_PHOTO,
  PointAction.ADD_COURSE_LOGO,
  PointAction.ADD_YEAR_ESTABLISHED,
  PointAction.ADD_COURSE_TYPE,
  PointAction.ADD_ZIP_CODE,
  PointAction.ADD_WEBSITE_URL,
  PointAction.ADD_COURSE_DESCRIPTION,
  PointAction.COURSE_PROFILE_COMPLETE,
] as const;
const COURSE_FIELD_DAILY_CAP = 20;

export async function awardPoints({
  userId,
  action,
  referenceId,
  metadata,
}: AwardPointsOptions): Promise<{ totalPoints: number; level: number } | null> {
  const supabase = await createClient();
  const points = POINT_VALUES[action];

  // Guard: skip one-time actions already awarded
  if (ONE_TIME_ACTIONS.has(action)) {
    const { data: existing } = await supabase
      .from("UserPointsLedger")
      .select("id")
      .eq("userId", userId)
      .eq("action", action)
      .maybeSingle();
    if (existing) return null;
  }

  // Daily cap checks
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString();

  if (DAILY_CAPS[action] !== undefined) {
    const { count } = await supabase
      .from("UserPointsLedger")
      .select("id", { count: "exact", head: true })
      .eq("userId", userId)
      .eq("action", action)
      .gte("createdAt", todayStr);
    if ((count ?? 0) >= DAILY_CAPS[action]!) return null;
  }

  if ((PIONEER_ACTIONS as readonly string[]).includes(action)) {
    const { count } = await supabase
      .from("UserPointsLedger")
      .select("id", { count: "exact", head: true })
      .eq("userId", userId)
      .in("action", PIONEER_ACTIONS as unknown as string[])
      .gte("createdAt", todayStr);
    if ((count ?? 0) >= PIONEER_DAILY_CAP) return null;
  }

  if ((COURSE_FIELD_ACTIONS as readonly string[]).includes(action)) {
    const { count } = await supabase
      .from("UserPointsLedger")
      .select("id", { count: "exact", head: true })
      .eq("userId", userId)
      .in("action", COURSE_FIELD_ACTIONS as unknown as string[])
      .gte("createdAt", todayStr);
    if ((count ?? 0) >= COURSE_FIELD_DAILY_CAP) return null;
  }

  // Insert ledger row
  const { error: ledgerErr } = await supabase.from("UserPointsLedger").insert({
    id: crypto.randomUUID(),
    userId,
    action,
    points,
    referenceId: referenceId ?? null,
    metadata: metadata ?? null,
    createdAt: new Date().toISOString(),
  });
  if (ledgerErr) {
    console.error("[awardPoints] ledger insert failed", ledgerErr);
    return null;
  }

  // Fetch current progression or default
  const { data: prog } = await supabase
    .from("UserProgression")
    .select("totalPoints, weeklyPoints, monthlyPoints")
    .eq("userId", userId)
    .maybeSingle();

  const totalPoints   = Math.max(0, (prog?.totalPoints   ?? 0) + points);
  const weeklyPoints  = Math.max(0, (prog?.weeklyPoints  ?? 0) + points);
  const monthlyPoints = Math.max(0, (prog?.monthlyPoints ?? 0) + points);
  const level         = computeLevel(totalPoints);
  const rank          = computeRank(level);
  const now           = new Date().toISOString();

  const { error: progErr } = await supabase.from("UserProgression").upsert(
    {
      userId,
      totalPoints,
      weeklyPoints,
      monthlyPoints,
      level,
      rank,
      updatedAt: now,
    },
    { onConflict: "userId" }
  );

  if (progErr) {
    console.error("[awardPoints] progression upsert failed", progErr);
    return null;
  }

  return { totalPoints, level };
}
