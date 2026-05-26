"use client";

/**
 * Evergreen "How Points Work" bottom sheet.
 *
 * Lives on /leaderboards and is the destination for first-earn
 * celebrations (the "See how points work" CTA from
 * ProgressionTracker's FirstEarnSheet). Generic version of
 * MayCompetitionModal — same data, no May/prize/dates framing.
 *
 * Renders the canonical POINTS_GROUPS from `@/lib/pointsGroups`
 * so the numbers can never drift from what awardPoints() actually
 * gives out.
 *
 * Bottom-sheet pattern matches MayCompetitionModal exactly:
 * fixed backdrop + bottom-anchored panel with max-height 88svh and
 * internal scroll for the long group list. Closes on backdrop tap,
 * Escape key, or the × button.
 */

import { useEffect, useRef } from "react";
import { POINTS_GROUPS } from "@/lib/pointsGroups";
import { SwipeGrip } from "@/components/SwipeGrip";

type Props = { onClose: () => void };

export default function PointsSystemSheet({ onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Outfit:wght@300;400;500;600&display=swap');
        @keyframes pts-slide-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes pts-fade-in { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(7,16,10,0.72)",
          animation: "pts-fade-in 0.2s ease",
        }}
      />

      {/* Sheet */}
      <div ref={sheetRef} style={{
        position: "fixed",
        bottom: 0, left: 0, right: 0,
        zIndex: 1001,
        maxHeight: "88svh",
        background: "#0e1a13",
        borderRadius: "20px 20px 0 0",
        borderTop: "1px solid rgba(77,168,98,0.2)",
        overflowY: "auto",
        animation: "pts-slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
        paddingBottom: "max(36px, calc(env(safe-area-inset-bottom) + 24px))",
        WebkitOverflowScrolling: "touch" as never,
        touchAction: "pan-y",
      }}>
        {/* Swipe-down grip */}
        <SwipeGrip sheetRef={sheetRef} onClose={onClose} />

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
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
          {/* Trophy SVG (no emoji per the design rule) */}
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, rgba(212,160,23,0.22) 0%, rgba(212,160,23,0.06) 100%)", border: "1px solid rgba(212,160,23,0.4)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#d4a017" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
          </div>

          {/* Heading */}
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 6, lineHeight: 1.2 }}>
            How points work
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 22, lineHeight: 1.6 }}>
            Every action you take on Tour It earns points — uploading clips, dropping intel, contributing course data, getting likes, hitting streaks. Stack them up to level up from Caddie to Legend and climb the monthly leaderboard.
          </div>

          {/* Groups */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
            {POINTS_GROUPS.map((group) => (
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

          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", fontStyle: "italic", textAlign: "center", marginTop: 24, lineHeight: 1.6 }}>
            Points refresh monthly for the leaderboard. Lifetime totals stay on your profile.
          </div>
        </div>
      </div>
    </>
  );
}
