"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { levelProgress } from "@/lib/progression";
import { MAX_LEVEL } from "@/config/points-system";
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
      <div
        onClick={() => router.push("/leaderboards")}
        style={{ margin: "0 16px 6px", padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer" }}
      >
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 2 }}>
          Level 1 <span style={{ fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,0.45)", marginLeft: 4 }}>· 0 pts</span>
        </div>
        <LevelTracker pct={0} rankColor="rgba(190,190,190,0.75)" />
      </div>
    );
  }

  const rankColor = getRankColor(prog.rank);
  const { current, required, pct } = levelProgress(prog.totalPoints);
  const atMax = prog.level >= MAX_LEVEL;

  const STREAK_MILESTONES = [4, 8, 12, 26, 52];
  const nextStreakMilestone = STREAK_MILESTONES.find(m => m > prog.streakWeeks) ?? null;

  return (
    <div
      onClick={() => router.push("/leaderboards")}
      style={{ margin: "0 16px 6px", padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", position: "relative" }}
    >
      {/* Level + total pts inline */}
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 2 }}>
        Level {prog.level}
        <span style={{ fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,0.5)", marginLeft: 6 }}>
          · {prog.totalPoints.toLocaleString()} pts
        </span>
      </div>

      {/* Golf tracker */}
      {!atMax ? (
        <>
          <LevelTracker pct={pct} rankColor={rankColor} />
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 4, marginBottom: prog.streakWeeks > 0 ? 4 : 0 }}>
            {current.toLocaleString()} / {required.toLocaleString()} pts to Level {prog.level + 1}
          </div>
          {/* Info button — absolute bottom-right of card */}
          <button
            onClick={e => { e.stopPropagation(); router.push("/about"); }}
            style={{ position: "absolute", bottom: 4, right: 6, background: "none", border: "none", padding: 2, cursor: "pointer", display: "flex", alignItems: "center", color: "rgba(255,255,255,0.22)", lineHeight: 1 }}
            aria-label="About levels"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </>
      ) : (
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: rankColor, fontWeight: 600, marginTop: 6, marginBottom: prog.streakWeeks > 0 ? 6 : 0 }}>
          MAX LEVEL
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
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
              · {nextStreakMilestone - prog.streakWeeks}w to milestone
            </span>
          )}
        </div>
      )}
    </div>
  );
}
