"use client";

import { useEffect } from "react";
import { POINT_VALUES, PointAction } from "@/config/points-system";

type Props = { onClose: () => void };

type CompetitionRow = { label: string; display: string; negative?: boolean };

const COMPETITION_POINTS: CompetitionRow[] = [
  { label: "Upload a clip",                            display: `+${POINT_VALUES[PointAction.UPLOAD_CLIP]} pts` },
  { label: "First clip ever at a course (bonus)",      display: `+${POINT_VALUES[PointAction.UPLOAD_FIRST_FOR_COURSE]} pts` },
  { label: "Upload a full-hole series",                display: `+${POINT_VALUES[PointAction.UPLOAD_SERIES]} pts` },
  { label: "Intel quality bonus (club, wind, note)",   display: "+4 to +10 pts" },
  { label: "Add a hole photo",                         display: `+${POINT_VALUES[PointAction.ADD_HOLE_PHOTO]} pts` },
  { label: "Add a course cover photo",                 display: `+${POINT_VALUES[PointAction.ADD_COVER_PHOTO]} pts` },
  { label: "Write a course description",               display: `+${POINT_VALUES[PointAction.ADD_COURSE_DESCRIPTION]} pts` },
  { label: "Complete a course's full profile",         display: `+${POINT_VALUES[PointAction.COURSE_PROFILE_COMPLETE]} pts` },
  { label: "Like received on your clip",               display: `+${POINT_VALUES[PointAction.LIKE_RECEIVED]} pts` },
  { label: "Comment received on your clip",            display: `+${POINT_VALUES[PointAction.COMMENT_RECEIVED]} pts` },
  { label: "New follower",                             display: `+${POINT_VALUES[PointAction.FOLLOW_RECEIVED]} pts` },
  { label: "3-week upload streak",                     display: `+${POINT_VALUES[PointAction.STREAK_3_WEEKS]} pts` },
  { label: "Level up",                                 display: `+${POINT_VALUES[PointAction.LEVEL_UP]} pts` },
  { label: "Rank promotion (LOCAL → LEGEND)",          display: "+100 to +1000 pts" },
];

export default function MayCompetitionModal({ onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        @keyframes may-slide-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes may-fade-in { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(7,16,10,0.72)",
          animation: "may-fade-in 0.2s ease",
        }}
      />

      {/* Sheet */}
      <div style={{
        position: "fixed",
        bottom: 0, left: 0, right: 0,
        zIndex: 1001,
        maxHeight: "88svh",
        background: "#0e1a13",
        borderRadius: "20px 20px 0 0",
        borderTop: "1px solid rgba(77,168,98,0.2)",
        overflowY: "auto",
        animation: "may-slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
        paddingBottom: "max(36px, calc(env(safe-area-inset-bottom) + 24px))",
        WebkitOverflowScrolling: "touch" as any,
      }}>
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 16, right: 16,
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "50%", width: 32, height: 32,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "rgba(255,255,255,0.5)", flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div style={{ padding: "8px 24px 0" }}>
          {/* Heading */}
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 6, lineHeight: 1.2 }}>
            🏆 May Competition
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#4da862", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 24 }}>
            May 1 – May 31, 2026
          </div>

          {/* The Prize */}
          <Section title="The Prize">
            <p style={body}>
              The golfer at the top of the May leaderboard on May 31 wins a{" "}
              <span style={{ color: "#fff", fontWeight: 600 }}>$75 GolfNow gift card</span>.
            </p>
          </Section>

          {/* How to Win */}
          <Section title="How to Win">
            <p style={body}>
              Earn the most points between May 1 and May 31. Upload clips, tag your intel, get likes and saves — every action you already take on Tour It counts. Points accumulate across the full month.
            </p>
          </Section>

          {/* How Points Work */}
          <Section title="How Points Work">
            <div style={{ display: "flex", flexDirection: "column", gap: 0, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden", marginTop: 4 }}>
              {COMPETITION_POINTS.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px",
                    borderBottom: i < COMPETITION_POINTS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  }}
                >
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
                    {item.label}
                  </div>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: item.negative ? "rgba(240,100,100,0.8)" : "#4da862", flexShrink: 0, marginLeft: 12 }}>
                    {item.display}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Tie-breaker */}
          <Section title="Tie-Breaker">
            <p style={body}>
              If two golfers are tied on May 31, the golfer who reached that point total first wins.
            </p>
          </Section>

          {/* Closing line */}
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", fontStyle: "italic", textAlign: "center", marginTop: 28, lineHeight: 1.6 }}>
            Thanks for participating and helping build the Tour It community!
          </p>
        </div>
      </div>
    </>
  );
}

const body: React.CSSProperties = {
  fontFamily: "'Outfit', sans-serif",
  fontSize: 14,
  color: "rgba(255,255,255,0.6)",
  lineHeight: 1.7,
  margin: 0,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}
