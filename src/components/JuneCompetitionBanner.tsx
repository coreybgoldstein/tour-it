"use client";

import Link from "next/link";
import { useState } from "react";
import { isJuneActive, WILSON_ASSET_BASE } from "@/lib/competitions";
import { cdnImage } from "@/lib/cdnImage";

// June 2026 competition banner — Wilson Golf sponsored. Full-bleed
// strip that sits flush beneath the sticky Tour It top bar. Styled as a
// native Tour It module (green-tinted card, white headline, green CTA)
// rather than a drop-in ad: the sponsor logo + product shots ride on
// small white tiles — the same treatment course logos get across the
// app — so the white-background photography reads cleanly on the dark
// green field.
//
// Assets live in Supabase Storage (the repo gitignores *.png), under
// tour-it-photos/competitions/wilson/. Each <img> hides on error so
// the unit stays clean if an asset is missing.

const ASSET_BASE = WILSON_ASSET_BASE;

// Both product shots ride together on a single white tile so they read
// as one connected unit. A secondary-green outline with interior spacing
// echoes the banner's own border. Each <img> hides on error; the tile
// disappears entirely only if both are missing.
function ProductDuo({ items }: { items: { src: string; alt: string }[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = items.filter((it) => !hidden.has(it.src));
  if (visible.length === 0) return null;
  return (
    <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, background: "#fff", borderRadius: 12, padding: "5px 13px", border: "1px solid rgba(45,122,66,0.45)", flexShrink: 0 }}>
      {visible.map((it) => (
        <img key={it.src} src={cdnImage(it.src)} alt={it.alt} onError={() => setHidden((s) => new Set(s).add(it.src))} style={{ height: "100%", width: "auto", maxWidth: 54, objectFit: "contain", display: "block" }} />
      ))}
    </div>
  );
}

export default function JuneCompetitionBanner() {
  if (!isJuneActive()) return null;

  return (
    <Link href="/leaderboards?period=monthly&competition=1" style={{ display: "block", textDecoration: "none" }}>
      <div style={{
        width: "100%",
        height: 72,
        display: "flex",
        alignItems: "stretch",
        background: "linear-gradient(135deg, rgba(77,168,98,0.20) 0%, rgba(45,122,66,0.06) 100%), #0b1f14",
        borderBottom: "1px solid rgba(77,168,98,0.22)",
        overflow: "hidden",
      }}>
        {/* Left: brand chip + headline + CTA */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, padding: "8px 0 8px 18px" }}>
          <WilsonMark />
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16.5, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
            Win a Wilson Golf prize pack
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "'Outfit', sans-serif", fontSize: 10.5, fontWeight: 700, color: "#4da862" }}>
            Play the Tour It June competition!
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
        </div>

        {/* Right: both product shots on a single connected white tile */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", padding: "6px 16px 6px 8px" }}>
          <ProductDuo items={[
            { src: `${ASSET_BASE}/staff-balls.png`, alt: "Wilson Staff Model golf balls" },
            { src: `${ASSET_BASE}/rope-hat.png`, alt: "Wilson Script Rope Hat" },
          ]} />
        </div>
      </div>
    </Link>
  );
}

// Wilson wordmark on a small white chip so the dark-on-white logo stays
// legible against the green field. Styled-text fallback if the file is
// missing so the unit is never broken.
function WilsonMark() {
  const [ok, setOk] = useState(true);
  return (
    <span style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", background: "#fff", borderRadius: 6, padding: "2px 7px", border: "1px solid rgba(77,168,98,0.25)" }}>
      {ok ? (
        <img src={cdnImage(`${ASSET_BASE}/wilson-logo.png`)} alt="Wilson" onError={() => setOk(false)} style={{ height: 12, width: "auto", objectFit: "contain", display: "block" }} />
      ) : (
        <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontSize: 12, fontWeight: 800, color: "#11150f", letterSpacing: "-0.01em" }}>Wilson</span>
      )}
    </span>
  );
}
