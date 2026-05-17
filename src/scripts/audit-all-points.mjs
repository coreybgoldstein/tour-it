// Global audit: for every UserProgression row, verify that
// totalPoints equals the sum of that user's UserPointsLedger rows.
// Any drift indicates a bug in the live-write path or a missed event.
//
// Run: node src/scripts/audit-all-points.mjs

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function fetchAll(table, columns) {
  const PAGE = 1000;
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  console.log("\n🔍 Global UserProgression ↔ UserPointsLedger audit\n");

  const ledger = await fetchAll("UserPointsLedger", "userId, points, createdAt");
  console.log(`Loaded ${ledger.length} ledger rows`);

  const totals = new Map();
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const weekStart  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthSums = new Map();
  const weekSums  = new Map();
  for (const r of ledger) {
    totals.set(r.userId, (totals.get(r.userId) ?? 0) + r.points);
    if (r.createdAt >= weekStart)  weekSums.set(r.userId,  (weekSums.get(r.userId)  ?? 0) + r.points);
    if (r.createdAt >= monthStart) monthSums.set(r.userId, (monthSums.get(r.userId) ?? 0) + r.points);
  }

  const progs = await fetchAll("UserProgression", "userId, totalPoints, weeklyPoints, monthlyPoints, weekReset, monthReset");
  console.log(`Loaded ${progs.length} progression rows\n`);

  // Resolve usernames for any drift rows
  const driftRows = [];
  for (const p of progs) {
    const expectedTotal   = totals.get(p.userId)    ?? 0;
    const expectedMonthly = monthSums.get(p.userId) ?? 0;
    const expectedWeekly  = weekSums.get(p.userId)  ?? 0;
    const totalDrift   = p.totalPoints   - expectedTotal;
    const monthlyDrift = p.monthlyPoints - expectedMonthly;
    const weeklyDrift  = p.weeklyPoints  - expectedWeekly;
    if (totalDrift !== 0 || monthlyDrift !== 0 || weeklyDrift !== 0) {
      driftRows.push({ ...p, expectedTotal, expectedMonthly, expectedWeekly, totalDrift, monthlyDrift, weeklyDrift });
    }
  }

  if (driftRows.length === 0) {
    console.log("✅ Every UserProgression matches its ledger sum exactly.");
    console.log("   Total points, monthly points, and weekly points are 100% accounted for.\n");
    return;
  }

  console.log(`⚠️  ${driftRows.length} users have drift:\n`);
  const userIds = driftRows.map(d => d.userId);
  const { data: users } = await sb.from("User").select("id, username, displayName").in("id", userIds);
  const nameMap = new Map((users ?? []).map(u => [u.id, u.username || u.displayName || u.id.slice(0, 8)]));

  for (const d of driftRows.sort((a, b) => Math.abs(b.totalDrift) - Math.abs(a.totalDrift))) {
    const name = nameMap.get(d.userId) ?? d.userId.slice(0, 8);
    const fields = [];
    if (d.totalDrift !== 0)   fields.push(`total ${d.totalPoints}→${d.expectedTotal} (${d.totalDrift > 0 ? "+" : ""}${d.totalDrift})`);
    if (d.monthlyDrift !== 0) fields.push(`monthly ${d.monthlyPoints}→${d.expectedMonthly} (${d.monthlyDrift > 0 ? "+" : ""}${d.monthlyDrift})`);
    if (d.weeklyDrift !== 0)  fields.push(`weekly ${d.weeklyPoints}→${d.expectedWeekly} (${d.weeklyDrift > 0 ? "+" : ""}${d.weeklyDrift})`);
    console.log(`  ${name.padEnd(28)} — ${fields.join(", ")}`);
  }
  console.log("");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
