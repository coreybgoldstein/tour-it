"use client";

type Props = {
  pct: number;        // 0–100
  rankColor: string;  // from getRankColor()
};

export default function LevelTracker({ pct, rankColor }: Props) {
  const clamped = Math.max(2, Math.min(97, pct));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 2 }}>
      {/* Bar + ball */}
      <div style={{ flex: 1, position: "relative" }}>
        {/* Track */}
        <div style={{
          height: 14,
          borderRadius: 99,
          background: "rgba(255,255,255,0.07)",
          position: "relative",
        }}>
          {/* Fill */}
          <div style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${clamped}%`,
            borderRadius: 99,
            background: rankColor,
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 65%)",
            }} />
          </div>

          {/* Ball — 20px on a 14px bar, overflows 3px above and below */}
          <div style={{
            position: "absolute",
            top: "50%",
            left: `${clamped}%`,
            transform: "translate(-50%, -50%)",
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 28%, #ffffff 0%, #d8d8d8 100%)",
            boxShadow: "0 2px 6px rgba(0,0,0,0.6)",
            zIndex: 2,
          }}>
            {/* Dimples */}
            <div style={{ position: "absolute", top: "30%", left: "55%", width: 2.5, height: 2.5, borderRadius: "50%", background: "rgba(0,0,0,0.13)" }} />
            <div style={{ position: "absolute", top: "55%", left: "28%", width: 2.5, height: 2.5, borderRadius: "50%", background: "rgba(0,0,0,0.10)" }} />
            <div style={{ position: "absolute", top: "50%", left: "58%", width: 2, height: 2, borderRadius: "50%", background: "rgba(0,0,0,0.08)" }} />
            <div style={{ position: "absolute", top: "34%", left: "34%", width: 2, height: 2, borderRadius: "50%", background: "rgba(0,0,0,0.07)" }} />
          </div>
        </div>
      </div>

      {/* Flag — red to match Tour It logo */}
      <svg width="13" height="20" viewBox="0 0 13 20" fill="none" style={{ flexShrink: 0 }}>
        <line x1="2" y1="19.5" x2="2" y2="1" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M2 1 L12 5 L2 9 Z" fill="#e03030" />
      </svg>
    </div>
  );
}
