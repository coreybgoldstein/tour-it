"use client";

import Link from "next/link";
import { isMayActive } from "@/lib/competitions";

export default function MayCompetitionBanner() {
  if (!isMayActive()) return null;

  return (
    <Link href="/leaderboards?period=monthly" style={{ display: "block", textDecoration: "none" }}>
      <div className="may-banner" style={{
        position: "relative",
        background: "linear-gradient(90deg, #1e5c30 0%, #2d7a42 50%, #3a9954 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 14px",
        height: 44,
        cursor: "pointer",
        gap: 8,
        overflow: "hidden",
      }}>
        {/* Dot pattern overlay — matches the TopBar green sections for visual consistency */}
        <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)", backgroundSize: "16px 16px", pointerEvents: "none" }} />
        <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1, position: "relative", zIndex: 1 }}>🏆</span>
        <div style={{
          fontFamily: "'Outfit', sans-serif",
          // Scale with viewport so the full string fits from 360px iPhones
          // up through Pro Max. Caps at 14px so it never gets larger than
          // the previous design on big screens.
          fontSize: "clamp(11.5px, 3.4vw, 14px)",
          fontWeight: 600,
          color: "#fff",
          whiteSpace: "nowrap",
          overflow: "hidden",
          flex: 1,
          minWidth: 0,
          letterSpacing: 0,
          position: "relative",
          zIndex: 1,
        }}>
          May Competition —{" "}
          <span style={{ color: "#d4a017", fontWeight: 800, letterSpacing: "0.01em" }}>$100 GOLFNOW CREDIT</span>
          {" "}on the line
        </div>
        <span style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 20,
          fontWeight: 300,
          color: "rgba(255,255,255,0.7)",
          flexShrink: 0,
          lineHeight: 1,
          position: "relative",
          zIndex: 1,
        }}>›</span>
      </div>
    </Link>
  );
}
