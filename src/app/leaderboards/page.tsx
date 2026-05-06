"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import { rankLabel } from "@/lib/progression";
import { RANK_COLORS } from "@/config/points-system";
import { getRankRingBorder, isLegend } from "@/lib/rank-styles";

type Period = "all" | "monthly";

type Entry = {
  userId: string;
  totalPoints: number;
  monthlyPoints: number;
  level: number;
  rank: string;
  user: { displayName: string; username: string; avatarUrl: string | null } | null;
};

const MEDAL = ["🥇", "🥈", "🥉"];

export default function LeaderboardsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("all");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const supabase = createClient();
    const sortField = period === "all" ? "totalPoints" : "monthlyPoints";

    supabase
      .from("UserProgression")
      .select("userId, totalPoints, monthlyPoints, level, rank, user:userId(displayName, username, avatarUrl)")
      .order(sortField, { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setEntries((data as unknown as Entry[]) ?? []);
        setLoading(false);
      });
  }, [period]);

  // Find current user's rank if not in top 50
  useEffect(() => {
    if (!currentUserId || !entries.length) return;
    const idx = entries.findIndex(e => e.userId === currentUserId);
    if (idx >= 0) { setMyRank(idx + 1); return; }

    const supabase = createClient();
    const sortField = period === "all" ? "totalPoints" : "monthlyPoints";
    supabase
      .from("UserProgression")
      .select(sortField)
      .eq("userId", currentUserId)
      .maybeSingle()
      .then(async ({ data: myProg }) => {
        if (!myProg) { setMyRank(null); return; }
        const myPts = (myProg as Record<string, number>)[sortField] ?? 0;
        if (myPts === 0) { setMyRank(null); return; }
        const { count } = await supabase
          .from("UserProgression")
          .select("*", { count: "exact", head: true })
          .gt(sortField, myPts);
        setMyRank((count ?? 0) + 1);
      });
  }, [currentUserId, entries, period]);

  const pts = (e: Entry) =>
    period === "all" ? e.totalPoints : e.monthlyPoints;

  return (
    <main style={{ minHeight: "100svh", background: "#07100a", paddingBottom: 90, color: "#fff" }}>
      {/* Header */}
      <div style={{ padding: "56px 20px 0", display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#fff" }}>Leaderboard</div>
      </div>

      {/* Period tabs */}
      <div style={{ display: "flex", gap: 8, padding: "0 20px", marginBottom: 20 }}>
        {(["all", "monthly"] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${period === p ? "rgba(77,168,98,0.5)" : "rgba(255,255,255,0.08)"}`, background: period === p ? "rgba(77,168,98,0.12)" : "rgba(255,255,255,0.03)", fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 600, color: period === p ? "#4da862" : "rgba(255,255,255,0.4)", cursor: "pointer", textTransform: "capitalize" }}
          >
            {p === "all" ? "All Time" : "Monthly"}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.3)", borderTopColor: "#4da862", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : entries.length === 0 ? (
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>No rankings yet</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Upload clips, get likes, and earn points to appear here.</div>
        </div>
      ) : (
        <div style={{ padding: "0 16px" }}>
          {entries.map((entry, i) => {
            const isMe = entry.userId === currentUserId;
            const rankColor = RANK_COLORS[entry.rank as keyof typeof RANK_COLORS] ?? "rgba(200,200,200,0.7)";
            return (
              <div
                key={entry.userId}
                onClick={() => router.push(`/profile/${entry.userId}`)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", marginBottom: 6, borderRadius: 12, background: isMe ? "rgba(77,168,98,0.08)" : "rgba(255,255,255,0.025)", border: `1px solid ${isMe ? "rgba(77,168,98,0.25)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer" }}
              >
                {/* Rank number */}
                <div style={{ width: 28, textAlign: "center", fontFamily: "'Playfair Display', serif", fontSize: i < 3 ? 18 : 14, color: i < 3 ? "#fff" : "rgba(255,255,255,0.35)", fontWeight: 700, flexShrink: 0 }}>
                  {i < 3 ? MEDAL[i] : i + 1}
                </div>

                {/* Avatar with rank ring */}
                <div
                  className={isLegend(entry.rank) ? "legend-ring" : undefined}
                  style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", background: "rgba(77,168,98,0.15)", border: getRankRingBorder(entry.rank), flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  {entry.user?.avatarUrl
                    ? <img src={entry.user.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  }
                </div>

                {/* Name + rank */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: isMe ? "#fff" : rankColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.user?.displayName || entry.user?.username || "User"}
                    {isMe && <span style={{ marginLeft: 6, fontSize: 10, color: "#4da862" }}>you</span>}
                  </div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
                    {rankLabel(entry.rank as Parameters<typeof rankLabel>[0])} · Lv {entry.level}
                  </div>
                </div>

                {/* Points */}
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {pts(entry).toLocaleString()}
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, color: "rgba(255,255,255,0.35)", marginLeft: 3 }}>pts</span>
                </div>
              </div>
            );
          })}

          {/* Current user rank if outside top 50 */}
          {myRank !== null && !entries.some(e => e.userId === currentUserId) && (
            <div style={{ marginTop: 12, padding: "11px 12px", borderRadius: 12, background: "rgba(77,168,98,0.06)", border: "1px solid rgba(77,168,98,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Your rank</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "#4da862" }}>#{myRank.toLocaleString()}</div>
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
