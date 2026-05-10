"use client";

import { useEffect } from "react";
import { POINT_VALUES, PointAction } from "@/config/points-system";

type Props = { onClose: () => void };

type Row = { label: string; display: string; negative?: boolean };
type Group = { title: string; rows: Row[] };

const fmt = (n: number) => `+${n} pts`;
const fmtNeg = (n: number) => `${n} pts`;

// Source-of-truth for every action lives in src/config/points-system.ts.
// Pulling values from POINT_VALUES so this list never drifts.
const COMPETITION_GROUPS: Group[] = [
  {
    title: "Content & Uploads",
    rows: [
      { label: "Upload a clip",                          display: fmt(POINT_VALUES[PointAction.UPLOAD_CLIP]) },
      { label: "First clip ever at a course (bonus)",    display: fmt(POINT_VALUES[PointAction.UPLOAD_FIRST_FOR_COURSE]) },
      { label: "Upload a full-hole series",              display: fmt(POINT_VALUES[PointAction.UPLOAD_SERIES]) },
      { label: "Intel quality bonus (club, wind, note)", display: "+4 to +10 pts" },
      { label: "Add a hole photo",                       display: fmt(POINT_VALUES[PointAction.ADD_HOLE_PHOTO]) },
    ],
  },
  {
    title: "Course Data Contribution",
    rows: [
      { label: "Add a course cover photo",        display: fmt(POINT_VALUES[PointAction.ADD_COVER_PHOTO]) },
      { label: "Add a course logo",               display: fmt(POINT_VALUES[PointAction.ADD_COURSE_LOGO]) },
      { label: "Write a course description",      display: fmt(POINT_VALUES[PointAction.ADD_COURSE_DESCRIPTION]) },
      { label: "Add year established",            display: fmt(POINT_VALUES[PointAction.ADD_YEAR_ESTABLISHED]) },
      { label: "Add website URL",                 display: fmt(POINT_VALUES[PointAction.ADD_WEBSITE_URL]) },
      { label: "Add course type",                 display: fmt(POINT_VALUES[PointAction.ADD_COURSE_TYPE]) },
      { label: "Add zip code",                    display: fmt(POINT_VALUES[PointAction.ADD_ZIP_CODE]) },
      { label: "Complete a course's full profile (bonus)", display: fmt(POINT_VALUES[PointAction.COURSE_PROFILE_COMPLETE]) },
    ],
  },
  {
    title: "Scorecard & Rounds",
    rows: [
      { label: "Add hole par",                        display: fmt(POINT_VALUES[PointAction.ADD_HOLE_PAR]) },
      { label: "Add hole yardage",                    display: fmt(POINT_VALUES[PointAction.ADD_HOLE_YARDAGE]) },
      { label: "Complete a scorecard",                display: fmt(POINT_VALUES[PointAction.SCORECARD_COMPLETE]) },
      { label: "First scorecard for a course",        display: fmt(POINT_VALUES[PointAction.FIRST_SCORECARD_FOR_COURSE]) },
      { label: "Log your first round (one-time)",     display: fmt(POINT_VALUES[PointAction.LOG_FIRST_ROUND]) },
      { label: "Log a complete round",                display: fmt(POINT_VALUES[PointAction.LOG_COMPLETE_ROUND]) },
    ],
  },
  {
    title: "Social",
    rows: [
      { label: "Like received on your clip",       display: fmt(POINT_VALUES[PointAction.LIKE_RECEIVED]) },
      { label: "Comment received on your clip",    display: fmt(POINT_VALUES[PointAction.COMMENT_RECEIVED]) },
      { label: "New follower",                     display: fmt(POINT_VALUES[PointAction.FOLLOW_RECEIVED]) },
    ],
  },
  {
    title: "Onboarding (one-time)",
    rows: [
      { label: "Sign up",                          display: fmt(POINT_VALUES[PointAction.SIGNUP]) },
      { label: "Complete your profile",            display: fmt(POINT_VALUES[PointAction.COMPLETE_PROFILE]) },
      { label: "Enable push notifications",        display: fmt(POINT_VALUES[PointAction.ENABLE_NOTIFICATIONS]) },
    ],
  },
  {
    title: "Like Milestones (one-time)",
    rows: [
      { label: "10 total likes received",          display: fmt(POINT_VALUES[PointAction.MILESTONE_10_LIKES]) },
      { label: "100 total likes received",         display: fmt(POINT_VALUES[PointAction.MILESTONE_100_LIKES]) },
      { label: "1,000 total likes received",       display: fmt(POINT_VALUES[PointAction.MILESTONE_1000_LIKES]) },
    ],
  },
  {
    title: "Upload Streaks (one-time)",
    rows: [
      { label: "3-week streak",   display: fmt(POINT_VALUES[PointAction.STREAK_3_WEEKS]) },
      { label: "8-week streak",   display: fmt(POINT_VALUES[PointAction.STREAK_8_WEEKS]) },
      { label: "12-week streak",  display: fmt(POINT_VALUES[PointAction.STREAK_12_WEEKS]) },
      { label: "26-week streak",  display: fmt(POINT_VALUES[PointAction.STREAK_26_WEEKS]) },
      { label: "52-week streak",  display: fmt(POINT_VALUES[PointAction.STREAK_52_WEEKS]) },
    ],
  },
  {
    title: "Referrals",
    rows: [
      { label: "Friend signs up with your link",       display: fmt(POINT_VALUES[PointAction.REFERRAL_SIGNUP]) },
      { label: "Friend posts their first clip",        display: fmt(POINT_VALUES[PointAction.REFERRAL_FIRST_UPLOAD]) },
    ],
  },
  {
    title: "Progression",
    rows: [
      { label: "Level up",                              display: fmt(POINT_VALUES[PointAction.LEVEL_UP]) },
      { label: "Rank promotion (LOCAL → LEGEND)",       display: "+100 to +1,000 pts" },
    ],
  },
  {
    title: "Deductions",
    rows: [
      { label: "Like removed from your clip",  display: fmtNeg(POINT_VALUES[PointAction.UNLIKE_RECEIVED]),  negative: true },
      { label: "Clip deleted",                 display: fmtNeg(POINT_VALUES[PointAction.UPLOAD_DELETED]),   negative: true },
    ],
  },
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
              <span style={{ color: "#fff", fontWeight: 600 }}>$100 GolfNow gift card</span>.
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
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
              {COMPETITION_GROUPS.map((group) => (
                <div key={group.title}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)", marginBottom: 6, paddingLeft: 2 }}>
                    {group.title}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
                    {group.rows.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "10px 14px",
                          borderBottom: i < group.rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
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
