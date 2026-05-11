"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { levelProgress } from "@/lib/progression";
import { MAX_LEVEL } from "@/config/points-system";
import { getRankColor } from "@/lib/rank-styles";
import LevelTracker from "@/components/LevelTracker";
import { formatTimeAgo } from "@/lib/formatTimeAgo";

type Prog = {
  totalPoints: number;
  level: number;
  rank: string;
  streakWeeks: number;
};

type LedgerEntry = {
  action: string;
  points: number;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  signup:                      "Joined Tour It",
  complete_profile:            "Completed profile",
  enable_notifications:        "Enabled notifications",
  upload_clip:                 "Uploaded a clip",
  upload_first_for_course:     "First scout for course",
  upload_series:               "Series upload bonus",
  intel_bonus:                 "Intel quality bonus",
  add_hole_photo:              "Added hole photo",
  add_cover_photo:             "Added course cover photo",
  add_course_logo:             "Added course logo",
  add_year_established:        "Added course year",
  add_course_type:             "Added course type",
  add_zip_code:                "Added zip code",
  add_website_url:             "Added website URL",
  add_course_description:      "Added course description",
  course_profile_complete:     "Completed course profile",
  add_hole_par:                "Added hole par",
  add_hole_yardage:            "Added hole yardage",
  scorecard_complete:          "Completed scorecard",
  first_scorecard_for_course:  "First scorecard for course",
  log_first_round:             "Logged first round",
  log_complete_round:          "Logged a round",
  like_received:               "Like received",
  comment_received:            "Comment received",
  follow_received:             "New follower",
  milestone_10_likes:          "10 likes milestone",
  milestone_100_likes:         "100 likes milestone",
  milestone_1000_likes:        "1,000 likes milestone",
  streak_3_weeks:              "3-week streak bonus",
  streak_8_weeks:              "8-week streak bonus",
  streak_12_weeks:             "12-week streak bonus",
  streak_26_weeks:             "26-week streak bonus",
  streak_52_weeks:             "52-week streak bonus",
  referral_signup:             "Referral — friend joined",
  referral_first_upload:       "Referral — friend uploaded",
  level_up:                    "Level up bonus",
  rank_up:                     "Rank up bonus",
  unlike_received:             "Like removed",
  upload_deleted:              "Clip deleted",
};

const PAGE_SIZE = 50;

export default function ProgressionTracker({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const router = useRouter();
  const [prog, setProg] = useState<Prog | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("UserProgression")
      .select("totalPoints, level, rank, streakWeeks")
      .eq("userId", userId)
      .maybeSingle()
      .then(({ data }) => { if (data) setProg(data); });
  }, [userId]);

  async function loadLedger(page: number) {
    if (ledgerLoading) return;
    setLedgerLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("UserPointsLedger")
      .select("action, points, createdAt")
      .eq("userId", userId)
      .order("createdAt", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (data) {
      setLedger(prev => page === 0 ? data : [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
      setLedgerPage(page);
    }
    setLedgerLoading(false);
  }

  function openLedger(e: React.MouseEvent) {
    e.stopPropagation();
    setShowLedger(true);
    if (ledger.length === 0) loadLedger(0);
  }

  if (!prog) {
    if (!isOwner) return null;
    return (
      <div
        onClick={() => router.push("/leaderboards")}
        style={{ margin: "0 16px 8px", padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>Level 1</span>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "#fff" }}>0 pts</span>
        </div>
        <LevelTracker pct={0} rankColor="rgba(190,190,190,0.75)" />
      </div>
    );
  }

  const rankColor = getRankColor(prog.rank);
  const { current, required, pct } = levelProgress(prog.totalPoints);
  const atMax = prog.level >= MAX_LEVEL;
  const STREAK_MILESTONES = [4, 8, 12, 26, 52];
  const nextMilestone = STREAK_MILESTONES.find(m => m > prog.streakWeeks) ?? null;
  const remaining = required - current;

  return (
    <>
      <style>{`@keyframes pt-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Progression card — slim layout */}
      <div
        onClick={() => router.push("/leaderboards")}
        style={{ margin: "0 16px 8px", padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", position: "relative" }}
      >
        {/* Row 1: eyebrow LEVEL X + total pts + Ledger pill */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: rankColor, flexShrink: 0 }}>
              Level {prog.level}
            </span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
              {prog.totalPoints.toLocaleString()}
            </span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.4)", letterSpacing: "0.02em" }}>pts</span>
          </div>
          {isOwner && (
            <button
              onClick={openLedger}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 99, border: "1px solid rgba(77,168,98,0.3)", background: "rgba(77,168,98,0.08)", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "#4da862", flexShrink: 0, letterSpacing: "0.04em" }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              Ledger
            </button>
          )}
        </div>

        {/* Thin progress bar */}
        {!atMax ? <LevelTracker pct={pct} rankColor={rankColor} /> : <div style={{ marginTop: 6, fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: rankColor, letterSpacing: "0.12em" }}>MAX LEVEL</div>}

        {/* Row 3: remaining-to-level + streak */}
        {(!atMax || prog.streakWeeks > 0) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            {!atMax && (
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
                {remaining.toLocaleString()} to Level {prog.level + 1}
              </span>
            )}
            {prog.streakWeeks > 0 && (
              <>
                {!atMax && <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 11 }}>🔥</span>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "#f97316" }}>
                    {prog.streakWeeks}-week streak
                  </span>
                  {nextMilestone && (
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                      · {nextMilestone - prog.streakWeeks}w to milestone
                    </span>
                  )}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Points Ledger bottom sheet */}
      {showLedger && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 300 }}
          onClick={() => setShowLedger(false)}
        >
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#0d2318", borderRadius: "20px 20px 0 0", maxHeight: "80vh", display: "flex", flexDirection: "column" }}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, margin: "12px auto 0", flexShrink: 0 }} />

            {/* Header */}
            <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff" }}>Points Ledger</div>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
                  {prog.totalPoints.toLocaleString()} pts total
                </div>
              </div>
              <button
                onClick={() => setShowLedger(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "rgba(255,255,255,0.4)" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Ledger rows */}
            <div style={{ flex: 1, overflowY: "auto", paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
              {ledgerLoading && ledger.length === 0 ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(77,168,98,0.2)", borderTopColor: "#4da862", animation: "pt-spin 0.9s linear infinite" }} />
                </div>
              ) : ledger.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
                  No points yet — start scouting!
                </div>
              ) : (
                <>
                  {ledger.map((entry, i) => (
                    <div
                      key={i}
                      style={{ display: "flex", alignItems: "center", padding: "11px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                          {formatTimeAgo(entry.createdAt)}
                        </div>
                      </div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: entry.points >= 0 ? "#4da862" : "#f87171", marginLeft: 14, flexShrink: 0 }}>
                        {entry.points > 0 ? "+" : ""}{entry.points}
                      </div>
                    </div>
                  ))}
                  {hasMore && (
                    <button
                      onClick={() => loadLedger(ledgerPage + 1)}
                      disabled={ledgerLoading}
                      style={{ width: "100%", padding: "14px", background: "none", border: "none", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.3)" }}
                    >
                      {ledgerLoading ? "Loading..." : "Load more"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
