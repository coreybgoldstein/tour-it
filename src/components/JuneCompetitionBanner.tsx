"use client";

import Link from "next/link";
import { useState } from "react";
import { isJuneActive, WILSON_ASSET_BASE } from "@/lib/competitions";
import { cdnImage } from "@/lib/cdnImage";

// June 2026 competition banner — Wilson Golf sponsored. Full-bleed
// strip (edge-to-edge) that sits flush beneath the sticky Tour It top
// bar. Background is the warm off-white of the Wilson product
// photography; product shots use mixBlendMode:multiply so their white
// backgrounds drop out and they blend in seamlessly with no visible
// tile edges.
//
// Assets live in Supabase Storage (the repo gitignores *.png), under
// tour-it-photos/competitions/wilson/. Each <img> hides on error so
// the unit stays clean if an asset is missing.

const BANNER_BG = "#ece9e2"; // matches Wilson product-shot background
const ASSET_BASE = WILSON_ASSET_BASE;

function ProductImg({ src, alt }: { src: string; alt: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <img src={cdnImage(src)} alt={alt} onError={() => setOk(false)} style={{ height: "100%", width: "auto", maxWidth: 72, objectFit: "contain", mixBlendMode: "multiply" }} />
  );
}

export default function JuneCompetitionBanner() {
  if (!isJuneActive()) return null;

  return (
    <Link href="/leaderboards?period=monthly&competition=1" style={{ display: "block", textDecoration: "none" }}>
      <div style={{
        width: "100%",
        height: 82,
        display: "flex",
        alignItems: "stretch",
        background: BANNER_BG,
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}>
        {/* Left: brand + headline + CTA */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, padding: "8px 0 8px 18px" }}>
          <div style={{ display: "flex" }}><WilsonMark /></div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 800, color: "#11150f", lineHeight: 1.1 }}>
            Win a Wilson Golf prize pack
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 700, color: "#2d7a42" }}>
            Play the Tour It June competition!
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </div>

        {/* Right: product photos, blended into the matching background */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, padding: "6px 16px 6px 8px" }}>
          <ProductImg src={`${ASSET_BASE}/staff-balls.png`} alt="Wilson Staff Model golf balls" />
          <ProductImg src={`${ASSET_BASE}/rope-hat.png`} alt="Wilson Script Rope Hat" />
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
    <img src={cdnImage(`${ASSET_BASE}/wilson-logo.png`)} alt="Wilson" onError={() => setOk(false)} style={{ height: 16, width: "auto", objectFit: "contain", mixBlendMode: "multiply" }} />
  );
}
