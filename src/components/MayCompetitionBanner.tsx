"use client";

import Link from "next/link";
import { isMayActive } from "@/lib/competitions";

export default function MayCompetitionBanner() {
  if (!isMayActive()) return null;

  return (
    <Link href="/leaderboards?period=monthly" style={{ display: "block", textDecoration: "none" }}>
      <div style={{
        position: "relative",
        background: "linear-gradient(90deg, #1e5c30 0%, #2d7a42 50%, #3a9954 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 18px",
        height: 44,
        cursor: "pointer",
        gap: 12,
        overflow: "hidden",
      }}>
        {/* Dot pattern overlay — matches the TopBar green sections for visual consistency */}
        <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)", backgroundSize: "16px 16px", pointerEvents: "none" }} />
        <span style={{ fontSize: 17, flexShrink: 0, lineHeight: 1, position: "relative", zIndex: 1 }}>🏆</span>
        <div style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 15,
          fontWeight: 600,
          color: "#fff",
          whiteSpace: "nowrap",
          overflow: "hidden",
          flex: 1,
          minWidth: 0,
          letterSpacing: "0.02em",
          position: "relative",
          zIndex: 1,
        }}>
          May Competition —{" "}
          <span style={{ color: "#d4a017", fontWeight: 700 }}>$100 GolfNow gift card</span>
          {" "}on the line
        </div>
        <span style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 22,
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
