"use client";

import { useEffect, useRef, useState } from "react";

export function HoleIdentityCard({
  holeNumber,
  holePar,
  clipCount,
}: {
  holeNumber?: number | null;
  holePar?: number | null;
  clipCount: number;
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
        bottom: 100,
        left: 0,
        zIndex: 101,
        background: "rgba(7,16,10,0.82)",
        backdropFilter: "blur(10px)",
        borderRadius: "0 16px 0 0",
        borderTop: "1px solid rgba(77,168,98,0.2)",
        borderRight: "1px solid rgba(77,168,98,0.2)",
        padding: "12px 16px 16px 14px",
        opacity,
        transition: "opacity 150ms ease",
        pointerEvents: "none",
      }}
    >
      {clipCount > 1 && (
        <div style={{ position: "absolute", top: 8, right: 8, opacity: 0.55, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.8))" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="15" height="14" rx="2" />
            <path d="M7 4h12a2 2 0 0 1 2 2v12" />
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
  );
}
