"use client";

import { useEffect, useRef, useState } from "react";

export function HoleIdentityCard({
  holeNumber,
  holePar,
  clipCount,
  flush = false,
}: {
  holeNumber?: number | null;
  holePar?: number | null;
  clipCount: number;
  // Full-screen feed-modal mode (no BottomNav): pins the card to the true
  // bottom-left corner with a brighter green outline on the top + right
  // edges only. Other surfaces keep the BottomNav-clearing offset.
  flush?: boolean;
}) {
  const isFirst = useRef(true);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    setOpacity(0);
    const t = setTimeout(() => setOpacity(1), 10);
    return () => clearTimeout(t);
  }, [holeNumber]);

  if (!holeNumber) return null;
  return (
    <div
      style={{
        position: "absolute",
        // flush: pinned to the true bottom-left corner (full-screen modal,
        // no BottomNav). Otherwise sits flush against the BottomNav's top
        // edge (BottomNav height ≈ 67px + safe-area-inset-bottom).
        bottom: flush ? 0 : "calc(68px + env(safe-area-inset-bottom))",
        left: 0,
        zIndex: 101,
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
        opacity,
        transition: "opacity 150ms ease",
        pointerEvents: "none",
      }}
    >
      {/* Card box */}
      <div
        style={{
          background: "rgba(7,16,10,0.82)",
          backdropFilter: "blur(10px)",
          borderRadius: "0 16px 0 0",
          borderTop: flush ? "1.5px solid rgba(77,168,98,0.7)" : "1px solid rgba(77,168,98,0.2)",
          borderRight: flush ? "1.5px solid rgba(77,168,98,0.7)" : "1px solid rgba(77,168,98,0.2)",
          // flush corner sits on the home indicator — pad the content up by
          // the safe-area inset so the box background still reaches the edge.
          padding: flush
            ? "8px 18px calc(4px + env(safe-area-inset-bottom)) 14px"
            : "12px 16px 16px 14px",
          boxShadow: flush ? "0 -2px 18px rgba(77,168,98,0.18)" : undefined,
          position: "relative",
        }}
      >
        {clipCount > 1 && (
          // "More clips here — swipe" affordance. Green pill + double
          // right-chevron that bobs to draw the eye toward the swipe.
          <div style={{ position: "absolute", top: 6, right: 6, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(77,168,98,0.95)", borderRadius: 99, padding: "5px 6px", boxShadow: "0 2px 8px rgba(0,0,0,0.45)" }}>
            <svg className="clip-swipe-bob" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="7 6 13 12 7 18" />
              <polyline points="13 6 19 12 13 18" opacity="0.5" />
            </svg>
          </div>
        )}
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 52,
          fontWeight: 400,
          color: "#fff",
          lineHeight: 1,
          letterSpacing: "-1px",
        }}>
          {holeNumber}
        </div>
        {holePar != null && (
          <div style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: 12,
            fontWeight: 400,
            color: "rgba(255,255,255,0.6)",
            letterSpacing: "0.5px",
            marginTop: 2,
          }}>
            Par {holePar}
          </div>
        )}
      </div>

    </div>
  );
}
