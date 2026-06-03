"use client";

import { useEffect, useRef, useState } from "react";
import { POINTS_GROUPS } from "@/lib/pointsGroups";
import { SwipeGrip } from "@/components/SwipeGrip";
import { cdnImage } from "@/lib/cdnImage";
import { WILSON_ASSET_BASE, WILSON_SHOP_URL } from "@/lib/competitions";

type Props = { onClose: () => void };

const COMPETITION_GROUPS = POINTS_GROUPS;

// Assets live in Supabase Storage (the repo gitignores *.png).
const ASSET_BASE = WILSON_ASSET_BASE;

const PRIZE_PRODUCTS = [
  { src: `${ASSET_BASE}/staff-balls.png`, alt: "Wilson Staff Model golf balls" },
  { src: `${ASSET_BASE}/rope-hat.png`, alt: "Wilson Script Rope Hat" },
];

export default function JuneCompetitionModal({ onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <style>{`
        @keyframes june-slide-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes june-fade-in { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(7,16,10,0.72)", animation: "june-fade-in 0.2s ease" }}
      />

      <div ref={sheetRef} style={{
        position: "fixed",
        bottom: 0, left: 0, right: 0,
        zIndex: 1001,
        maxHeight: "88svh",
        background: "#0e1a13",
        borderRadius: "20px 20px 0 0",
        borderTop: "1px solid rgba(77,168,98,0.2)",
        overflowY: "auto",
        animation: "june-slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
        paddingBottom: "max(36px, calc(env(safe-area-inset-bottom) + 24px))",
        WebkitOverflowScrolling: "touch" as any,
        touchAction: "pan-y",
      }}>
        <SwipeGrip sheetRef={sheetRef} onClose={onClose} />

        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 16, right: 16,
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "50%", width: 32, height: 32,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "rgba(255,255,255,0.5)", flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div style={{ padding: "8px 24px 0" }}>
          {/* Sponsor chip — taps through to the Wilson Golf shop */}
          <a
            href={WILSON_SHOP_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.92)", borderRadius: 99, padding: "5px 12px", marginBottom: 14, textDecoration: "none" }}
          >
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(17,21,15,0.45)" }}>Powered by</span>
            <WilsonMark />
          </a>

          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 6, lineHeight: 1.2 }}>
            🏆 June Competition
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#4da862", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 24 }}>
            June 1 – June 30, 2026
          </div>

          <Section title="The Prize">
            <p style={body}>
              The golfer at the top of the June leaderboard on June 30 wins a{" "}
              <span style={{ color: "#fff", fontWeight: 600 }}>Wilson Golf prize pack</span>:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <PrizeRow>2 boxes of Wilson Staff Model golf balls <span style={{ color: "rgba(255,255,255,0.4)" }}>(24 balls)</span></PrizeRow>
              <PrizeRow>Wilson Script Rope Hat</PrizeRow>
            </div>
            {/* Product photos */}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {PRIZE_PRODUCTS.map((p) => <PrizeImg key={p.src} {...p} />)}
            </div>
          </Section>

          <Section title="How to Win">
            <p style={body}>
              Earn the most points between June 1 and June 30. Upload clips, tag your intel, get likes and saves — every action you already take on Tour It counts. Points accumulate across the full month.
            </p>
          </Section>

          <Section title="How Points Work">
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
              {COMPETITION_GROUPS.map((group) => (
                <div key={group.title}>
                  <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(77,168,98,0.85)", marginBottom: 6, paddingLeft: 2 }}>
                    {group.title}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
                    {group.rows.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "10px 14px",
                          borderBottom: i < group.rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                        }}
                      >
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
                          {item.label}
                        </div>
                        <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, color: item.negative ? "rgba(240,100,100,0.8)" : "#4da862", flexShrink: 0, marginLeft: 12 }}>
                          {item.display}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Tie-Breaker">
            <p style={body}>
              If two golfers are tied on June 30, the golfer who reached that point total first wins.
            </p>
          </Section>

          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.4)", fontStyle: "italic", textAlign: "center", marginTop: 28, lineHeight: 1.6 }}>
            Thanks for participating and helping build the Tour It community!
          </p>
        </div>
      </div>
    </>
  );
}

const body: React.CSSProperties = {
  fontFamily: "'Outfit', sans-serif",
  fontSize: 14,
  color: "rgba(255,255,255,0.6)",
  lineHeight: 1.7,
  margin: 0,
};

function PrizeRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(77,168,98,0.06)", border: "1px solid rgba(77,168,98,0.18)", borderRadius: 10, padding: "10px 12px" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4da862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{children}</span>
    </div>
  );
}

function PrizeImg({ src, alt }: { src: string; alt: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <div style={{ flex: 1, minWidth: 0, aspectRatio: "1 / 1", borderRadius: 10, background: "#fff", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <img src={cdnImage(src)} alt={alt} onError={() => setOk(false)} style={{ width: "100%", height: "100%", objectFit: "contain", mixBlendMode: "multiply" }} />
    </div>
  );
}

function WilsonMark() {
  const [ok, setOk] = useState(true);
  if (!ok) {
    return (
      <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontSize: 16, fontWeight: 800, color: "#11150f" }}>Wilson</span>
    );
  }
  return (
    <img src={cdnImage(`${ASSET_BASE}/wilson-logo.png`)} alt="Wilson" onError={() => setOk(false)} style={{ height: 15, width: "auto", objectFit: "contain" }} />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}
