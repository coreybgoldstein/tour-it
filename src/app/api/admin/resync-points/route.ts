import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function fetchAll(sb: ReturnType<typeof serviceClient>, table: string, columns: string) {
  const PAGE = 1000;
  const all: any[] = [];
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

function calcIntelBonus(club: any, wind: any, note: any): number {
  const filled = [club, wind, note].filter(v => v && String(v).trim().length > 0).length;
  if (filled === 0) return 0;
  return Math.ceil((filled / 3) * 10);
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
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = serviceClient();

  // ── Load existing ledger (dedup key: userId|action|referenceId) ──────────────
  const existingLedger = await fetchAll(sb, "UserPointsLedger", "id, userId, action, referenceId, points, createdAt");
  const existsKey = new Set(existingLedger.map((r: any) => `${r.userId}|${r.action}|${r.referenceId ?? ""}`));

  const newRows: any[] = [];

  function award(userId: string, action: string, referenceId: string | null, points: number, createdAt: string | null) {
    const key = `${userId}|${action}|${referenceId ?? ""}`;
    if (existsKey.has(key)) return;
    existsKey.add(key);
    newRows.push({
      id: crypto.randomUUID(),
      userId,
      action,
      points,
      referenceId: referenceId ?? null,
      metadata: { backfill: true },
      createdAt: createdAt ?? new Date().toISOString(),
    });
  }

  // ── 1. Users: signup + profile + notifications ────────────────────────────────
  const users = await fetchAll(sb, "User", "id, bio, pushSubscription, createdAt");
  for (const u of users) {
    award(u.id, "signup", null, 50, u.createdAt);
    if (u.bio?.trim()) award(u.id, "complete_profile", null, 25, u.createdAt);
    if (u.pushSubscription) award(u.id, "enable_notifications", null, 10, u.createdAt);
  }

  // ── 2. Uploads: clip + first-for-course + intel + series ─────────────────────
  const uploads = await fetchAll(sb, "Upload", "id, userId, courseId, seriesId, seriesOrder, clubUsed, windCondition, strategyNote, createdAt");
  uploads.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const uploadOwnerMap = new Map<string, { userId: string; createdAt: string }>();
  const seenCourses = new Set<string>();
  const seenSeries = new Set<string>();

  for (const up of uploads) {
    uploadOwnerMap.set(up.id, { userId: up.userId, createdAt: up.createdAt });
    award(up.userId, "upload_clip", up.id, 20, up.createdAt);

    if (!seenCourses.has(up.courseId)) {
      seenCourses.add(up.courseId);
      award(up.userId, "upload_first_for_course", up.id, 100, up.createdAt);
    }

    const bonus = calcIntelBonus(up.clubUsed, up.windCondition, up.strategyNote);
    if (bonus > 0) award(up.userId, "intel_bonus", up.id, bonus, up.createdAt);

    // First upload in each series earns the series bonus (30 pts)
    if (up.seriesId && !seenSeries.has(up.seriesId)) {
      seenSeries.add(up.seriesId);
      award(up.userId, "upload_series", up.seriesId, 30, up.createdAt);
    }
  }

  // ── 3. Likes received ─────────────────────────────────────────────────────────
  const likes = await fetchAll(sb, "Like", "id, uploadId, createdAt");
  for (const like of likes) {
    if (!like.uploadId) continue;
    const owner = uploadOwnerMap.get(like.uploadId);
    if (!owner) continue;
    award(owner.userId, "like_received", like.id, 2, like.createdAt);
  }

  // ── 4. Comments received ──────────────────────────────────────────────────────
  const comments = await fetchAll(sb, "Comment", "id, uploadId, userId, createdAt");
  for (const c of comments) {
    if (!c.uploadId) continue;
    const owner = uploadOwnerMap.get(c.uploadId);
    if (!owner || owner.userId === c.userId) continue;
    award(owner.userId, "comment_received", c.id, 3, c.createdAt);
  }

  // ── 5. Follows received ───────────────────────────────────────────────────────
  const follows = await fetchAll(sb, "Follow", "id, followingId, followerId, status, createdAt");
  for (const f of follows) {
    if (f.status && f.status !== "ACTIVE") continue;
    award(f.followingId, "follow_received", f.id, 5, f.createdAt);
  }

  // ── 6. Rounds: first-ever + each complete round ───────────────────────────────
  const rounds = await fetchAll(sb, "Round", "id, userId, createdAt");
  rounds.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const hadFirstRound = new Set<string>(
    existingLedger.filter((r: any) => r.action === "log_first_round").map((r: any) => r.userId)
  );
  for (const rnd of rounds) {
    if (!hadFirstRound.has(rnd.userId)) {
      award(rnd.userId, "log_first_round", rnd.id, 25, rnd.createdAt);
      hadFirstRound.add(rnd.userId);
    }
    award(rnd.userId, "log_complete_round", rnd.id, 15, rnd.createdAt);
  }

  // ── 7. Like milestones (one-time) ─────────────────────────────────────────────
  const likeCountPerUser = new Map<string, number>();
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

  // ── 8. Referrals ─────────────────────────────────────────────────────────────
  const referrals = await fetchAll(sb, "Referral", "id, inviterId, status, signupAt, firstUploadAt");
  for (const ref of referrals) {
    if (ref.status === "VOID" || !ref.inviterId) continue;
    if (ref.signupAt && ["SIGNED_UP", "FIRST_UPLOAD"].includes(ref.status)) {
      award(ref.inviterId, "referral_signup", ref.id, 50, ref.signupAt);
    }
    if (ref.status === "FIRST_UPLOAD" && ref.firstUploadAt) {
      award(ref.inviterId, "referral_first_upload", ref.id, 25, ref.firstUploadAt);
    }
  }

  // ── Insert new ledger rows ────────────────────────────────────────────────────
  const breakdown: Record<string, number> = {};
  for (const r of newRows) breakdown[r.action] = (breakdown[r.action] ?? 0) + 1;

  if (newRows.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < newRows.length; i += CHUNK) {
      const { error } = await sb.from("UserPointsLedger").insert(newRows.slice(i, i + CHUNK));
      if (error) return NextResponse.json({ error: `Ledger insert: ${error.message}` }, { status: 500 });
    }
  }

  // ── Resync UserProgression from the complete ledger ───────────────────────────
  const allLedger = [...existingLedger, ...newRows];
  const now = new Date();
  const weekStart  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

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
    progRows.push({ id, userId, totalPoints, weeklyPoints, monthlyPoints, level, rank, updatedAt: now.toISOString() });
  }

  const PCHUNK = 200;
  for (let i = 0; i < progRows.length; i += PCHUNK) {
    const { error } = await sb.from("UserProgression").upsert(progRows.slice(i, i + PCHUNK), { onConflict: "userId" });
    if (error) return NextResponse.json({ error: `Progression upsert: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    newLedgerRows: newRows.length,
    usersResynced: progRows.length,
    breakdown,
  });
}
