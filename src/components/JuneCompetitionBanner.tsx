"use client";

import Link from "next/link";
import { useState } from "react";
import { isJuneActive } from "@/lib/competitions";

// June 2026 competition banner — Wilson Golf sponsored. Full-bleed
// strip (edge-to-edge, IAB Large Mobile Banner height of 100px) that
// sits flush beneath the sticky Tour It top bar. Background is the
// warm off-white of the Wilson product photography so the product
// cut-outs blend in seamlessly with no visible tile edges.
//
// Assets live in /public/competitions/wilson/. Each <img> hides on
// error so the unit stays clean until the files are dropped in.

const BANNER_BG = "#ece9e2"; // matches Wilson product-shot background

function ProductImg({ src, alt }: { src: string; alt: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <img src={src} alt={alt} onError={() => setOk(false)} style={{ height: "100%", width: "auto", maxWidth: 64, objectFit: "contain" }} />
  );
}

export default function JuneCompetitionBanner() {
  if (!isJuneActive()) return null;

  return (
    <Link href="/leaderboards?period=monthly&competition=1" style={{ display: "block", textDecoration: "none" }}>
      <div style={{
        width: "100%",
        height: 100,
        display: "flex",
        alignItems: "stretch",
        background: BANNER_BG,
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}>
        {/* Left: brand + headline + CTA */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, padding: "10px 0 10px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <WilsonMark />
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 7.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#2d7a42" }}>June</span>
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 800, color: "#11150f", lineHeight: 1.1 }}>
            Win a Wilson Prize Pack
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 700, color: "#2d7a42" }}>
            See the prize
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </div>

        {/* Right: product photos, blended into the matching background */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, padding: "8px 16px 8px 8px" }}>
          <ProductImg src="/competitions/wilson/staff-balls.png" alt="Wilson Staff Model golf balls" />
          <ProductImg src="/competitions/wilson/rope-hat.png" alt="Wilson Script Rope Hat" />
        </div>
      </div>
    </Link>
  );
}

// Real Wilson wordmark; styled text fallback only if the file is
// missing so the unit is never broken.
function WilsonMark() {
  const [ok, setOk] = useState(true);
  if (!ok) {
    return (
      <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontSize: 15, fontWeight: 800, color: "#11150f", letterSpacing: "-0.01em" }}>Wilson</span>
    );
  }
  return (
    <img src="/competitions/wilson/wilson-logo.png" alt="Wilson" onError={() => setOk(false)} style={{ height: 15, width: "auto", objectFit: "contain" }} />
  );
}
