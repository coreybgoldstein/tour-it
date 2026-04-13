// Home feed skeleton — shown while page.tsx loads
export default function HomeLoading() {
  return (
    <div style={{ background: "#07100a", minHeight: "100vh", overflow: "hidden" }}>
      {/* Fake feed card — full viewport */}
      <div style={{ height: "100svh", position: "relative", background: "rgba(255,255,255,0.03)" }}>
        {/* Top bar skeleton */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "16px 16px 0", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={pulse({ width: 40, height: 40, borderRadius: 10 })} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={pulse({ width: 140, height: 13, borderRadius: 6 })} />
              <div style={pulse({ width: 100, height: 10, borderRadius: 5 })} />
            </div>
          </div>
        </div>

        {/* Right sidebar skeleton */}
        <div style={{ position: "absolute", right: 16, bottom: 120, display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
          <div style={pulse({ width: 36, height: 36, borderRadius: "50%" })} />
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={pulse({ width: 32, height: 32, borderRadius: "50%" })} />
              <div style={pulse({ width: 20, height: 8, borderRadius: 4 })} />
            </div>
          ))}
        </div>

        {/* Bottom gradient overlay */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 160, background: "linear-gradient(to top, rgba(7,16,10,0.8), transparent)" }} />
      </div>

      <style>{`
        @keyframes shimmer {
          0% { opacity: 0.4; }
          50% { opacity: 0.7; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </div>
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
