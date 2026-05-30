"use client";

/**
 * Gamification hub — "Play Tour It".
 *
 * The big-bold landing pad linked from every hamburger menu. Sells the
 * gamified layer: points, ranks (Caddie → Legend), monthly leaderboard
 * competitions, badges, and streaks. Routes out to the canonical
 * surfaces (PointsSystemSheet on /leaderboards, profile feed, monthly
 * competition modal) instead of duplicating their data.
 *
 * Tone: confident, playful, slightly editorial. Aesthetic stays in the
 * tour-it palette (#07100a + #4da862) — no emojis as UI, green-stroke
 * silhouette SVGs only.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { RANK_TIERS, RANK_COLORS, type RankTierKey } from "@/config/points-system";
import { rankLabel } from "@/lib/progression";
import BottomNav from "@/components/BottomNav";
import PointsSystemSheet from "@/components/PointsSystemSheet";
import MayCompetitionModal from "@/components/MayCompetitionModal";

const RANK_META: Record<RankTierKey, string> = {
  CADDIE:     "Reading the book. Every great one started here.",
  LOCAL:      "You know your home track inside out.",
  MARSHAL:    "A fixture on the course. Real ground covered.",
  COURSE_PRO: "Multiple tracks deep. The community counts on your intel.",
  TOUR_PRO:   "Elite contributor. Your clips reach players across the country.",
  LEGEND:     "The rarest rank on Tour It. You helped build the platform.",
};

export default function PlayHubPage() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [me, setMe] = useState<{ rank: string; level: number; totalPoints: number } | null>(null);
  // Inline sheets — keep the Play hub mounted as the back-stack anchor.
  // Tiles that previously router.push'd to /leaderboards?points=1 now
  // open the sheet right here, so a back gesture from any subsequent
  // navigation (like the Leaderboard tile) returns to /play instead of
  // a transient /leaderboards entry.
  const [showPoints, setShowPoints] = useState(false);
  const [showComp, setShowComp] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("UserProgression")
        .select("rank, level, totalPoints")
        .eq("userId", user.id)
        .maybeSingle();
      if (data) setMe(data);
    })().catch(() => {});
  }, []);

  return (
    <main style={{
      minHeight: "100svh",
      background: "#07100a",
      color: "#fff",
      fontFamily: "'Outfit', sans-serif",
      paddingLeft: isDesktop ? 72 : 0,
      paddingBottom: 100,
    }}>
      <style>{`
        
        * { box-sizing: border-box; }
        @keyframes play-glint { 0%,100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        @keyframes play-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Sticky back. TourItTopBar is hidden on /play (see
          HIDDEN_EXACT), so this header sits right under the iOS
          status bar and owns the safe-area-inset-top padding. */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(7,16,10,0.92)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "calc(10px + env(safe-area-inset-top)) 20px 10px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button onClick={() => router.back()} style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.55)" }}>Play Tour It</span>
      </div>

      {/* Hero — big bold */}
      <div style={{
        position: "relative", overflow: "hidden",
        background: "linear-gradient(175deg, #020c04 0%, #0a2615 35%, #112e1c 100%)",
        borderBottom: "1px solid rgba(77,168,98,0.18)",
        padding: isDesktop ? "60px 24px 56px" : "44px 24px 42px",
        textAlign: "center",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 100%, rgba(45,122,66,0.22) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", width: 64, height: 64, background: "radial-gradient(circle, rgba(212,160,23,0.35) 0%, transparent 70%)", animation: "play-glint 4s ease-in-out infinite", pointerEvents: "none" }} />

        <div style={{ position: "relative", display: "inline-flex", padding: "5px 12px", borderRadius: 99, background: "rgba(77,168,98,0.12)", border: "1px solid rgba(77,168,98,0.35)", marginBottom: 14, animation: "play-rise 0.5s ease both" }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#4da862" }}>
            Play Tour It
          </span>
        </div>

        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: isDesktop ? 56 : 40, fontWeight: 900, lineHeight: 1.02,
          margin: "0 0 14px", letterSpacing: "-0.01em",
          background: "linear-gradient(180deg, #fff 0%, #b8e3c4 100%)",
          WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
          animation: "play-rise 0.55s ease both 0.05s",
        }}>
          Scout. Score.<br/>Climb the board.
        </h1>
        <p style={{
          fontFamily: "'Playfair Display', serif", fontStyle: "italic",
          fontSize: isDesktop ? 18 : 15, color: "rgba(255,255,255,0.7)",
          margin: 0, animation: "play-rise 0.6s ease both 0.1s",
        }}>
          Every clip you post moves you up the leaderboard.
        </p>

        {/* User snapshot pill, if logged in */}
        {me && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            marginTop: 24, padding: "8px 14px", borderRadius: 99,
            background: "rgba(255,255,255,0.04)", border: `1px solid ${(RANK_COLORS[me.rank as RankTierKey] ?? "rgba(255,255,255,0.2)")}55`,
            animation: "play-rise 0.7s ease both 0.2s",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: RANK_COLORS[me.rank as RankTierKey] ?? "#4da862", boxShadow: `0 0 8px ${RANK_COLORS[me.rank as RankTierKey] ?? "#4da862"}` }} />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: RANK_COLORS[me.rank as RankTierKey] ?? "#4da862", textTransform: "uppercase" }}>
              {rankLabel(me.rank as RankTierKey)}
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>·</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Lv {me.level}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>·</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{me.totalPoints.toLocaleString()}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>pts</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: isDesktop ? "36px 32px 0" : "28px 20px 0" }}>

        {/* 3 big CTA tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
          {[
            {
              label: "Points",
              sub: "How every action scores",
              color: "#4da862",
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="7" x2="12" y2="13"/><line x1="9" y1="10" x2="15" y2="10"/><path d="M9 16h6"/></svg>,
              onClick: () => setShowPoints(true),
            },
            {
              label: "Leaderboard",
              sub: "Weekly · Monthly · All-time",
              color: "#d4a017",
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="4" cy="3" r="1"/><circle cx="20" cy="3" r="1"/><path d="M4 4 Q12 8 20 4"/><path d="M4 4 L4 17 L20 17 L20 4"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="6" y1="13.5" x2="18" y2="13.5"/><line x1="12" y1="17" x2="12" y2="20"/><line x1="10" y1="20" x2="14" y2="20"/></svg>,
              onClick: () => router.push("/leaderboards"),
            },
            {
              label: "Monthly Comp",
              sub: "Prizes for the top scorers",
              color: "#f97316",
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
              onClick: () => setShowComp(true),
            },
            {
              label: "Streaks",
              sub: "Show up week after week",
              color: "#f97316",
              icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c0 5-4 6-4 10a4 4 0 0 0 8 0c0-2-1-3-1-5 0 0 3 1 3 5a6 6 0 0 1-12 0c0-6 6-7 6-10z"/></svg>,
              onClick: () => setShowPoints(true),
            },
          ].map((tile) => (
            <button
              key={tile.label}
              onClick={tile.onClick}
              style={{
                position: "relative",
                background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 16,
                padding: "18px 16px",
                textAlign: "left",
                cursor: "pointer",
                display: "flex", flexDirection: "column", gap: 12,
                minHeight: 116,
                color: "#fff",
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${tile.color}18`, border: `1px solid ${tile.color}44`, display: "flex", alignItems: "center", justifyContent: "center", color: tile.color }}>
                {tile.icon}
              </div>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 800, lineHeight: 1.15, marginBottom: 4 }}>
                  {tile.label}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.35 }}>
                  {tile.sub}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* ── How it works ── */}
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 800, margin: "0 0 14px", color: "#fff" }}>
          How it works
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 36 }}>
          {[
            { num: "01", title: "Earn points for everything", body: "Upload a clip. Drop intel. Add a course photo. Log a round. Get likes. Every move you make on Tour It scores." },
            { num: "02", title: "Level up + rank up",         body: "Points push you up the level curve. Cross thresholds and you climb tiers — Caddie all the way to Legend. Bonus points at every rank-up." },
            { num: "03", title: "Climb the leaderboard",      body: "Weekly, monthly, all-time. Monthly is where the prizes live." },
          ].map((s) => (
            <div key={s.num} style={{
              display: "flex", gap: 16, padding: "16px 18px",
              background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14,
            }}>
              <div style={{
                fontFamily: "'Playfair Display', serif", fontStyle: "italic",
                fontSize: 26, fontWeight: 700, color: "#4da862",
                lineHeight: 1, opacity: 0.7, flexShrink: 0, minWidth: 36,
              }}>{s.num}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── The ranks ── */}
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 800, margin: "0 0 4px", color: "#fff" }}>
          The ranks
        </h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 18, fontStyle: "italic" }}>
          Six tiers. All of them worth chasing.
        </p>
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 36 }}>
          {RANK_TIERS.map((tier, i) => {
            const color = RANK_COLORS[tier.rank];
            const isLast = i === RANK_TIERS.length - 1;
            return (
              <div key={tier.rank} style={{
                display: "flex", alignItems: "flex-start", gap: 16,
                padding: "12px 0",
                borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.05)",
              }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 4 }}>
                  <div style={{ width: 11, height: 11, borderRadius: "50%", background: color, boxShadow: `0 0 10px ${color}80` }} />
                  {!isLast && <div style={{ width: 1, flex: 1, minHeight: 22, background: `linear-gradient(180deg, ${color}40, transparent)`, marginTop: 6 }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color, letterSpacing: "0.01em" }}>
                      {rankLabel(tier.rank)}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                      Lv {tier.minLevel}–{tier.maxLevel}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.55 }}>
                    {RANK_META[tier.rank]}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Monthly comp ── */}
        <div style={{
          position: "relative", overflow: "hidden",
          background: "linear-gradient(135deg, rgba(212,160,23,0.10) 0%, rgba(212,160,23,0.02) 100%)",
          border: "1px solid rgba(212,160,23,0.35)",
          borderRadius: 18,
          padding: 22, marginBottom: 36,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(212,160,23,0.18)", border: "1px solid rgba(212,160,23,0.45)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d4a017" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#d4a017", marginBottom: 2 }}>
                Monthly Competition
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.15 }}>
                Top of the board wins
              </div>
            </div>
          </div>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, margin: "0 0 14px" }}>
            Every month resets. The top scorers in the monthly leaderboard claim prizes — Tour It gear, course-credit gift cards, and a permanent spot in the Hall of the Month.
          </p>
          <button
            onClick={() => setShowComp(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "10px 16px", borderRadius: 99,
              background: "#d4a017", border: "none", cursor: "pointer",
              fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: "#1a1303",
            }}
          >
            See this month
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>

        {/* CTA bottom */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch" }}>
          <button
            onClick={() => router.push("/upload")}
            style={{
              padding: "16px 22px",
              background: "linear-gradient(135deg, #2d7a42 0%, #4da862 100%)",
              border: "none", borderRadius: 14,
              fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff",
              cursor: "pointer", letterSpacing: "0.02em",
              boxShadow: "0 6px 24px rgba(45,122,66,0.35)",
            }}
          >
            Upload a clip — start scoring
          </button>
          <button
            onClick={() => setShowPoints(true)}
            style={{
              padding: "13px 22px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14,
              fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
            }}
          >
            See the full point breakdown
          </button>
        </div>
      </div>

      <BottomNav />

      {showPoints && <PointsSystemSheet onClose={() => setShowPoints(false)} />}
      {showComp && <MayCompetitionModal onClose={() => setShowComp(false)} />}
    </main>
  );
}
