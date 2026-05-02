#!/usr/bin/env node
/**
 * Tour It — Points Backfill
 *
 * Retroactively awards points to all users for everything they've done.
 * Safe to run multiple times — skips any action already in the ledger.
 *
 * Usage:
 *   node src/scripts/backfill-points.mjs
 *   node src/scripts/backfill-points.mjs --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import dotenv from "dotenv";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");

const supabase = createClient(
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
  upload_first_for_hole:   50,
  upload_first_for_course: 100,
  add_club_to_clip:         5,
  add_wind_to_clip:         5,
  add_strategy_note:        5,
  intel_complete_bonus:     5,
  like_received:            2,
  comment_received:         3,
  follow_received:          5,
  clip_saved:               4,
  milestone_10_likes:      25,
  milestone_100_likes:    100,
  milestone_1000_likes:   500,
  unlike_received:         -2,
  unsave_received:         -4,
  upload_deleted:         -20,
};

function pointsForLevel(n) {
  if (n <= 1) return 0;
  return Math.floor(40 * Math.pow(n - 1, 1.85));
}

function computeLevel(pts) {
  let level = 1;
  for (let n = 2; n <= 100; n++) {
    if (pts >= pointsForLevel(n)) level = n;
    else break;
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
    const { data, error } = await supabase
      .from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(`fetchAll(${table}): ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== Tour It — Points Backfill${DRY_RUN ? " [DRY RUN]" : ""} ===\n`);

  // ── Load existing ledger for dedup ────────────────────────
  console.log("Loading existing ledger...");
  const existingLedger = await fetchAll(
    "UserPointsLedger",
    "id, userId, action, points, referenceId, createdAt"
  );
  const existsKey = new Set(
    existingLedger.map(r => `${r.userId}|${r.action}|${r.referenceId ?? ""}`)
  );
  console.log(`  ${existingLedger.length} existing rows\n`);

  const newRows = [];

  function award(userId, action, referenceId, createdAt) {
    const key = `${userId}|${action}|${referenceId ?? ""}`;
    if (existsKey.has(key)) return;
    existsKey.add(key); // prevent duplicates within this run
    newRows.push({
      id: randomUUID(),
      userId,
      action,
      points: PV[action] ?? 0,
      referenceId: referenceId ?? null,
      metadata: { backfill: true },
      createdAt: createdAt ?? new Date().toISOString(),
    });
  }

  // ── 1. Users: signup, complete_profile, enable_notifications ─
  console.log("Processing users...");
  const users = await fetchAll("User", "id, bio, pushSubscription, createdAt");
  for (const u of users) {
    award(u.id, "signup", null, u.createdAt);
    if (u.bio?.trim()) {
      award(u.id, "complete_profile", null, u.createdAt);
    }
    if (u.pushSubscription) {
      award(u.id, "enable_notifications", null, u.createdAt);
    }
  }
  console.log(`  ${users.length} users processed\n`);

  // ── 2. Uploads ────────────────────────────────────────────
  console.log("Processing uploads...");
  const uploads = await fetchAll(
    "Upload",
    "id, userId, courseId, holeId, clubUsed, windCondition, strategyNote, createdAt"
  );
  // Sort oldest-first so the true pioneer gets the first-upload bonuses
  uploads.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const uploadOwnerMap = new Map(uploads.map(u => [u.id, { userId: u.userId, createdAt: u.createdAt }]));
  const seenHoles   = new Set();
  const seenCourses = new Set();

  for (const up of uploads) {
    award(up.userId, "upload_clip", up.id, up.createdAt);

    if (!seenHoles.has(up.holeId)) {
      seenHoles.add(up.holeId);
      award(up.userId, "upload_first_for_hole", up.id, up.createdAt);
    }

    if (!seenCourses.has(up.courseId)) {
      seenCourses.add(up.courseId);
      award(up.userId, "upload_first_for_course", up.id, up.createdAt);
    }

    const hasClub = !!up.clubUsed?.trim();
    const hasWind = !!up.windCondition;
    const hasNote = (up.strategyNote?.trim()?.length ?? 0) >= 30;
    if (hasClub) award(up.userId, "add_club_to_clip", up.id, up.createdAt);
    if (hasWind) award(up.userId, "add_wind_to_clip", up.id, up.createdAt);
    if (hasNote) award(up.userId, "add_strategy_note", up.id, up.createdAt);
    if (hasClub && hasWind && hasNote) award(up.userId, "intel_complete_bonus", up.id, up.createdAt);
  }
  console.log(`  ${uploads.length} uploads processed\n`);

  // ── 3. Likes received ─────────────────────────────────────
  console.log("Processing likes...");
  const likes = await fetchAll("Like", "id, uploadId, createdAt");
  let likeAwards = 0;
  for (const like of likes) {
    if (!like.uploadId) continue;
    const owner = uploadOwnerMap.get(like.uploadId);
    if (!owner) continue;
    award(owner.userId, "like_received", like.id, like.createdAt);
    likeAwards++;
  }
  console.log(`  ${likeAwards} like awards\n`);

  // ── 4. Comments received ──────────────────────────────────
  console.log("Processing comments...");
  const comments = await fetchAll("Comment", "id, uploadId, userId, createdAt");
  let commentAwards = 0;
  for (const c of comments) {
    if (!c.uploadId) continue;
    const owner = uploadOwnerMap.get(c.uploadId);
    if (!owner || owner.userId === c.userId) continue; // skip self-comments
    award(owner.userId, "comment_received", c.id, c.createdAt);
    commentAwards++;
  }
  console.log(`  ${commentAwards} comment awards\n`);

  // ── 5. Follows received ───────────────────────────────────
  console.log("Processing follows...");
  const follows = await fetchAll("Follow", "id, followingId, createdAt");
  for (const f of follows) {
    award(f.followingId, "follow_received", f.id, f.createdAt);
  }
  console.log(`  ${follows.length} follow awards\n`);

  // ── 6. Clip saves ─────────────────────────────────────────
  console.log("Processing saves...");
  const saves = await fetchAll("Save", "id, uploadId, createdAt");
  let saveAwards = 0;
  for (const s of saves) {
    if (!s.uploadId) continue;
    const owner = uploadOwnerMap.get(s.uploadId);
    if (!owner) continue;
    award(owner.userId, "clip_saved", s.id, s.createdAt);
    saveAwards++;
  }
  console.log(`  ${saveAwards} save awards\n`);

  // ── 7. Like milestones ────────────────────────────────────
  console.log("Processing like milestones...");
  const totalLikesPerUser = new Map();
  for (const r of [...existingLedger, ...newRows]) {
    if (r.action === "like_received") {
      totalLikesPerUser.set(r.userId, (totalLikesPerUser.get(r.userId) ?? 0) + 1);
    }
  }
  for (const [userId, count] of totalLikesPerUser) {
    if (count >= 10)   award(userId, "milestone_10_likes",   null, null);
    if (count >= 100)  award(userId, "milestone_100_likes",  null, null);
    if (count >= 1000) award(userId, "milestone_1000_likes", null, null);
  }
  console.log(`  Checked ${totalLikesPerUser.size} users for milestones\n`);

  // ── Summary ───────────────────────────────────────────────
  console.log(`Total new awards: ${newRows.length}\n`);
  const breakdown = {};
  for (const r of newRows) {
    breakdown[r.action] = (breakdown[r.action] ?? 0) + 1;
  }
  console.table(breakdown);

  if (DRY_RUN) {
    console.log("\nDry run complete — no data written.");
    return;
  }

  if (newRows.length === 0) {
    console.log("Nothing new to insert.\n");
  } else {
    // ── 8. Insert ledger rows in chunks ─────────────────────
    console.log(`\nInserting ${newRows.length} ledger rows...`);
    const CHUNK = 500;
    for (let i = 0; i < newRows.length; i += CHUNK) {
      const chunk = newRows.slice(i, i + CHUNK);
      const { error } = await supabase.from("UserPointsLedger").insert(chunk);
      if (error) throw new Error(`Ledger insert: ${error.message}`);
      process.stdout.write(`  ${Math.min(i + CHUNK, newRows.length)}/${newRows.length}\r`);
    }
    console.log(`  ${newRows.length}/${newRows.length} — done.\n`);
  }

  // ── 9. Recompute UserProgression from full ledger ─────────
  console.log("Recomputing UserProgression...");
  const allLedger = [...existingLedger, ...newRows];
  const now       = new Date().toISOString();
  const weekStart  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const totalMap   = new Map();
  const weeklyMap  = new Map();
  const monthlyMap = new Map();

  for (const r of allLedger) {
    totalMap.set(r.userId, (totalMap.get(r.userId) ?? 0) + r.points);
    if (r.createdAt >= weekStart) {
      weeklyMap.set(r.userId, (weeklyMap.get(r.userId) ?? 0) + r.points);
    }
    if (r.createdAt >= monthStart) {
      monthlyMap.set(r.userId, (monthlyMap.get(r.userId) ?? 0) + r.points);
    }
  }

  const progRows = [];
  for (const [userId, rawTotal] of totalMap) {
    const totalPoints   = Math.max(0, rawTotal);
    const weeklyPoints  = Math.max(0, weeklyMap.get(userId)  ?? 0);
    const monthlyPoints = Math.max(0, monthlyMap.get(userId) ?? 0);
    const level = computeLevel(totalPoints);
    const rank  = computeRank(level);
    progRows.push({ id: randomUUID(), userId, totalPoints, weeklyPoints, monthlyPoints, level, rank, updatedAt: now });
  }

  const PCHUNK = 200;
  for (let i = 0; i < progRows.length; i += PCHUNK) {
    const chunk = progRows.slice(i, i + PCHUNK);
    const { error } = await supabase
      .from("UserProgression")
      .upsert(chunk, { onConflict: "userId" });
    if (error) throw new Error(`Progression upsert: ${error.message}`);
    process.stdout.write(`  ${Math.min(i + PCHUNK, progRows.length)}/${progRows.length}\r`);
  }
  console.log(`  ${progRows.length}/${progRows.length} users updated.\n`);

  console.log("=== Backfill complete ===\n");
}

main().catch(err => { console.error("\n" + err.message); process.exit(1); });
