import { createServerClient } from "@/lib/supabase/server";
import {
  POINT_VALUES,
  ONE_TIME_ACTIONS,
  type PointActionKey,
} from "@/config/points-system";
import { computeLevel, computeRank } from "@/lib/progression";

type AwardPointsOptions = {
  userId: string;
  action: PointActionKey;
  referenceId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Awards points to a user for a given action.
 * - Skips one-time actions already recorded in the ledger.
 * - Inserts a ledger row and upserts UserProgression in a single RPC transaction.
 * - Returns the new totalPoints and level, or null if skipped.
 */
export async function awardPoints({
  userId,
  action,
  referenceId,
  metadata,
}: AwardPointsOptions): Promise<{ totalPoints: number; level: number } | null> {
  const supabase = await createServerClient();
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
