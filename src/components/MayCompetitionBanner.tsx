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
        padding: "10px 16px",
        cursor: "pointer",
      }}>
        <div style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 12,
          fontWeight: 500,
          color: "#fff",
          lineHeight: 1.45,
          flex: 1,
          minWidth: 0,
        }}>
          🏆&nbsp;&nbsp;May Competition — top the leaderboard, win a $50 GolfNow gift card
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
