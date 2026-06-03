"use client";

import Link from "next/link";
import { useState } from "react";
import { isJuneActive } from "@/lib/competitions";

// June 2026 competition banner — Wilson Golf sponsored. Thicker than
// the May strip so it can carry the Wilson wordmark plus product
// photos. Co-marketing look: a cream Wilson card (so the black logo
// and product shots read true to brand) framed by a Tour It green
// border. Tapping opens the leaderboard with the details modal.
//
// Product images live in /public/competitions/wilson/. Each <img>
// hides itself on load error so the banner stays clean until the
// assets are dropped in.

const PRODUCTS = [
  { src: "/competitions/wilson/staff-balls.png", alt: "Wilson Staff Model golf balls" },
  { src: "/competitions/wilson/rope-hat.png", alt: "Wilson Script Rope Hat" },
  { src: "/competitions/wilson/polo.png", alt: "Wilson golf polo" },
];

function ProductImg({ src, alt }: { src: string; alt: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <div style={{ flex: 1, minWidth: 0, aspectRatio: "1 / 1", borderRadius: 10, background: "#fff", border: "1px solid rgba(17,21,15,0.08)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img src={src} alt={alt} onError={() => setOk(false)} style={{ width: "100%", height: "100%", objectFit: "contain", mixBlendMode: "multiply" }} />
    </div>
  );
}

export default function JuneCompetitionBanner() {
  if (!isJuneActive()) return null;

  return (
    <Link href="/leaderboards?period=monthly&competition=1" style={{ display: "block", textDecoration: "none" }}>
      <div style={{
        position: "relative",
        margin: "0 0 2px",
        background: "linear-gradient(180deg, #f4f2ec 0%, #ece8df 100%)",
        border: "1px solid rgba(77,168,98,0.35)",
        borderRadius: 14,
        padding: 14,
        overflow: "hidden",
        boxShadow: "0 1px 0 rgba(255,255,255,0.4) inset",
      }}>
        {/* Top row: Wilson wordmark + month chip */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
          <WilsonMark />
          <span style={{
            flexShrink: 0,
            fontFamily: "'Outfit', sans-serif", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "#fff",
            background: "#2d7a42", borderRadius: 99, padding: "4px 10px",
          }}>
            June Competition
          </span>
        </div>

        {/* Headline */}
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 800, color: "#11150f", lineHeight: 1.15, marginBottom: 3 }}>
          Win a Wilson Golf Prize Pack
        </div>
        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11.5, fontWeight: 500, color: "rgba(17,21,15,0.55)", marginBottom: 12 }}>
          2 boxes of balls · Script Rope Hat · Wilson polo
        </div>

        {/* Product strip */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {PRODUCTS.map((p) => <ProductImg key={p.src} {...p} />)}
        </div>

        {/* CTA */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(17,21,15,0.5)" }}>
            Top the June leaderboard to win
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, color: "#2d7a42" }}>
            See the prize
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

// Wilson wordmark image with a styled text fallback so the banner is
// never broken even before the logo file is added.
function WilsonMark() {
  const [ok, setOk] = useState(true);
  if (!ok) {
    return (
      <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontSize: 20, fontWeight: 800, color: "#11150f", letterSpacing: "-0.01em" }}>
        Wilson
      </span>
    );
  }
  return (
    <img
      src="/competitions/wilson/wilson-logo.png"
      alt="Wilson"
      onError={() => setOk(false)}
      style={{ height: 20, width: "auto", objectFit: "contain" }}
    />
  );
}
