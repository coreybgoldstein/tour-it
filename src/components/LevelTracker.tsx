"use client";

type Props = {
  pct: number;
  rankColor: string;
};

export default function LevelTracker({ pct, rankColor }: Props) {
  const clamped = Math.max(2, Math.min(96, pct));

  return (
    <div style={{ marginTop: 6, marginBottom: 2 }}>
      {/* paddingRight = svgWidth(14) - poleX(2.5) = 11.5, pole sits at bar end */}
      <div style={{ position: "relative", paddingRight: 11 }}>
        {/* Track */}
        <div style={{
          height: 5,
          borderRadius: 99,
          background: "rgba(255,255,255,0.07)",
          position: "relative",
        }}>
          {/* Fill */}
          <div style={{
            position: "absolute",
            left: 0, top: 0, bottom: 0,
            width: `${clamped}%`,
            borderRadius: 99,
            background: rankColor,
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, transparent 70%)",
            }} />
          </div>

          {/* Ball — simplified for small size */}
          <div style={{
            position: "absolute",
            top: "50%",
            left: `${clamped}%`,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "radial-gradient(circle at 36% 30%, #ffffff 0%, #eaedf1 32%, #c6ccd6 72%, #b4bcc8 100%)",
            transform: "translate(-50%, -50%)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.55)",
            zIndex: 2,
          }}>
            <div style={{ position: "absolute", top: "10%", left: "12%", width: "44%", height: "38%", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0) 72%)" }} />
          </div>
        </div>

        {/* Flag — pole at x=2.5 in 14px SVG → sits 11.5px from right = exactly at bar end */}
        <div style={{
          position: "absolute",
          right: 0,
          top: "50%",
          transform: "translateY(-78%)",
        }}>
          <svg width="14" height="22" viewBox="0 0 14 22" fill="none">
            <line x1="2.5" y1="21" x2="2.5" y2="1" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M2.5 1 L13 6 L2.5 11 Z" fill="#e03030" />
          </svg>
        </div>
      </div>
    </div>
  );
}
