"use client";

import Link from "next/link";
import { isMayActive } from "@/lib/competitions";

export default function MayCompetitionBanner() {
  if (!isMayActive()) return null;

  return (
    <Link href="/leaderboards?period=monthly" style={{ display: "block", textDecoration: "none" }}>
      <div style={{
        background: "linear-gradient(90deg, #2d7a42 0%, #4da862 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        height: 44,
        cursor: "pointer",
      }}>
        <div style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 13,
          fontWeight: 500,
          color: "#fff",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          flex: 1,
          minWidth: 0,
        }}>
          🏆&nbsp;&nbsp;May Competition — Top the leaderboard, win a $50 GolfNow card
        </div>
        <span style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 20,
          fontWeight: 300,
          color: "rgba(255,255,255,0.75)",
          marginLeft: 10,
          flexShrink: 0,
          lineHeight: 1,
        }}>›</span>
      </div>
    </Link>
  );
}
