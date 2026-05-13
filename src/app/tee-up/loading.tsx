// Tee-up (golf trips) skeleton — header + trip card placeholders
export default function TeeUpLoading() {
  return (
    <div style={{ background: "#07100a", minHeight: "100dvh", paddingBottom: 100 }}>
      <div style={{ padding: "calc(20px + env(safe-area-inset-top)) 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={pulse({ width: 110, height: 22, borderRadius: 6 })} />
      </div>

      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={pulse({ width: `${50 + (i % 2) * 15}%`, height: 16, borderRadius: 5 })} />
              <div style={pulse({ width: 60, height: 11, borderRadius: 4 })} />
            </div>
            <div style={{ display: "flex", gap: -8 }}>
              {Array.from({ length: 3 }).map((__, j) => (
                <div key={j} style={pulse({ width: 28, height: 28, borderRadius: "50%", marginLeft: j === 0 ? 0 : -8, border: "2px solid #07100a" })} />
              ))}
            </div>
          </div>
        ))}
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
