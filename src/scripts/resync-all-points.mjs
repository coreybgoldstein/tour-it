#!/usr/bin/env node
/**
 * Tour It — Full Points Resync
 *
 * 1. Backfills any missing ledger entries for historical activity using
 *    current action names (safe to re-run — skips already-present entries).
 * 2. Resyncs UserProgression (totalPoints, weeklyPoints, monthlyPoints,
 *    level, rank) from the complete ledger.
 *
 * Usage:
 *   node src/scripts/resync-all-points.mjs
 *   node src/scripts/resync-all-points.mjs --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
dotenv.config();

const DRY = process.argv.includes("--dry-run");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Point values (mirrors src/config/points-system.ts) ───────────────────────
const PV = {
  signup:                  50,
  complete_profile:        25,
  enable_notifications:    10,
  upload_clip:             20,
  upload_first_for_course: 100,
  intel_bonus:              0, // variable — computed per upload
  like_received:            2,
  comment_received:         3,
  follow_received:          5,
  milestone_10_likes:      25,
  milestone_100_likes:    100,
  milestone_1000_likes:   500,
};

function calcIntelBonus(club, wind, strategyNote) {
  const filled = [club, wind, strategyNote].filter(v => v && v.trim().length > 0).length;
  if (filled === 0) return 0;
  return Math.ceil((filled / 3) * 10);
}

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
  return RANK_TIERS.find(t => level >= t.min && level <= t.max)?.rank ?? "LEGEND";
}

async function fetchAll(table, columns) {
  const PAGE = 1000;
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(`fetchAll(${table}): ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log(`\n=== Tour It — Full Points Resync${DRY ? " [DRY RUN]" : ""} ===\n`);

// ── Load existing ledger ──────────────────────────────────────────────────────
console.log("Loading existing ledger…");
const existing = await fetchAll("UserPointsLedger", "userId, action, points, referenceId, createdAt");
// Dedup key: userId|action|referenceId  (same as backfill-points.mjs)
const existsKey = new Set(existing.map(r => `${r.userId}|${r.action}|${r.referenceId ?? ""}`));
console.log(`  ${existing.length} existing rows\n`);

const newRows = [];

function award(userId, action, referenceId, points, createdAt) {
  const key = `${userId}|${action}|${referenceId ?? ""}`;
  if (existsKey.has(key)) return;
  existsKey.add(key);
  newRows.push({
    id: randomUUID(),
    userId,
    action,
    points,
    referenceId: referenceId ?? null,
    metadata: { backfill: true },
    createdAt: createdAt ?? new Date().toISOString(),
  });
}

// ── 1. Users ──────────────────────────────────────────────────────────────────
console.log("Processing users…");
const users = await fetchAll("User", "id, bio, pushSubscription, createdAt");
for (const u of users) {
  award(u.id, "signup",               null, PV.signup,               u.createdAt);
  if (u.bio?.trim())       award(u.id, "complete_profile",    null, PV.complete_profile,    u.createdAt);
  if (u.pushSubscription)  award(u.id, "enable_notifications", null, PV.enable_notifications, u.createdAt);
}
console.log(`  ${users.length} users\n`);

// ── 2. Uploads ────────────────────────────────────────────────────────────────
console.log("Processing uploads…");
const uploads = await fetchAll(
  "Upload",
  "id, userId, courseId, clubUsed, windCondition, strategyNote, createdAt"
);
uploads.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

const uploadOwnerMap = new Map(uploads.map(u => [u.id, { userId: u.userId, createdAt: u.createdAt }]));
const seenCourses = new Set();

for (const up of uploads) {
  award(up.userId, "upload_clip", up.id, PV.upload_clip, up.createdAt);

  if (!seenCourses.has(up.courseId)) {
    seenCourses.add(up.courseId);
    award(up.userId, "upload_first_for_course", up.id, PV.upload_first_for_course, up.createdAt);
  }

  const bonus = calcIntelBonus(up.clubUsed, up.windCondition, up.strategyNote);
  if (bonus > 0) {
    award(up.userId, "intel_bonus", up.id, bonus, up.createdAt);
  }
}
console.log(`  ${uploads.length} uploads\n`);

// ── 3. Likes received ─────────────────────────────────────────────────────────
console.log("Processing likes…");
const likes = await fetchAll("Like", "id, uploadId, createdAt");
for (const like of likes) {
  if (!like.uploadId) continue;
  const owner = uploadOwnerMap.get(like.uploadId);
  if (!owner) continue;
  award(owner.userId, "like_received", like.id, PV.like_received, like.createdAt);
}
console.log(`  ${likes.length} likes\n`);

// ── 4. Comments received ──────────────────────────────────────────────────────
console.log("Processing comments…");
const comments = await fetchAll("Comment", "id, uploadId, userId, createdAt");
for (const c of comments) {
  if (!c.uploadId) continue;
  const owner = uploadOwnerMap.get(c.uploadId);
  if (!owner || owner.userId === c.userId) continue;
  award(owner.userId, "comment_received", c.id, PV.comment_received, c.createdAt);
}
console.log(`  ${comments.length} comments\n`);

// ── 5. Follows received ───────────────────────────────────────────────────────
console.log("Processing follows…");
const follows = await fetchAll("Follow", "id, followingId, followerId, status, createdAt");
for (const f of follows) {
  if (f.status && f.status !== "ACTIVE") continue;
  award(f.followingId, "follow_received", f.id, PV.follow_received, f.createdAt);
}
console.log(`  ${follows.length} follows\n`);

// ── 6. Like milestones (one-time) ─────────────────────────────────────────────
console.log("Processing like milestones…");
const likeCountPerUser = new Map();
for (const r of [...existing, ...newRows]) {
  if (r.action === "like_received") {
    likeCountPerUser.set(r.userId, (likeCountPerUser.get(r.userId) ?? 0) + 1);
  }
}
for (const [userId, count] of likeCountPerUser) {
  if (count >= 10)   award(userId, "milestone_10_likes",   null, PV.milestone_10_likes,   null);
  if (count >= 100)  award(userId, "milestone_100_likes",  null, PV.milestone_100_likes,  null);
  if (count >= 1000) award(userId, "milestone_1000_likes", null, PV.milestone_1000_likes, null);
}
console.log(`  ${likeCountPerUser.size} users checked\n`);

// ── Summary ───────────────────────────────────────────────────────────────────
const breakdown = {};
for (const r of newRows) breakdown[r.action] = (breakdown[r.action] ?? 0) + 1;
console.log(`New ledger rows to add: ${newRows.length}`);
if (newRows.length > 0) console.table(breakdown);

if (DRY) {
  console.log("\nDry run — no data written.\n");
  process.exit(0);
}

// ── Insert new ledger rows ────────────────────────────────────────────────────
if (newRows.length > 0) {
  console.log(`\nInserting ${newRows.length} ledger rows…`);
  const CHUNK = 500;
  for (let i = 0; i < newRows.length; i += CHUNK) {
    const { error } = await sb.from("UserPointsLedger").insert(newRows.slice(i, i + CHUNK));
    if (error) throw new Error(`Ledger insert: ${error.message}`);
    process.stdout.write(`  ${Math.min(i + CHUNK, newRows.length)}/${newRows.length}\r`);
  }
  console.log(`  Done.\n`);
}

// ── Resync UserProgression from complete ledger ────────────────────────────────
console.log("Resyncing UserProgression from ledger…");
const allLedger = [...existing, ...newRows];

const now = new Date();
const weekStart  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

const totalMap   = new Map();
const weeklyMap  = new Map();
const monthlyMap = new Map();

for (const r of allLedger) {
  totalMap.set(r.userId, (totalMap.get(r.userId) ?? 0) + r.points);
  if (r.createdAt >= weekStart)  weeklyMap.set(r.userId, (weeklyMap.get(r.userId) ?? 0) + r.points);
  if (r.createdAt >= monthStart) monthlyMap.set(r.userId, (monthlyMap.get(r.userId) ?? 0) + r.points);
}

const { data: existingProg } = await sb.from("UserProgression").select("id, userId");
const existingProgMap = new Map((existingProg ?? []).map(p => [p.userId, p.id]));

const progRows = [];
for (const [userId, rawTotal] of totalMap) {
  const totalPoints   = Math.max(0, rawTotal);
  const weeklyPoints  = Math.max(0, weeklyMap.get(userId)  ?? 0);
  const monthlyPoints = Math.max(0, monthlyMap.get(userId) ?? 0);
  const level = computeLevel(totalPoints);
  const rank  = computeRank(level);
  const id    = existingProgMap.get(userId) ?? randomUUID();
  progRows.push({ id, userId, totalPoints, weeklyPoints, monthlyPoints, level, rank, updatedAt: now.toISOString() });
}

const PCHUNK = 200;
let progUpdated = 0;
for (let i = 0; i < progRows.length; i += PCHUNK) {
  const { error } = await sb
    .from("UserProgression")
    .upsert(progRows.slice(i, i + PCHUNK), { onConflict: "userId" });
  if (error) throw new Error(`Progression upsert: ${error.message}`);
  progUpdated += Math.min(PCHUNK, progRows.length - i);
  process.stdout.write(`  ${progUpdated}/${progRows.length}\r`);
}
console.log(`  ${progRows.length} users synced.\n`);

console.log("=== Resync complete ===\n");
