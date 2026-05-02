#!/usr/bin/env node
/**
 * Tour It — Badge Backfill
 *
 * Retroactively awards badges to all users based on historical data.
 * Safe to run multiple times — skips badges already earned.
 *
 * Usage:
 *   node src/scripts/backfill-badges.mjs
 *   node src/scripts/backfill-badges.mjs --dry-run
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

async function main() {
  console.log(`\n=== Tour It — Badge Backfill${DRY_RUN ? " [DRY RUN]" : ""} ===\n`);

  // ── Load badge catalog ────────────────────────────────────
  console.log("Loading badge catalog...");
  const badges = await fetchAll("Badge", "id, slug, name");
  const badgeBySlug = new Map(badges.map(b => [b.slug, b]));
  console.log(`  ${badges.length} badges in catalog\n`);

  // ── Load existing UserBadge rows for dedup ────────────────
  console.log("Loading existing user badges...");
  const existing = await fetchAll("UserBadge", "userId, badgeId");
  const existsKey = new Set(existing.map(r => `${r.userId}|${r.badgeId}`));
  console.log(`  ${existing.length} already awarded\n`);

  const toAward = [];

  function queue(userId, slug, earnedAt) {
    const badge = badgeBySlug.get(slug);
    if (!badge) { console.warn(`  ⚠ No badge in catalog for slug "${slug}"`); return; }
    const key = `${userId}|${badge.id}`;
    if (existsKey.has(key)) return;
    existsKey.add(key);
    toAward.push({ id: randomUUID(), userId, badgeId: badge.id, awardedAt: earnedAt ?? new Date().toISOString() });
  }

  // ── Load source data ──────────────────────────────────────
  console.log("Loading users...");
  const users = await fetchAll("User", "id, createdAt");
  console.log(`  ${users.length} users\n`);

  console.log("Loading uploads...");
  const uploads = await fetchAll("Upload", "id, userId, courseId, likeCount, createdAt");
  uploads.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  console.log(`  ${uploads.length} uploads\n`);

  console.log("Loading follows...");
  const follows = await fetchAll("Follow", "id, followingId, status, createdAt");
  console.log(`  ${follows.length} follows\n`);

  console.log("Loading course contributions...");
  const contributions = await fetchAll("CourseContribution", "userId, courseId, firstUploadAt");
  console.log(`  ${contributions.length} course contributions\n`);

  console.log("Loading points ledger (pioneer actions)...");
  const ledger = await fetchAll("UserPointsLedger", "userId, action, createdAt");
  console.log(`  ${ledger.length} ledger rows\n`);

  // ── Build per-user lookup tables ──────────────────────────
  // Upload counts per user
  const uploadCountByUser = new Map();
  const uploadsByUser = new Map();
  for (const up of uploads) {
    uploadCountByUser.set(up.userId, (uploadCountByUser.get(up.userId) ?? 0) + 1);
    if (!uploadsByUser.has(up.userId)) uploadsByUser.set(up.userId, []);
    uploadsByUser.get(up.userId).push(up);
  }

  // Course contribution counts per user
  const courseCountByUser = new Map();
  for (const c of contributions) {
    courseCountByUser.set(c.userId, (courseCountByUser.get(c.userId) ?? 0) + 1);
  }

  // Follower counts per user (active only)
  const followerCountByUser = new Map();
  for (const f of follows) {
    if (f.status !== "ACTIVE") continue;
    followerCountByUser.set(f.followingId, (followerCountByUser.get(f.followingId) ?? 0) + 1);
  }

  // Pioneer flags from ledger
  const hasPioneerCourse = new Set(ledger.filter(r => r.action === "upload_first_for_course").map(r => r.userId));
  const hasPioneerHole   = new Set(ledger.filter(r => r.action === "upload_first_for_hole").map(r => r.userId));

  // ── Evaluate badges for every user ───────────────────────
  console.log("Evaluating badges...");

  for (const user of users) {
    const uid = user.id;
    const userUploads = uploadsByUser.get(uid) ?? [];
    const uploadCount = uploadCountByUser.get(uid) ?? 0;
    const courseCount = courseCountByUser.get(uid) ?? 0;
    const followerCount = followerCountByUser.get(uid) ?? 0;

    // ── Clip count badges ──────────────────────────────────
    // Use the timestamp of the qualifying upload as the earnedAt date
    const sortedUploads = [...userUploads].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (uploadCount >= 1)   queue(uid, "first_clip",  sortedUploads[0]?.createdAt);
    if (uploadCount >= 5)   queue(uid, "5_clips",     sortedUploads[4]?.createdAt);
    if (uploadCount >= 10)  queue(uid, "10_clips",    sortedUploads[9]?.createdAt);
    if (uploadCount >= 25)  queue(uid, "25_clips",    sortedUploads[24]?.createdAt);
    if (uploadCount >= 50)  queue(uid, "50_clips",    sortedUploads[49]?.createdAt);
    if (uploadCount >= 100) queue(uid, "100_clips",   sortedUploads[99]?.createdAt);

    // ── Course explorer badges ─────────────────────────────
    if (courseCount >= 5)  queue(uid, "5_courses",  null);
    if (courseCount >= 10) queue(uid, "10_courses", null);
    if (courseCount >= 25) queue(uid, "25_courses", null);

    // ── Pioneer badges ─────────────────────────────────────
    if (hasPioneerCourse.has(uid)) queue(uid, "course_pioneer",   null);
    if (hasPioneerHole.has(uid))   queue(uid, "hole_trailblazer", null);

    // ── Popular clip badges (check each upload's likeCount) ─
    let popularEarnedAt = null, viralEarnedAt = null, legendaryEarnedAt = null;
    for (const up of userUploads) {
      if (up.likeCount >= 10  && !popularEarnedAt)   popularEarnedAt   = up.createdAt;
      if (up.likeCount >= 100 && !viralEarnedAt)     viralEarnedAt     = up.createdAt;
      if (up.likeCount >= 1000 && !legendaryEarnedAt) legendaryEarnedAt = up.createdAt;
    }
    if (popularEarnedAt)   queue(uid, "popular_clip",   popularEarnedAt);
    if (viralEarnedAt)     queue(uid, "viral_clip",     viralEarnedAt);
    if (legendaryEarnedAt) queue(uid, "legendary_clip", legendaryEarnedAt);

    // ── Follower badges ────────────────────────────────────
    if (followerCount >= 10)  queue(uid, "10_followers",  null);
    if (followerCount >= 100) queue(uid, "100_followers", null);
  }

  // ── Summary ───────────────────────────────────────────────
  console.log(`\nTotal new badges to award: ${toAward.length}\n`);
  const breakdown = {};
  for (const r of toAward) {
    const slug = [...badgeBySlug.entries()].find(([, b]) => b.id === r.badgeId)?.[0] ?? r.badgeId;
    breakdown[slug] = (breakdown[slug] ?? 0) + 1;
  }
  console.table(breakdown);

  if (DRY_RUN) {
    console.log("\nDry run complete — no data written.");
    return;
  }

  if (toAward.length === 0) {
    console.log("Nothing new to award.\n");
    return;
  }

  // ── Insert in chunks ──────────────────────────────────────
  console.log(`\nInserting ${toAward.length} UserBadge rows...`);
  const CHUNK = 500;
  for (let i = 0; i < toAward.length; i += CHUNK) {
    const chunk = toAward.slice(i, i + CHUNK);
    const { error } = await supabase.from("UserBadge").insert(chunk);
    if (error) throw new Error(`UserBadge insert: ${error.message}`);
    process.stdout.write(`  ${Math.min(i + CHUNK, toAward.length)}/${toAward.length}\r`);
  }
  console.log(`  ${toAward.length}/${toAward.length} — done.\n`);
  console.log("=== Badge backfill complete ===\n");
}

main().catch(err => { console.error("\n" + err.message); process.exit(1); });
