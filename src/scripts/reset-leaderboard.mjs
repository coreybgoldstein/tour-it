// reset-leaderboard.mjs
// Snapshots then resets weekly / monthly points on UserProgression.
//
// Usage (Windows Task Scheduler):
//   Weekly  (every Sunday midnight):  node reset-leaderboard.mjs --weekly
//   Monthly (1st of month midnight):  node reset-leaderboard.mjs --monthly
//   Both at once (first Sun of month): node reset-leaderboard.mjs --both

import "dotenv/config";
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;
const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, idleTimeoutMillis: 10000 });

const doWeekly  = process.argv.includes("--weekly")  || process.argv.includes("--both");
const doMonthly = process.argv.includes("--monthly") || process.argv.includes("--both");

if (!doWeekly && !doMonthly) {
  console.error("Usage: node reset-leaderboard.mjs [--weekly] [--monthly] [--both]");
  process.exit(1);
}

async function snapshot(client, period, periodStart, periodEnd, sortField) {
  const { rows } = await client.query(`
    SELECT "userId", "${sortField}" AS points, level,
           ROW_NUMBER() OVER (ORDER BY "${sortField}" DESC) AS rank
    FROM "UserProgression"
    WHERE "${sortField}" > 0
    LIMIT 200
  `);
  if (!rows.length) return 0;

  const values = rows.map(r =>
    `('${crypto.randomUUID()}','${period}','${periodStart}','${periodEnd}','${r.userId}',${r.rank},${r.points},${r.level},NOW())`
  ).join(",");

  await client.query(`
    INSERT INTO "LeaderboardSnapshot"
      (id, period, "periodStart", "periodEnd", "userId", rank, points, level, "createdAt")
    VALUES ${values}
  `);
  return rows.length;
}

async function run() {
  const now = new Date();
  const client = await db.connect();

  try {
    if (doWeekly) {
      const end   = now.toISOString();
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const n = await snapshot(client, "WEEKLY", start, end, "weeklyPoints");
      await client.query(`UPDATE "UserProgression" SET "weeklyPoints" = 0, "weekReset" = NOW()`);
      console.log(`[weekly]  snapshotted ${n} entries, reset complete.`);
    }

    if (doMonthly) {
      const end   = now.toISOString();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const n = await snapshot(client, "MONTHLY", start, end, "monthlyPoints");
      await client.query(`UPDATE "UserProgression" SET "monthlyPoints" = 0, "monthReset" = NOW()`);
      console.log(`[monthly] snapshotted ${n} entries, reset complete.`);
    }
  } finally {
    client.release();
    await db.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
