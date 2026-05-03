"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { levelProgress, rankLabel } from "@/lib/progression";
import { MAX_LEVEL, RANK_TIERS, pointsForLevel } from "@/config/points-system";
import { getRankColor } from "@/lib/rank-styles";
import LevelTracker from "@/components/LevelTracker";

type Prog = {
  totalPoints: number;
  level: number;
  rank: string;
  streakWeeks: number;
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
      <div style={{ margin: "0 16px 6px", padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff" }}>Level 1</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>0 pts</div>
        </div>
        <LevelTracker pct={0} rankColor="rgba(190,190,190,0.75)" />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <button onClick={() => router.push("/leaderboards")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(77,168,98,0.8)", letterSpacing: "0.03em" }}>Leaderboard →</button>
        </div>
      </div>
    );
  }

  const rankColor = getRankColor(prog.rank);
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
    <div style={{ margin: "0 16px 6px", padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {/* Level + pts — rank pill removed, rank signal lives in bar fill color */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff" }}>
          Level {prog.level}
        </div>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          {prog.totalPoints.toLocaleString()} pts
        </div>
      </div>

      {/* Golf tracker */}
      {!atMax ? (
        <>
          <LevelTracker pct={pct} rankColor={rankColor} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, marginBottom: (nextRankTier && ptsToNextRank && ptsToNextRank > 0) || prog.streakWeeks > 0 ? 4 : 0 }}>
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
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: rankColor, fontWeight: 600 }}>MAX LEVEL</div>
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
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: prog.streakWeeks > 0 ? 4 : 0 }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
            {rankLabel(nextRankTier.rank as Parameters<typeof rankLabel>[0])} in {ptsToNextRank.toLocaleString()} pts
          </span>
        </div>
      )}

      {/* Streak */}
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
