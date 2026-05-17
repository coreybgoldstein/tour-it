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

// Actions that should be awarded once per (userId, action, referenceId) tuple
// — i.e. once per trip / game / course-field, not once per user globally.
// Avoids re-awarding when toggling Ryder Cup, rebuilding a game, or
// re-saving the same course field.
const REFERENCE_DEDUPED_ACTIONS = new Set<PointActionKey>([
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
]);

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

// @tourit is a system poster (course intel) — never earns points and
// never appears in leaderboards. See leaderboards/page.tsx for the UI
// exclusion, and resync-leaderboard.mjs for the data-side zero-out.
const TOURIT_USER_ID = "ab290b8b-9d02-4acb-8a18-a84d48ffb77c";

export async function awardPoints({
  userId,
  action,
  referenceId,
  metadata,
  customAmount,
}: AwardPointsOptions): Promise<{ totalPoints: number; level: number } | null> {
  // Hard short-circuit for the system poster — no ledger row, no
  // progression update, no broadcast. Prevents any future point award
  // for @tourit regardless of which API route or trigger called us.
  if (userId === TOURIT_USER_ID) return null;

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

  // Guard: per-reference dedupe (e.g. don't re-award CREATE_GAME if the same
  // gameId is replayed). Requires a referenceId — without one, falls through.
  if (REFERENCE_DEDUPED_ACTIONS.has(action) && referenceId) {
    const { data: existing } = await supabase
      .from("UserPointsLedger")
      .select("id")
      .eq("userId", userId)
      .eq("action", action)
      .eq("referenceId", referenceId)
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
    .select("totalPoints, weeklyPoints, monthlyPoints, level, rank, weekReset, monthReset")
    .eq("userId", userId)
    .maybeSingle();

  const oldLevel = prog?.level ?? 1;
  const oldRank  = prog?.rank  ?? "CADDIE";

  // Self-healing period rollover: if the stored weekly/monthly counter is
  // potentially stale (last reset is older than the current period boundary,
  // OR the marker is missing entirely), recompute the correct base from the
  // ledger so we don't drop accumulated in-period points on first award.
  //
  // The earlier version of this fix wrongly treated `monthReset is null` as
  // "stale → reset to 0", which would zero out users like jlutt who joined
  // mid-month and never had a monthReset stamped. Now we always derive the
  // truthful base from the ledger when potentially stale.
  const nowDate     = new Date();
  const monthStart  = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1));
  const weekStart   = new Date(nowDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekResetAt   = prog?.weekReset  ? new Date(prog.weekReset)  : null;
  const monthResetAt  = prog?.monthReset ? new Date(prog.monthReset) : null;
  const weeklyStale   = !weekResetAt  || weekResetAt  < weekStart;
  const monthlyStale  = !monthResetAt || monthResetAt < monthStart;

  async function ledgerSumSince(periodStart: Date): Promise<number> {
    const { data: rows } = await supabase
      .from("UserPointsLedger")
      .select("points")
      .eq("userId", userId)
      .gte("createdAt", periodStart.toISOString());
    return (rows ?? []).reduce((s: number, r: { points: number }) => s + r.points, 0);
  }

  const weeklyBase  = weeklyStale  ? await ledgerSumSince(weekStart)  : (prog?.weeklyPoints  ?? 0);
  const monthlyBase = monthlyStale ? await ledgerSumSince(monthStart) : (prog?.monthlyPoints ?? 0);

  const totalPoints   = Math.max(0, (prog?.totalPoints ?? 0) + points);
  const weeklyPoints  = Math.max(0, weeklyBase  + points);
  const monthlyPoints = Math.max(0, monthlyBase + points);
  const level         = computeLevel(totalPoints);
  const rank          = computeRank(level);
  const now           = nowDate.toISOString();

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
      // Stamp the period markers whenever we reset the counter. This is what
      // makes the rollover detection above self-healing: once we've zeroed the
      // stale counter, the next award in the same period reads a fresh marker.
      ...(weeklyStale  ? { weekReset:  now } : {}),
      ...(monthlyStale ? { monthReset: now } : {}),
      updatedAt:     now,
    },
    { onConflict: "userId" }
  );

  if (progErr) {
    console.error("[awardPoints] progression upsert failed", progErr);
    return null;
  }

  // Broadcast to the leaderboard + profile subscribers so every UI surface
  // refreshes instantly — not just the /api/points/award path. All
  // direct-callers (referrals, contributions, streak cron, badges) now push
  // updates too. Fire-and-forget; failure must not block the points write.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        messages: [
          { topic: "realtime:leaderboard-updates", event: "points-awarded", payload: { userId } },
          { topic: `realtime:user-progression:${userId}`, event: "points-awarded", payload: { userId } },
        ],
      }),
    }).catch(() => {});
  }

  return { totalPoints: finalTotal, level: finalLevel };
}
