"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { levelProgress, rankLabel } from "@/lib/progression";
import { MAX_LEVEL, type RankTierKey } from "@/config/points-system";
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
  // referenceId points at the source row that triggered the points
  // event. Shape depends on action: uploadId for clip-related actions,
  // userId for follow/referral. Resolves to a deep link via
  // resolveLink() so users can tap a ledger row and land on the
  // thing that earned them the points.
  referenceId: string | null;
};

// Action types whose referenceId points to an Upload row. Tap a row of
// these types and we resolve uploadId → courseId + holeNumber and
// route to /courses/[courseId]/holes/[holeNumber]?clip=[uploadId].
const CLIP_LINKED_ACTIONS = new Set([
  "comment_received",
  "like_received",
  "upload_clip",
  "upload_first_for_course",
  "upload_series",
  "intel_bonus",
  "milestone_10_likes",
  "milestone_100_likes",
  "milestone_1000_likes",
]);

// referenceId is a userId for these → /profile/[id].
const USER_LINKED_ACTIONS = new Set([
  "follow_received",
  "referral_signup",
  "referral_first_upload",
]);

// Display labels for every PointAction value. Keep these professional —
// title-cased, no underscores, present-tense for ongoing actions and
// past-tense for one-shot events. The ledger renders the raw key as a
// last resort, so every action emitted by awardPoints needs an entry
// here or the user sees something like "clip_uploaded_for_other".
const ACTION_LABELS: Record<string, string> = {
  signup:                      "Joined Tour It",
  complete_profile:            "Completed profile",
  enable_notifications:        "Enabled notifications",
  upload_clip:                 "Uploaded a clip",
  upload_first_for_course:     "First clip at a course",
  upload_series:               "Uploaded a full-hole series",
  clip_uploaded_for_other:     "Filmed a clip for another golfer",
  intel_bonus:                 "Intel quality bonus",
  add_hole_photo:              "Added a hole photo",
  add_cover_photo:             "Added course cover photo",
  add_course_logo:             "Added course logo",
  add_year_established:        "Added course year",
  add_course_type:             "Added course type",
  add_zip_code:                "Added course zip code",
  add_website_url:             "Added course website",
  add_course_description:      "Added course description",
  course_profile_complete:     "Completed a course profile",
  add_hole_par:                "Added hole par",
  add_hole_yardage:            "Added hole yardage",
  scorecard_complete:          "Completed a scorecard",
  first_scorecard_for_course:  "First scorecard at a course",
  log_first_round:             "Logged your first round",
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
  create_trip:                 "Created a trip",
  create_game:                 "Created a game",
  enable_ryder_cup:            "Enabled Ryder Cup mode",
  level_up:                    "Level up bonus",
  rank_up:                     "Rank up bonus",
  unlike_received:             "Like removed",
  upload_deleted:              "Clip deleted",
  trip_deleted:                "Trip deleted",
  game_deleted:                "Game deleted",
  round_deleted:               "Round deleted",
};

// Fallback formatter for any action that slips through without an
// explicit label — turns "snake_case_action" into "Snake case action".
// Better than showing the raw key.
function prettifyAction(raw: string): string {
  if (!raw) return "Activity";
  const spaced = raw.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const PAGE_SIZE = 50;

export default function ProgressionTracker({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const router = useRouter();
  const [prog, setProg] = useState<Prog | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // First-earn celebratory moment — fires once per user the instant
  // their totalPoints transitions from 0 → >0 (so brand-new accounts
  // that earn their very first points see a one-time "here's how the
  // points system works" reveal). Gated by localStorage so it never
  // re-fires.
  const [showFirstEarn, setShowFirstEarn] = useState(false);
  const firstEarnFiredRef = useRef(false);
  useEffect(() => {
    if (!isOwner || !prog) return;
    if (typeof window === "undefined") return;
    if (firstEarnFiredRef.current) return;
    if (localStorage.getItem("tour-it-first-earn-seen")) {
      firstEarnFiredRef.current = true;
      return;
    }
    if (prog.totalPoints > 0) {
      firstEarnFiredRef.current = true;
      localStorage.setItem("tour-it-first-earn-seen", "1");
      setShowFirstEarn(true);
    }
  }, [prog, isOwner]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const load = () => {
      supabase
        .from("UserProgression")
        .select("totalPoints, level, rank, streakWeeks")
        .eq("userId", userId)
        .maybeSingle()
        .then(({ data }) => { if (data && !cancelled) setProg(data); });
    };
    load();

    // Live: refresh the moment any of this user's points are awarded.
    // awardPoints() emits to both "leaderboard-updates" (global) and
    // "user-progression:<userId>" (per-user). We listen to the per-user
    // channel so a profile bar doesn't refetch on every other user's award.
    const channel = supabase
      .channel(`user-progression:${userId}`)
      .on("broadcast", { event: "points-awarded" }, () => load())
      .subscribe();

    // Polling fallback in case a broadcast is missed (network blip, etc).
    const id = setInterval(load, 15_000);

    return () => { cancelled = true; supabase.removeChannel(channel); clearInterval(id); };
  }, [userId]);

  async function loadLedger(page: number) {
    if (ledgerLoading) return;
    setLedgerLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("UserPointsLedger")
      .select("action, points, createdAt, referenceId")
      .eq("userId", userId)
      .order("createdAt", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (data) {
      setLedger(prev => page === 0 ? (data as LedgerEntry[]) : [...prev, ...(data as LedgerEntry[])]);
      setHasMore(data.length === PAGE_SIZE);
      setLedgerPage(page);
    }
    setLedgerLoading(false);
  }

  // Lazy-resolve uploadId → deep link as the ledger grows. One batch
  // query per ledger page; results merged into a cumulative map so we
  // never re-fetch a clip we've already resolved.
  const [clipLinks, setClipLinks] = useState<Record<string, string>>({});
  useEffect(() => {
    const missing = Array.from(new Set(
      ledger
        .filter(e => CLIP_LINKED_ACTIONS.has(e.action) && e.referenceId)
        .map(e => e.referenceId as string)
        .filter(id => !(id in clipLinks))
    ));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      // Upload has no holeNumber column — join Hole inline (audit
      // #1 pattern, applied to the ledger deep-link resolver).
      const { data } = await createClient()
        .from("Upload")
        .select("id, courseId, hole:holeId(holeNumber)")
        .in("id", missing);
      if (cancelled || !data) return;
      const map: Record<string, string> = {};
      type JoinedRow = { id: string; courseId: string; hole: { holeNumber: number } | { holeNumber: number }[] | null };
      for (const row of data as unknown as JoinedRow[]) {
        const holeNumber = Array.isArray(row.hole) ? row.hole[0]?.holeNumber : row.hole?.holeNumber;
        map[row.id] = holeNumber
          ? `/courses/${row.courseId}/holes/${holeNumber}?clip=${row.id}`
          : `/courses/${row.courseId}`;
      }
      setClipLinks(prev => ({ ...prev, ...map }));
    })();
    return () => { cancelled = true; };
  }, [ledger, clipLinks]);

  function resolveLink(entry: LedgerEntry): string | null {
    if (!entry.referenceId) return null;
    if (CLIP_LINKED_ACTIONS.has(entry.action)) return clipLinks[entry.referenceId] ?? null;
    if (USER_LINKED_ACTIONS.has(entry.action)) return `/profile/${entry.referenceId}`;
    return null;
  }

  function openLedger(e: React.MouseEvent) {
    e.stopPropagation();
    setShowLedger(true);
    if (ledger.length === 0) loadLedger(0);
  }

  // Gamification gate (2026-05-25 onboarding rewrite): hide the
  // level/rank/ledger UI entirely for brand-new users (no UserProgression
  // row OR totalPoints === 0). Avoids dropping a "Level 1 of 25" pill
  // on day-zero accounts where it competes for attention with the
  // home feed. The UI lights up the moment they earn their first
  // points (real-time channel above refreshes prog).
  //
  // EXCEPTION: when the first-earn celebratory sheet is mid-fire,
  // we still render it even if the progression bar is hidden — the
  // sheet needs to surface BEFORE the UI lights up, not after.
  if (!prog || prog.totalPoints === 0) {
    return showFirstEarn ? <FirstEarnSheet pts={prog?.totalPoints ?? 0} onClose={() => setShowFirstEarn(false)} onSeePoints={() => { setShowFirstEarn(false); router.push("/leaderboards?points=1"); }} /> : null;
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

      {/* First-earn celebratory sheet — only renders for the brief
          moment the user crosses 0 → first points. Mounted alongside
          the bar so they see both. */}
      {showFirstEarn && (
        <FirstEarnSheet
          pts={prog.totalPoints}
          onClose={() => setShowFirstEarn(false)}
          onSeePoints={() => { setShowFirstEarn(false); router.push("/leaderboards?points=1"); }}
        />
      )}

      {/* Progression card — slim layout */}
      <div
        onClick={() => router.push("/leaderboards")}
        style={{ margin: "0 16px 8px", padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", position: "relative" }}
      >
        {/* Row 1: rank pill + LEVEL X eyebrow + total pts. Rank tier
            label (Caddie / Local / Marshal / …) lives in the pill so
            users see what they ARE, not just their level number. */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 99, background: `${rankColor}15`, border: `1px solid ${rankColor}55`, flexShrink: 0 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: rankColor, boxShadow: `0 0 6px ${rankColor}90` }} />
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: rankColor, textTransform: "uppercase" }}>
              {rankLabel(prog.rank as RankTierKey)}
            </span>
          </span>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>
            Level {prog.level}
          </span>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1, marginLeft: "auto" }}>
            {prog.totalPoints.toLocaleString()}
          </span>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.4)", letterSpacing: "0.02em" }}>pts</span>
        </div>

        {/* Thin progress bar */}
        {!atMax ? <LevelTracker pct={pct} rankColor={rankColor} /> : <div style={{ marginTop: 6, fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, color: rankColor, letterSpacing: "0.12em" }}>MAX LEVEL</div>}

        {/* Row 3: Ledger pill (owner only) + remaining-to-level + streak */}
        {(isOwner || !atMax || prog.streakWeeks > 0) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            {isOwner && (
              <button
                onClick={openLedger}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 99, border: "1px solid rgba(77,168,98,0.3)", background: "rgba(77,168,98,0.08)", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 600, color: "#4da862", letterSpacing: "0.04em" }}
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
                  {ledger.map((entry, i) => {
                    const link = resolveLink(entry);
                    const tappable = !!link;
                    return (
                      <div
                        key={i}
                        onClick={tappable ? () => { setShowLedger(false); router.push(link); } : undefined}
                        role={tappable ? "button" : undefined}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "11px 20px",
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          cursor: tappable ? "pointer" : "default",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ACTION_LABELS[entry.action] ?? prettifyAction(entry.action)}
                          </div>
                          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                            {formatTimeAgo(entry.createdAt)}
                          </div>
                        </div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, color: entry.points >= 0 ? "#4da862" : "#f87171", marginLeft: 14, flexShrink: 0 }}>
                          {entry.points > 0 ? "+" : ""}{entry.points}
                        </div>
                        {tappable && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 10, flexShrink: 0 }}>
                            <path d="m9 18 6-6-6-6"/>
                          </svg>
                        )}
                      </div>
                    );
                  })}
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

// First-earn celebratory sheet — bottom sheet that introduces the
// points system the moment a brand-new user earns their first
// points. Per the onboarding v3 plan, gamification is HIDDEN from
// day-zero accounts; this is the one-time reveal that lights it
// up. Dismissal is sticky in localStorage so it never re-fires.
function FirstEarnSheet({ pts, onClose, onSeePoints }: { pts: number; onClose: () => void; onSeePoints: () => void }) {
  return (
    <>
      <div className="tourit-sheet-backdrop" onClick={onClose} />
      <div className="tourit-sheet tourit-sheet--auto" onClick={e => e.stopPropagation()}>
        <div className="tourit-sheet-grip" />
        <div style={{ padding: "0 4px 6px", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, rgba(212,160,23,0.22) 0%, rgba(212,160,23,0.06) 100%)", border: "1px solid rgba(212,160,23,0.4)", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d4a017" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#d4a017", marginBottom: 10 }}>
            +{pts.toLocaleString()} pts
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 10, lineHeight: 1.2 }}>
            You&apos;re on the board
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.62)", marginBottom: 22, lineHeight: 1.6, maxWidth: 320, marginLeft: "auto", marginRight: "auto" }}>
            Every clip you upload, like you give, and round you log earns points. Build them up to level up from Caddie to Legend and climb the monthly leaderboard.
          </div>
          <button
            onClick={onSeePoints}
            style={{ width: "100%", background: "#2d7a42", border: "none", borderRadius: 14, padding: "15px", fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 16px rgba(45,122,66,0.4)", marginBottom: 8 }}
          >
            See how points work
          </button>
          <button
            onClick={onClose}
            style={{ width: "100%", background: "none", border: "none", padding: "11px", fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", cursor: "pointer" }}
          >
            Got it
          </button>
        </div>
      </div>
    </>
  );
}
