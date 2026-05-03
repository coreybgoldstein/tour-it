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
          0%, 100% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 2px 8px rgba(0,0,0,0.55); }
          50% { transform: translate(-50%, calc(-50% - 3px)) scale(1.06); box-shadow: 0 6px 14px rgba(0,0,0,0.38); }
        }
      `}</style>

      <div style={{ marginTop: 8, marginBottom: 2 }}>
        {/* paddingRight = svgWidth(18) - poleX(3) = 15, so pole sits exactly at bar end */}
        <div style={{ position: "relative", paddingRight: 15 }}>
          {/* Track */}
          <div style={{
            height: 10,
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

            {/* Ball */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: `${clamped}%`,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "radial-gradient(circle at 36% 30%, #ffffff 0%, #eaedf1 28%, #c6ccd6 68%, #b4bcc8 100%)",
              zIndex: 2,
              animation: "golf-ball-float 2.4s ease-in-out infinite",
            }}>
              {/* Specular highlight */}
              <div style={{ position: "absolute", top: "7%", left: "9%", width: "44%", height: "38%", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0) 72%)" }} />
              {/* Dimples — 15 dots in a realistic spread pattern */}
              <div style={{ position: "absolute", top: "20%", left: "55%", width: 2.5, height: 2.5, borderRadius: "50%", background: "rgba(0,0,0,0.13)", boxShadow: "0 0.5px 0 rgba(255,255,255,0.35)" }} />
              <div style={{ position: "absolute", top: "18%", left: "73%", width: 2, height: 2, borderRadius: "50%", background: "rgba(0,0,0,0.11)", boxShadow: "0 0.5px 0 rgba(255,255,255,0.3)" }} />
              <div style={{ position: "absolute", top: "34%", left: "44%", width: 2.5, height: 2.5, borderRadius: "50%", background: "rgba(0,0,0,0.12)", boxShadow: "0 0.5px 0 rgba(255,255,255,0.32)" }} />
              <div style={{ position: "absolute", top: "32%", left: "63%", width: 2.5, height: 2.5, borderRadius: "50%", background: "rgba(0,0,0,0.14)", boxShadow: "0 0.5px 0 rgba(255,255,255,0.35)" }} />
              <div style={{ position: "absolute", top: "30%", left: "80%", width: 2, height: 2, borderRadius: "50%", background: "rgba(0,0,0,0.12)", boxShadow: "0 0.5px 0 rgba(255,255,255,0.3)" }} />
              <div style={{ position: "absolute", top: "47%", left: "28%", width: 2, height: 2, borderRadius: "50%", background: "rgba(0,0,0,0.10)", boxShadow: "0 0.5px 0 rgba(255,255,255,0.28)" }} />
              <div style={{ position: "absolute", top: "46%", left: "52%", width: 2.5, height: 2.5, borderRadius: "50%", background: "rgba(0,0,0,0.15)", boxShadow: "0 0.5px 0 rgba(255,255,255,0.36)" }} />
              <div style={{ position: "absolute", top: "44%", left: "71%", width: 2.5, height: 2.5, borderRadius: "50%", background: "rgba(0,0,0,0.14)", boxShadow: "0 0.5px 0 rgba(255,255,255,0.34)" }} />
              <div style={{ position: "absolute", top: "48%", left: "84%", width: 2, height: 2, borderRadius: "50%", background: "rgba(0,0,0,0.12)", boxShadow: "0 0.5px 0 rgba(255,255,255,0.3)" }} />
              <div style={{ position: "absolute", top: "62%", left: "37%", width: 2.5, height: 2.5, borderRadius: "50%", background: "rgba(0,0,0,0.16)", boxShadow: "0 0.5px 0 rgba(255,255,255,0.34)" }} />
              <div style={{ position: "absolute", top: "60%", left: "57%", width: 2.5, height: 2.5, borderRadius: "50%", background: "rgba(0,0,0,0.16)", boxShadow: "0 0.5px 0 rgba(255,255,255,0.34)" }} />
              <div style={{ position: "absolute", top: "62%", left: "74%", width: 2, height: 2, borderRadius: "50%", background: "rgba(0,0,0,0.14)", boxShadow: "0 0.5px 0 rgba(255,255,255,0.3)" }} />
              <div style={{ position: "absolute", top: "74%", left: "26%", width: 2, height: 2, borderRadius: "50%", background: "rgba(0,0,0,0.15)", boxShadow: "0 0.5px 0 rgba(255,255,255,0.3)" }} />
              <div style={{ position: "absolute", top: "72%", left: "47%", width: 2.5, height: 2.5, borderRadius: "50%", background: "rgba(0,0,0,0.17)", boxShadow: "0 0.5px 0 rgba(255,255,255,0.32)" }} />
              <div style={{ position: "absolute", top: "74%", left: "65%", width: 2, height: 2, borderRadius: "50%", background: "rgba(0,0,0,0.15)", boxShadow: "0 0.5px 0 rgba(255,255,255,0.28)" }} />
            </div>
          </div>

          {/* Flag — pole at x=3 in 18px SVG → sits 15px from right = exactly at bar end */}
          <div style={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-80%)",
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
