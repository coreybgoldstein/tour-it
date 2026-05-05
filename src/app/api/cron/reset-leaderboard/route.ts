import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = req.nextUrl.searchParams.get("mode") ?? "weekly"; // "weekly" | "monthly" | "both"
  const doWeekly  = mode === "weekly"  || mode === "both";
  const doMonthly = mode === "monthly" || mode === "both";

  const supabase = await createClient();
  const now = new Date();

  const results: Record<string, number> = {};

  if (doWeekly) {
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Sum points from ledger for each user in the last 7 days
    const { data: ledgerRows } = await supabase
      .from("UserPointsLedger")
      .select("userId, points")
      .gte("createdAt", weekStart);

    const weeklyTotals: Record<string, number> = {};
    for (const row of ledgerRows ?? []) {
      weeklyTotals[row.userId] = (weeklyTotals[row.userId] ?? 0) + row.points;
    }

    // Fetch all progression rows and update each
    const { data: progressions } = await supabase
      .from("UserProgression")
      .select("userId");

    let updated = 0;
    for (const prog of progressions ?? []) {
      const pts = weeklyTotals[prog.userId] ?? 0;
      await supabase
        .from("UserProgression")
        .update({ weeklyPoints: pts, weekReset: now.toISOString(), updatedAt: now.toISOString() })
        .eq("userId", prog.userId);
      updated++;
    }
    results.weekly = updated;
  }

  if (doMonthly) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: ledgerRows } = await supabase
      .from("UserPointsLedger")
      .select("userId, points")
      .gte("createdAt", monthStart);

    const monthlyTotals: Record<string, number> = {};
    for (const row of ledgerRows ?? []) {
      monthlyTotals[row.userId] = (monthlyTotals[row.userId] ?? 0) + row.points;
    }

    const { data: progressions } = await supabase
      .from("UserProgression")
      .select("userId");

    let updated = 0;
    for (const prog of progressions ?? []) {
      const pts = monthlyTotals[prog.userId] ?? 0;
      await supabase
        .from("UserProgression")
        .update({ monthlyPoints: pts, monthReset: now.toISOString(), updatedAt: now.toISOString() })
        .eq("userId", prog.userId);
      updated++;
    }
    results.monthly = updated;
  }

  return NextResponse.json({ ok: true, ...results });
}
