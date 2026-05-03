"use client";

type Props = {
  pct: number;
  rankColor: string;
};

export default function LevelTracker({ pct, rankColor }: Props) {
  const clamped = Math.max(2, Math.min(96, pct));

  return (
    <>
      <style>{`
        @keyframes golf-ball-float {
          0%, 100% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 2px 6px rgba(0,0,0,0.6); }
          50% { transform: translate(-50%, calc(-50% - 2.5px)) scale(1.07); box-shadow: 0 5px 12px rgba(0,0,0,0.42); }
        }
      `}</style>

      <div style={{ marginTop: 8, marginBottom: 2 }}>
        {/* Bar + flag, all in one relative container */}
        <div style={{ position: "relative", paddingRight: 22 }}>
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
              left: 0, top: 0, bottom: 0,
              width: `${clamped}%`,
              borderRadius: 99,
              background: rankColor,
              overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 65%)",
              }} />
            </div>

            {/* Ball — animated, 20px on 14px bar */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: `${clamped}%`,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "radial-gradient(circle at 35% 28%, #ffffff 0%, #d8d8d8 100%)",
              zIndex: 2,
              animation: "golf-ball-float 2.4s ease-in-out infinite",
            }}>
              <div style={{ position: "absolute", top: "30%", left: "55%", width: 2.5, height: 2.5, borderRadius: "50%", background: "rgba(0,0,0,0.13)" }} />
              <div style={{ position: "absolute", top: "55%", left: "28%", width: 2.5, height: 2.5, borderRadius: "50%", background: "rgba(0,0,0,0.10)" }} />
              <div style={{ position: "absolute", top: "50%", left: "60%", width: 2, height: 2, borderRadius: "50%", background: "rgba(0,0,0,0.08)" }} />
              <div style={{ position: "absolute", top: "34%", left: "34%", width: 2, height: 2, borderRadius: "50%", background: "rgba(0,0,0,0.07)" }} />
            </div>
          </div>

          {/* Flag — planted at right end of bar, pole base at bar center */}
          <div style={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-82%)",
          }}>
            <svg width="18" height="28" viewBox="0 0 18 28" fill="none">
              <line x1="3" y1="27" x2="3" y2="1" stroke="rgba(255,255,255,0.38)" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M3 1 L17 7.5 L3 14 Z" fill="#e03030" />
            </svg>
          </div>
        </div>
      </div>
    </>
  );
}
