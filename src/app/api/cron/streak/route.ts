import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { awardPoints } from "@/lib/awardPoints";
import { PointAction, type PointActionKey } from "@/config/points-system";

const STREAK_MILESTONES: { weeks: number; action: PointActionKey }[] = [
  { weeks: 3,  action: PointAction.STREAK_3_WEEKS  },
  { weeks: 8,  action: PointAction.STREAK_8_WEEKS  },
  { weeks: 12, action: PointAction.STREAK_12_WEEKS },
  { weeks: 26, action: PointAction.STREAK_26_WEEKS },
  { weeks: 52, action: PointAction.STREAK_52_WEEKS },
];

// Match the safer auth pattern from /api/cron/reset-leaderboard:
// explicitly require CRON_SECRET to be set so an unset env var can't
// match "Bearer undefined" from a malformed header.
function cronAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const unauth = cronAuth(req);
  if (unauth) return unauth;

  const supabase = await createClient();

  // Pull every progression row and EVERY upload from the last 7 days in
  // exactly two queries — instead of one progression query plus N per-user
  // .select() count queries, which at production scale hit Supabase
  // thousands of times per nightly run. Group uploads by userId in memory,
  // then write streak updates as a single upsert.
  const { data: progressions, error: progErr } = await supabase
    .from("UserProgression")
    .select("userId, streakWeeks");
  if (progErr || !progressions) {
    return NextResponse.json({ error: "Failed to fetch progressions" }, { status: 500 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data: recentUploads, error: uploadErr } = await supabase
    .from("Upload")
    .select("userId")
    .gte("createdAt", sevenDaysAgo);
  if (uploadErr) {
    return NextResponse.json({ error: "Failed to fetch recent uploads" }, { status: 500 });
  }

  // Build a Set of userIds who uploaded at least once in the last 7 days.
  // Set membership is O(1) — replaces N count queries with a single lookup.
  const activeUserIds = new Set<string>();
  for (const row of recentUploads ?? []) {
    if (row.userId) activeUserIds.add(row.userId);
  }

  // Build the upsert payload and milestone-award queue in one pass.
  type StreakUpdate = { userId: string; streakWeeks: number; updatedAt: string };
  const updates: StreakUpdate[] = [];
  const milestoneAwards: { userId: string; action: PointActionKey }[] = [];

  for (const prog of progressions) {
    const uploadedThisWeek = activeUserIds.has(prog.userId);
    const newStreakWeeks = uploadedThisWeek ? prog.streakWeeks + 1 : 0;
    updates.push({ userId: prog.userId, streakWeeks: newStreakWeeks, updatedAt: now });

    if (uploadedThisWeek && newStreakWeeks > prog.streakWeeks) {
      for (const milestone of STREAK_MILESTONES) {
        if (newStreakWeeks >= milestone.weeks && prog.streakWeeks < milestone.weeks) {
          milestoneAwards.push({ userId: prog.userId, action: milestone.action });
        }
      }
    }
  }

  // One write for every progression row (batched into chunks of 200 to
  // stay within Supabase's row limit per request).
  let updated = 0;
  for (let i = 0; i < updates.length; i += 200) {
    const chunk = updates.slice(i, i + 200);
    const { error } = await supabase
      .from("UserProgression")
      .upsert(chunk, { onConflict: "userId" });
    if (!error) updated += chunk.length;
  }

  // Milestone awards still go through awardPoints (one-time guards live
  // inside that function via ONE_TIME_ACTIONS). Run sequentially to keep
  // the side-effect chain (ledger insert + progression upsert + broadcast)
  // simple — the volume is bounded by how many users crossed a milestone
  // this run, typically a handful.
  let milestones = 0;
  for (const award of milestoneAwards) {
    await awardPoints({ userId: award.userId, action: award.action });
    milestones++;
  }

  return NextResponse.json({ ok: true, updated, milestones });
}
