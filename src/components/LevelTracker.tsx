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
            {/* Highlight overlay — brightens the top edge for dimension */}
            <div style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 65%)",
            }} />
          </div>

          {/* Ball — overflows the track height */}
          <div style={{
            position: "absolute",
            top: "50%",
            left: `${clamped}%`,
            transform: "translate(-50%, -50%)",
            width: 13,
            height: 13,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 28%, #ffffff 0%, #dedede 100%)",
            boxShadow: "0 2px 5px rgba(0,0,0,0.55)",
            zIndex: 2,
          }}>
            {/* Dimples */}
            <div style={{ position: "absolute", top: "30%", left: "54%", width: 2, height: 2, borderRadius: "50%", background: "rgba(0,0,0,0.14)" }} />
            <div style={{ position: "absolute", top: "56%", left: "28%", width: 2, height: 2, borderRadius: "50%", background: "rgba(0,0,0,0.11)" }} />
            <div style={{ position: "absolute", top: "52%", left: "58%", width: 1.5, height: 1.5, borderRadius: "50%", background: "rgba(0,0,0,0.09)" }} />
          </div>
        </div>
      </div>

      {/* Flag */}
      <svg width="13" height="20" viewBox="0 0 13 20" fill="none" style={{ flexShrink: 0 }}>
        <line x1="2" y1="19.5" x2="2" y2="1" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M2 1 L12 5 L2 9 Z" fill="#e8c560" />
      </svg>
    </div>
  );
}
