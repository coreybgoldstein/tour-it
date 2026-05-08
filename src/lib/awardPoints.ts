import { createClient } from "@/lib/supabase/server";
import {
  POINT_VALUES,
  RANK_UP_BONUSES,
  ONE_TIME_ACTIONS,
  PointAction,
  type PointActionKey,
  type RankTierKey,
} from "@/config/points-system";
import { computeLevel, computeRank } from "@/lib/progression";

type AwardPointsOptions = {
  userId: string;
  action: PointActionKey;
  referenceId?: string;
  metadata?: Record<string, unknown>;
  /**
   * Override the action's default point value. Used for variable-amount
   * actions like INTEL_BONUS where the amount depends on runtime data.
   */
  customAmount?: number;
};

// Per-action daily caps (max awards per user per calendar day)
const DAILY_CAPS: Partial<Record<PointActionKey, number>> = {
  [PointAction.LIKE_RECEIVED]:    100,
  [PointAction.COMMENT_RECEIVED]:  50,
  [PointAction.FOLLOW_RECEIVED]:   25,
};

// Pioneer bonus actions share a group cap of 5/day
const PIONEER_ACTIONS = [
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
  customAmount,
}: AwardPointsOptions): Promise<{ totalPoints: number; level: number } | null> {
  const supabase = await createClient();
  const points = customAmount ?? POINT_VALUES[action];

  // Skip no-op awards (e.g. INTEL_BONUS with zero filled fields)
  if (points === 0) return null;

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

  // Fetch current progression or default. Update totalPoints, weeklyPoints
  // AND monthlyPoints together — leaderboard sorts on monthlyPoints during
  // active competitions, so this MUST stay in sync with totalPoints.
  const { data: prog } = await supabase
    .from("UserProgression")
    .select("totalPoints, weeklyPoints, monthlyPoints, level, rank")
    .eq("userId", userId)
    .maybeSingle();

  const oldLevel = prog?.level ?? 1;
  const oldRank  = prog?.rank  ?? "CADDIE";

  const totalPoints   = Math.max(0, (prog?.totalPoints   ?? 0) + points);
  const weeklyPoints  = Math.max(0, (prog?.weeklyPoints  ?? 0) + points);
  const monthlyPoints = Math.max(0, (prog?.monthlyPoints ?? 0) + points);
  const level         = computeLevel(totalPoints);
  const rank          = computeRank(level);
  const now           = new Date().toISOString();

  // Award level-up bonuses for each new level reached
  let bonusPoints = 0;
  if (level > oldLevel) {
    for (let lvl = oldLevel + 1; lvl <= level; lvl++) {
      const { count } = await supabase
        .from("UserPointsLedger")
        .select("id", { count: "exact", head: true })
        .eq("userId", userId)
        .eq("action", PointAction.LEVEL_UP)
        .eq("referenceId", `level_${lvl}`);
      if ((count ?? 0) === 0) {
        const bonus = POINT_VALUES[PointAction.LEVEL_UP];
        bonusPoints += bonus;
        await supabase.from("UserPointsLedger").insert({
          id: crypto.randomUUID(),
          userId,
          action: PointAction.LEVEL_UP,
          points: bonus,
          referenceId: `level_${lvl}`,
          metadata: null,
          createdAt: now,
        });
      }
    }
  }

  // Award rank-up bonus when rank tier changes
  if (rank !== oldRank) {
    const { count } = await supabase
      .from("UserPointsLedger")
      .select("id", { count: "exact", head: true })
      .eq("userId", userId)
      .eq("action", PointAction.RANK_UP)
      .eq("referenceId", `rank_${rank}`);
    if ((count ?? 0) === 0) {
      const bonus = RANK_UP_BONUSES[rank as RankTierKey] ?? 0;
      if (bonus > 0) {
        bonusPoints += bonus;
        await supabase.from("UserPointsLedger").insert({
          id: crypto.randomUUID(),
          userId,
          action: PointAction.RANK_UP,
          points: bonus,
          referenceId: `rank_${rank}`,
          metadata: null,
          createdAt: now,
        });
      }
    }
  }

  const finalTotal   = totalPoints + bonusPoints;
  const finalWeekly  = weeklyPoints + bonusPoints;
  const finalMonthly = monthlyPoints + bonusPoints;
  const finalLevel   = computeLevel(finalTotal);
  const finalRank    = computeRank(finalLevel);

  const { error: progErr } = await supabase.from("UserProgression").upsert(
    {
      userId,
      totalPoints:   finalTotal,
      weeklyPoints:  finalWeekly,
      monthlyPoints: finalMonthly,
      level:         finalLevel,
      rank:          finalRank,
      updatedAt:     now,
    },
    { onConflict: "userId" }
  );

  if (progErr) {
    console.error("[awardPoints] progression upsert failed", progErr);
    return null;
  }

  return { totalPoints: finalTotal, level: finalLevel };
}
