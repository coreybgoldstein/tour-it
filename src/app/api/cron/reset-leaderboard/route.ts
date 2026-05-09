import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 300;

function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function pointsForLevel(n: number): number {
  if (n <= 1) return 0;
  return Math.floor(40 * Math.pow(n - 1, 1.85));
}

function computeLevel(pts: number): number {
  let level = 1;
  for (let n = 2; n <= 100; n++) {
    if (pts >= pointsForLevel(n)) level = n; else break;
  }
  return level;
}

const RANK_TIERS = [
  { rank: "CADDIE",     min: 1,  max: 10  },
  { rank: "LOCAL",      min: 11, max: 25  },
  { rank: "MARSHAL",    min: 26, max: 45  },
  { rank: "COURSE_PRO", min: 46, max: 70  },
  { rank: "TOUR_PRO",   min: 71, max: 90  },
  { rank: "LEGEND",     min: 91, max: 100 },
];

function computeRank(level: number): string {
  return RANK_TIERS.find(t => level >= t.min && level <= t.max)?.rank ?? "LEGEND";
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = req.nextUrl.searchParams.get("mode") ?? "weekly";
  const doWeekly  = mode === "weekly"  || mode === "both";
  const doMonthly = mode === "monthly" || mode === "both";

  const sb = serviceClient();
  const now = new Date();
  const results: Record<string, number> = {};

  if (doWeekly) {
    // Weekly: recalculate weeklyPoints from the last 7 days of ledger
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const PAGE = 1000;
    const ledgerRows: any[] = [];
    let from = 0;
    for (;;) {
      const { data } = await sb.from("UserPointsLedger").select("userId, points").gte("createdAt", weekStart).range(from, from + PAGE - 1);
      if (!data?.length) break;
      ledgerRows.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    const weeklyTotals: Record<string, number> = {};
    for (const row of ledgerRows) weeklyTotals[row.userId] = (weeklyTotals[row.userId] ?? 0) + row.points;

    const { data: progressions } = await sb.from("UserProgression").select("userId");
    let updated = 0;
    for (const prog of progressions ?? []) {
      await sb.from("UserProgression")
        .update({ weeklyPoints: weeklyTotals[prog.userId] ?? 0, weekReset: now.toISOString(), updatedAt: now.toISOString() })
        .eq("userId", prog.userId);
      updated++;
    }
    results.weekly = updated;
  }

  if (doMonthly) {
    // Monthly: recalculate ALL three point fields from the complete ledger.
    // This is a ground-truth resync — catches any incremental drift and ensures
    // monthlyPoints is accurate for the current competition period.
    const weekStart  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    // Paginate through entire ledger
    const PAGE = 1000;
    const allLedger: any[] = [];
    let from = 0;
    for (;;) {
      const { data } = await sb.from("UserPointsLedger").select("userId, points, createdAt").range(from, from + PAGE - 1);
      if (!data?.length) break;
      allLedger.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    const totalMap   = new Map<string, number>();
    const weeklyMap  = new Map<string, number>();
    const monthlyMap = new Map<string, number>();

    for (const r of allLedger) {
      totalMap.set(r.userId, (totalMap.get(r.userId) ?? 0) + r.points);
      if (r.createdAt >= weekStart)  weeklyMap.set(r.userId,  (weeklyMap.get(r.userId)  ?? 0) + r.points);
      if (r.createdAt >= monthStart) monthlyMap.set(r.userId, (monthlyMap.get(r.userId) ?? 0) + r.points);
    }

    const { data: existingProg } = await sb.from("UserProgression").select("id, userId");
    const existingProgMap = new Map((existingProg ?? []).map((p: any) => [p.userId, p.id]));

    const progRows: any[] = [];
    for (const [userId, rawTotal] of totalMap) {
      const totalPoints   = Math.max(0, rawTotal);
      const weeklyPoints  = Math.max(0, weeklyMap.get(userId)  ?? 0);
      const monthlyPoints = Math.max(0, monthlyMap.get(userId) ?? 0);
      const level = computeLevel(totalPoints);
      const rank  = computeRank(level);
      const id    = existingProgMap.get(userId) ?? crypto.randomUUID();
      progRows.push({ id, userId, totalPoints, weeklyPoints, monthlyPoints, level, rank,
        weekReset: now.toISOString(), monthReset: now.toISOString(), updatedAt: now.toISOString() });
    }

    const PCHUNK = 200;
    let updated = 0;
    for (let i = 0; i < progRows.length; i += PCHUNK) {
      await sb.from("UserProgression").upsert(progRows.slice(i, i + PCHUNK), { onConflict: "userId" });
      updated += Math.min(PCHUNK, progRows.length - i);
    }
    results.monthly = updated;
  }

  return NextResponse.json({ ok: true, ...results });
}
