#!/usr/bin/env node
/**
 * Full progression recalc — fixes totalPoints, monthlyPoints, level, rank
 * for every user who has ledger entries but missing/wrong progression data.
 * Run: node src/scripts/fix-all-progression.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
dotenv.config();

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAY_START = new Date("2026-05-01T00:00:00.000Z").toISOString();

// --- progression helpers (mirrors src/lib/progression.ts) ---
function pointsForLevel(n) {
  if (n <= 1) return 0;
  return Math.floor(40 * Math.pow(n - 1, 1.85));
}
function computeLevel(pts) {
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
function computeRank(level) {
  for (const t of [...RANK_TIERS].reverse()) {
    if (level >= t.min) return t.rank;
  }
  return "CADDIE";
}

// 1. Pull ALL ledger entries
console.log("Fetching full ledger…");
const { data: allRows, error: e1 } = await sb
  .from("UserPointsLedger")
  .select("userId, points, createdAt");
if (e1) { console.error(e1.message); process.exit(1); }

// 2. Sum per user: totalPoints (all time) and monthlyPoints (May 1+)
const totalMap = {};
const monthlyMap = {};
for (const row of allRows ?? []) {
  totalMap[row.userId] = (totalMap[row.userId] ?? 0) + row.points;
  if (row.createdAt >= MAY_START) {
    monthlyMap[row.userId] = (monthlyMap[row.userId] ?? 0) + row.points;
  }
}
const allUserIds = [...new Set(Object.keys(totalMap))];
console.log(`${allUserIds.length} users with ledger entries\n`);

// 3. Fetch existing progression rows
const { data: existing } = await sb.from("UserProgression").select("id, userId, totalPoints, monthlyPoints, level, rank");
const existingMap = {};
for (const p of existing ?? []) existingMap[p.userId] = p;

// 4. Upsert every user with correct values
const now = new Date().toISOString();
let fixed = 0, skipped = 0;

for (const userId of allUserIds) {
  const total   = Math.max(0, totalMap[userId] ?? 0);
  const monthly = Math.max(0, monthlyMap[userId] ?? 0);
  const level   = computeLevel(total);
  const rank    = computeRank(level);

  const cur = existingMap[userId];
  if (
    cur &&
    cur.totalPoints === total &&
    cur.monthlyPoints === monthly &&
    cur.level === level &&
    cur.rank === rank
  ) {
    skipped++;
    continue;
  }

  const id = cur?.id ?? randomUUID();
  const { error } = await sb.from("UserProgression").upsert(
    { id, userId, totalPoints: total, monthlyPoints: monthly, level, rank, updatedAt: now },
    { onConflict: "userId" }
  );

  if (error) {
    console.error(`  ✗ ${userId}: ${error.message}`);
  } else {
    const prev = cur ? `${cur.totalPoints}/${cur.monthlyPoints}` : "none";
    console.log(`  ✓ ${userId}  total: ${prev.split("/")[0] ?? "—"} → ${total}  monthly: ${prev.split("/")[1] ?? "—"} → ${monthly}  lvl ${level} ${rank}`);
    fixed++;
  }
}

console.log(`\nDone — ${fixed} fixed, ${skipped} already correct.\n`);
