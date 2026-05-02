import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { awardPoints } from "@/lib/awardPoints";
import { PointAction } from "@/config/points-system";

const STREAK_MILESTONES: { weeks: number; action: typeof PointAction[keyof typeof PointAction] }[] = [
  { weeks: 4,  action: PointAction.STREAK_4_WEEKS  },
  { weeks: 8,  action: PointAction.STREAK_8_WEEKS  },
  { weeks: 12, action: PointAction.STREAK_12_WEEKS },
  { weeks: 26, action: PointAction.STREAK_26_WEEKS },
  { weeks: 52, action: PointAction.STREAK_52_WEEKS },
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Get all UserProgression rows
  const { data: progressions, error } = await supabase
    .from("UserProgression")
    .select("userId, streakWeeks");

  if (error || !progressions) {
    return NextResponse.json({ error: "Failed to fetch progressions" }, { status: 500 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let updated = 0;
  let milestones = 0;

  for (const prog of progressions) {
    const { count } = await supabase
      .from("Upload")
      .select("id", { count: "exact", head: true })
      .eq("userId", prog.userId)
      .gte("createdAt", sevenDaysAgo);

    const uploadedThisWeek = (count ?? 0) > 0;
    const newStreakWeeks = uploadedThisWeek ? prog.streakWeeks + 1 : 0;

    await supabase
      .from("UserProgression")
      .update({ streakWeeks: newStreakWeeks, updatedAt: new Date().toISOString() })
      .eq("userId", prog.userId);

    if (uploadedThisWeek && newStreakWeeks > prog.streakWeeks) {
      for (const milestone of STREAK_MILESTONES) {
        if (newStreakWeeks >= milestone.weeks && prog.streakWeeks < milestone.weeks) {
          await awardPoints({ userId: prog.userId, action: milestone.action });
          milestones++;
        }
      }
    }

    updated++;
  }

  return NextResponse.json({ ok: true, updated, milestones });
}
