// Hole detail skeleton — full-bleed dark page with the course pill, hole
// identity card, and right-rail action buttons in placeholder form. The
// goal is for the tap-on-hole → first-paint gap to feel instant rather
// than reveal a dark blank screen while the hole's data fetches.
export default function HoleLoading() {
  return (
    <main style={{ height: "100svh", background: "#000", overflow: "hidden", position: "relative" }}>
      {/* Top course pill placeholder — matches ClipTopPill position */}
      <div style={{
        position: "absolute",
        top: "calc(12px + env(safe-area-inset-top))",
        left: 12,
        right: 12,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.55)", borderRadius: 999, padding: "5px 12px 5px 5px" }}>
          <div style={pulse({ width: 26, height: 26, borderRadius: 7 })} />
          <div style={pulse({ width: 140, height: 12, borderRadius: 5 })} />
        </div>
        <div style={pulse({ width: 32, height: 32, borderRadius: "50%", marginLeft: "auto" })} />
      </div>

      {/* Right rail action placeholders */}
      <div style={{
        position: "absolute",
        right: 12,
        bottom: "calc(100px + env(safe-area-inset-bottom))",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        zIndex: 30,
      }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={pulse({ width: 44, height: 44, borderRadius: "50%" })} />
        ))}
      </div>

      {/* Hole identity card placeholder — bottom-left, flush with BottomNav */}
      <div style={{
        position: "absolute",
        bottom: "calc(68px + env(safe-area-inset-bottom))",
        left: 0,
        zIndex: 101,
        background: "rgba(7,16,10,0.82)",
        borderTop: "1px solid rgba(77,168,98,0.2)",
        borderRight: "1px solid rgba(77,168,98,0.2)",
        borderRadius: "0 16px 0 0",
        padding: "12px 16px 16px 14px",
      }}>
        <div style={pulse({ width: 36, height: 48, borderRadius: 4 })} />
        <div style={pulse({ width: 36, height: 12, borderRadius: 4, marginTop: 6 })} />
      </div>

      <style>{`
        @keyframes shimmer {
          0% { opacity: 0.4; }
          50% { opacity: 0.7; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </main>
  );
}

function pulse(extra: React.CSSProperties): React.CSSProperties {
  return {
    background: "rgba(255,255,255,0.08)",
    animation: "shimmer 1.4s ease-in-out infinite",
    flexShrink: 0,
    ...extra,
  };
}
