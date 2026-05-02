"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { levelProgress, rankLabel } from "@/lib/progression";
import { MAX_LEVEL, RANK_TIERS, pointsForLevel } from "@/config/points-system";

type Prog = {
  totalPoints: number;
  level: number;
  rank: string;
  streakWeeks: number;
};

const RANK_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  CADDIE:     { bg: "rgba(150,150,150,0.12)", color: "rgba(210,210,210,0.85)", border: "rgba(180,180,180,0.25)" },
  LOCAL:      { bg: "rgba(45,212,191,0.12)",   color: "#2dd4bf",                border: "rgba(45,212,191,0.35)" },
  MARSHAL:    { bg: "rgba(59,130,246,0.12)",  color: "#60a5fa",                border: "rgba(59,130,246,0.35)" },
  COURSE_PRO: { bg: "rgba(139,92,246,0.12)",  color: "#a78bfa",                border: "rgba(139,92,246,0.35)" },
  TOUR_PRO:   { bg: "rgba(249,115,22,0.12)",  color: "#f97316",                border: "rgba(249,115,22,0.35)" },
  LEGEND:     { bg: "rgba(251,191,36,0.12)",  color: "#fbbf24",                border: "rgba(251,191,36,0.35)" },
};

export default function ProgressionTracker({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const router = useRouter();
  const [prog, setProg] = useState<Prog | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("UserProgression")
      .select("totalPoints, level, rank, streakWeeks")
      .eq("userId", userId)
      .maybeSingle()
      .then(({ data }) => { if (data) setProg(data); });
  }, [userId]);

  if (!prog) {
    if (!isOwner) return null;
    return (
      <div style={{ margin: "0 16px 12px", padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ background: "rgba(150,150,150,0.12)", border: "1px solid rgba(180,180,180,0.25)", borderRadius: 20, padding: "3px 9px", fontSize: 10, fontWeight: 700, color: "rgba(210,210,210,0.85)", fontFamily: "'Outfit', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Caddie
            </div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>Level 1</div>
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>0 pts</div>
        </div>
        <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 5 }}>
          <div style={{ height: "100%", width: "0%", borderRadius: 99, background: "rgba(210,210,210,0.5)" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => router.push("/leaderboards")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(77,168,98,0.8)", letterSpacing: "0.03em" }}>Leaderboard →</button>
        </div>
      </div>
    );
  }

  const style = RANK_STYLE[prog.rank] ?? RANK_STYLE.CADDIE;
  const { current, required, pct } = levelProgress(prog.totalPoints);
  const atMax = prog.level >= MAX_LEVEL;

  const nextRankTier = prog.rank !== "LEGEND"
    ? RANK_TIERS.find(t => t.minLevel > prog.level)
    : null;
  const ptsToNextRank = nextRankTier
    ? Math.max(0, pointsForLevel(nextRankTier.minLevel) - prog.totalPoints)
    : null;

  const STREAK_MILESTONES = [4, 8, 12, 26, 52];
  const nextStreakMilestone = STREAK_MILESTONES.find(m => m > prog.streakWeeks) ?? null;

  return (
    <div style={{ margin: "0 16px 12px", padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {/* Top row: rank badge + level + points */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ background: style.bg, border: `1px solid ${style.border}`, borderRadius: 20, padding: "3px 9px", fontSize: 10, fontWeight: 700, color: style.color, fontFamily: "'Outfit', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {rankLabel(prog.rank as Parameters<typeof rankLabel>[0])}
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "#fff" }}>
            Level {prog.level}
          </div>
        </div>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          {prog.totalPoints.toLocaleString()} pts
        </div>
      </div>

      {/* Progress bar */}
      {!atMax ? (
        <>
          <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 5 }}>
            <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: style.color, transition: "width 0.6s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: prog.streakWeeks > 0 ? 6 : 0 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
              {current.toLocaleString()} / {required.toLocaleString()} pts to Level {prog.level + 1}
            </div>
            {isOwner && (
              <button
                onClick={() => router.push("/leaderboards")}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(77,168,98,0.8)", letterSpacing: "0.03em" }}
              >
                Leaderboard →
              </button>
            )}
          </div>
        </>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: prog.streakWeeks > 0 ? 6 : 0 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: style.color, fontWeight: 600 }}>MAX LEVEL</div>
          {isOwner && (
            <button
              onClick={() => router.push("/leaderboards")}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(77,168,98,0.8)", letterSpacing: "0.03em" }}
            >
              Leaderboard →
            </button>
          )}
        </div>
      )}

      {/* Next rank info */}
      {nextRankTier && ptsToNextRank !== null && ptsToNextRank > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: prog.streakWeeks > 0 ? 5 : 0, marginTop: atMax ? 0 : -2 }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
            {rankLabel(nextRankTier.rank as Parameters<typeof rankLabel>[0])} in {ptsToNextRank.toLocaleString()} pts
          </span>
        </div>
      )}

      {/* Streak row */}
      {prog.streakWeeks > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 12 }}>🔥</span>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "#f97316" }}>
            {prog.streakWeeks}-week streak
          </span>
          {nextStreakMilestone && (
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
              · {nextStreakMilestone - prog.streakWeeks}w to milestone
            </span>
          )}
        </div>
      )}
    </div>
  );
}
