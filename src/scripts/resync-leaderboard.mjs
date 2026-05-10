#!/usr/bin/env node

/**
 * Local mirror of /api/admin/resync-points — recomputes UserPointsLedger
 * from source events (uploads, likes, comments, follows, rounds, milestones,
 * referrals) and writes UserProgression.totalPoints / weeklyPoints /
 * monthlyPoints / level / rank from the resulting ledger.
 *
 * Why local: production endpoint is gated by CRON_SECRET (Vercel-only). This
 * script uses SUPABASE_SERVICE_ROLE_KEY directly so we can run it from a dev
 * machine without round-tripping through the deployed API.
 *
 * Use this when monthly/all-time leaderboard numbers look stale.
 *
 * Usage: node src/scripts/resync-leaderboard.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import dotenv from "dotenv";

dotenv.config();

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
    if (error) throw new Error(`fetchAll(${table}): ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function calcIntelBonus(club, wind, note) {
  const filled = [club, wind, note].filter(v => v && String(v).trim().length > 0).length;
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

async function main() {
  console.log("\n🏅  Tour It — Resync leaderboard (May + All-time)");
  console.log("==================================================\n");

  // ── Existing ledger (dedup key: userId|action|referenceId) ────────────────
  console.log("Loading existing ledger…");
  const existingLedger = await fetchAll("UserPointsLedger", "id, userId, action, referenceId, points, createdAt");
  const existsKey = new Set(existingLedger.map((r) => `${r.userId}|${r.action}|${r.referenceId ?? ""}`));
  console.log(`  ${existingLedger.length} existing rows`);

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

  // 1. Users
  console.log("Loading users…");
  const users = await fetchAll("User", "id, bio, pushSubscription, createdAt");
  for (const u of users) {
    award(u.id, "signup", null, 50, u.createdAt);
    if (u.bio?.trim()) award(u.id, "complete_profile", null, 25, u.createdAt);
    if (u.pushSubscription) award(u.id, "enable_notifications", null, 10, u.createdAt);
  }

  // 2. Uploads
  console.log("Loading uploads…");
  const uploads = await fetchAll("Upload", "id, userId, courseId, seriesId, seriesOrder, clubUsed, windCondition, strategyNote, createdAt");
  uploads.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const uploadOwnerMap = new Map();
  const seenCourses = new Set();
  const seenSeries = new Set();
  for (const up of uploads) {
    uploadOwnerMap.set(up.id, { userId: up.userId, createdAt: up.createdAt });
    award(up.userId, "upload_clip", up.id, 20, up.createdAt);
    if (!seenCourses.has(up.courseId)) {
      seenCourses.add(up.courseId);
      award(up.userId, "upload_first_for_course", up.id, 100, up.createdAt);
    }
    const bonus = calcIntelBonus(up.clubUsed, up.windCondition, up.strategyNote);
    if (bonus > 0) award(up.userId, "intel_bonus", up.id, bonus, up.createdAt);
    if (up.seriesId && !seenSeries.has(up.seriesId)) {
      seenSeries.add(up.seriesId);
      award(up.userId, "upload_series", up.seriesId, 30, up.createdAt);
    }
  }

  // 3. Likes received
  console.log("Loading likes…");
  const likes = await fetchAll("Like", "id, uploadId, createdAt");
  for (const like of likes) {
    if (!like.uploadId) continue;
    const owner = uploadOwnerMap.get(like.uploadId);
    if (!owner) continue;
    award(owner.userId, "like_received", like.id, 2, like.createdAt);
  }

  // 4. Comments received
  console.log("Loading comments…");
  const comments = await fetchAll("Comment", "id, uploadId, userId, createdAt");
  for (const c of comments) {
    if (!c.uploadId) continue;
    const owner = uploadOwnerMap.get(c.uploadId);
    if (!owner || owner.userId === c.userId) continue;
    award(owner.userId, "comment_received", c.id, 3, c.createdAt);
  }

  // 5. Follows received
  console.log("Loading follows…");
  const follows = await fetchAll("Follow", "id, followingId, followerId, status, createdAt");
  for (const f of follows) {
    if (f.status && f.status !== "ACTIVE") continue;
    award(f.followingId, "follow_received", f.id, 5, f.createdAt);
  }

  // 6. Rounds
  console.log("Loading rounds…");
  const rounds = await fetchAll("Round", "id, userId, createdAt");
  rounds.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const hadFirstRound = new Set(
    existingLedger.filter((r) => r.action === "log_first_round").map((r) => r.userId)
  );
  for (const rnd of rounds) {
    if (!hadFirstRound.has(rnd.userId)) {
      award(rnd.userId, "log_first_round", rnd.id, 25, rnd.createdAt);
      hadFirstRound.add(rnd.userId);
    }
    award(rnd.userId, "log_complete_round", rnd.id, 15, rnd.createdAt);
  }

  // 7. Like milestones
  const likeCountPerUser = new Map();
  for (const r of [...existingLedger, ...newRows]) {
    if (r.action === "like_received") {
      likeCountPerUser.set(r.userId, (likeCountPerUser.get(r.userId) ?? 0) + 1);
    }
  }
  for (const [userId, count] of likeCountPerUser) {
    if (count >= 10)   award(userId, "milestone_10_likes",   null, 25,  null);
    if (count >= 100)  award(userId, "milestone_100_likes",  null, 100, null);
    if (count >= 1000) award(userId, "milestone_1000_likes", null, 500, null);
  }

  // 8. Referrals
  console.log("Loading referrals…");
  const referrals = await fetchAll("Referral", "id, inviterId, status, signupAt, firstUploadAt");
  for (const ref of referrals) {
    if (ref.status === "VOID" || !ref.inviterId) continue;
    if (ref.signupAt && ["SIGNED_UP", "FIRST_UPLOAD"].includes(ref.status)) {
      award(ref.inviterId, "referral_signup", ref.id, 50, ref.signupAt);
    }
    if (ref.status === "FIRST_UPLOAD" && ref.firstUploadAt) {
      award(ref.inviterId, "referral_first_upload", ref.id, 25, ref.firstUploadAt);
    }
  }

  // 9. Trips, games, Ryder Cup activations
  console.log("Loading trips & games…");
  const trips = await fetchAll("GolfTrip", "id, createdBy, ryderCupEnabled, createdAt, updatedAt");
  for (const t of trips) {
    if (t.createdBy) award(t.createdBy, "create_trip", t.id, 50, t.createdAt);
    if (t.ryderCupEnabled && t.createdBy) award(t.createdBy, "enable_ryder_cup", t.id, 15, t.updatedAt ?? t.createdAt);
  }
  const games = await fetchAll("TripGame", "id, createdBy, createdAt");
  for (const g of games) {
    if (g.createdBy) award(g.createdBy, "create_game", g.id, 15, g.createdAt);
  }

  // ── Insert any new ledger rows ────────────────────────────────────────────
  const breakdown = {};
  for (const r of newRows) breakdown[r.action] = (breakdown[r.action] ?? 0) + 1;
  console.log(`\n+ ${newRows.length} new ledger rows to insert`);
  if (Object.keys(breakdown).length) {
    Object.entries(breakdown).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    ${k}: ${v}`));
  }

  if (newRows.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < newRows.length; i += CHUNK) {
      const { error } = await sb.from("UserPointsLedger").insert(newRows.slice(i, i + CHUNK));
      if (error) throw new Error(`Ledger insert: ${error.message}`);
    }
    console.log("✅ Ledger updated");
  }

  // ── Recompute UserProgression totals from full ledger ─────────────────────
  console.log("\nRecomputing UserProgression…");
  const allLedger = [...existingLedger, ...newRows];
  const now = new Date();
  const weekStart  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const totalMap   = new Map();
  const weeklyMap  = new Map();
  const monthlyMap = new Map();

  for (const r of allLedger) {
    totalMap.set(r.userId, (totalMap.get(r.userId) ?? 0) + r.points);
    if (r.createdAt >= weekStart)  weeklyMap.set(r.userId,  (weeklyMap.get(r.userId)  ?? 0) + r.points);
    if (r.createdAt >= monthStart) monthlyMap.set(r.userId, (monthlyMap.get(r.userId) ?? 0) + r.points);
  }

  const { data: existingProg } = await sb.from("UserProgression").select("id, userId");
  const existingProgMap = new Map((existingProg ?? []).map((p) => [p.userId, p.id]));

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
  for (let i = 0; i < progRows.length; i += PCHUNK) {
    const { error } = await sb.from("UserProgression").upsert(progRows.slice(i, i + PCHUNK), { onConflict: "userId" });
    if (error) throw new Error(`Progression upsert: ${error.message}`);
  }
  console.log(`✅ ${progRows.length} users resynced`);

  // ── Top of board ──────────────────────────────────────────────────────────
  const { data: top10All } = await sb
    .from("UserProgression")
    .select("userId, totalPoints, monthlyPoints, level, rank, user:userId(displayName, username)")
    .order("totalPoints", { ascending: false })
    .limit(10);
  const { data: top10Month } = await sb
    .from("UserProgression")
    .select("userId, monthlyPoints, level, rank, user:userId(displayName, username)")
    .gt("monthlyPoints", 0)
    .order("monthlyPoints", { ascending: false })
    .limit(10);

  console.log("\n=== Top 10 — All Time ===");
  top10All?.forEach((r, i) => {
    const name = r.user?.displayName || r.user?.username || r.userId.slice(0, 8);
    console.log(`  ${String(i + 1).padStart(2)}. ${name.padEnd(28)} ${String(r.totalPoints).padStart(6)} pts  L${r.level} ${r.rank}`);
  });

  console.log(`\n=== Top 10 — May (since ${monthStart.slice(0, 10)}) ===`);
  if (!top10Month?.length) {
    console.log("  (no users with monthly points yet)");
  } else {
    top10Month.forEach((r, i) => {
      const name = r.user?.displayName || r.user?.username || r.userId.slice(0, 8);
      console.log(`  ${String(i + 1).padStart(2)}. ${name.padEnd(28)} ${String(r.monthlyPoints).padStart(6)} pts  L${r.level} ${r.rank}`);
    });
  }

  console.log("\nDone.\n");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
