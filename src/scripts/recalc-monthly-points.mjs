#!/usr/bin/env node
/**
 * One-shot: recalculate monthlyPoints for all users from the ledger.
 * Run whenever monthly points drift — the cron does this automatically on the 1st.
 * Usage: node src/scripts/recalc-monthly-points.mjs [YYYY-MM]
 * Default: current calendar month
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const arg = process.argv[2]; // e.g. "2026-05"
const now = new Date();
let monthStart;
if (arg) {
  monthStart = new Date(`${arg}-01T00:00:00.000Z`);
} else {
  monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

const label = monthStart.toISOString().slice(0, 7);
console.log(`\nRecalculating monthlyPoints from ${monthStart.toISOString()} (${label})\n`);

// Sum ledger rows per user for the month
const { data: rows, error: ledgerErr } = await supabase
  .from("UserPointsLedger")
  .select("userId, points")
  .gte("createdAt", monthStart.toISOString());

if (ledgerErr) { console.error("Ledger fetch failed:", ledgerErr.message); process.exit(1); }

const totals = {};
for (const row of rows ?? []) {
  totals[row.userId] = (totals[row.userId] ?? 0) + row.points;
}
console.log(`Found ${Object.keys(totals).length} users with activity since ${label}`);

// Fetch all progression rows
const { data: progressions, error: progErr } = await supabase
  .from("UserProgression")
  .select("userId, monthlyPoints");

if (progErr) { console.error("Progression fetch failed:", progErr.message); process.exit(1); }

let updated = 0;
let unchanged = 0;
const timestamp = new Date().toISOString();

for (const prog of progressions ?? []) {
  const newPts = totals[prog.userId] ?? 0;
  if (newPts === (prog.monthlyPoints ?? 0)) { unchanged++; continue; }

  const { error } = await supabase
    .from("UserProgression")
    .update({ monthlyPoints: newPts, updatedAt: timestamp })
    .eq("userId", prog.userId);

  if (error) {
    console.error(`  ✗ ${prog.userId}: ${error.message}`);
  } else {
    console.log(`  ✓ ${prog.userId}: ${prog.monthlyPoints ?? 0} → ${newPts} pts`);
    updated++;
  }
}

// Users with activity but no progression row yet — upsert them
for (const [userId, pts] of Object.entries(totals)) {
  const hasRow = (progressions ?? []).some(p => p.userId === userId);
  if (!hasRow) {
    await supabase.from("UserProgression").upsert(
      { userId, monthlyPoints: pts, updatedAt: timestamp },
      { onConflict: "userId" }
    );
    console.log(`  + ${userId}: new row at ${pts} pts`);
    updated++;
  }
}

console.log(`\nDone — ${updated} updated, ${unchanged} already correct.\n`);
