// Leaderboards skeleton — period tabs + ranked row placeholders
export default function LeaderboardsLoading() {
  return (
    <div style={{ background: "#07100a", minHeight: "100dvh", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: "calc(20px + env(safe-area-inset-top)) 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={pulse({ width: 140, height: 22, borderRadius: 6 })} />
      </div>

      {/* Period tabs (Weekly / Monthly / All-time) */}
      <div style={{ display: "flex", gap: 8, padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={pulse({ width: 90, height: 32, borderRadius: 99 })} />
        <div style={pulse({ width: 90, height: 32, borderRadius: 99 })} />
        <div style={pulse({ width: 90, height: 32, borderRadius: 99 })} />
      </div>

      {/* Ranked rows */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={pulse({ width: 24, height: 14, borderRadius: 4 })} />
            <div style={pulse({ width: 36, height: 36, borderRadius: "50%" })} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={pulse({ width: `${45 + (i % 3) * 12}%`, height: 13, borderRadius: 4 })} />
              <div style={pulse({ width: `${25 + (i % 2) * 12}%`, height: 10, borderRadius: 4 })} />
            </div>
            <div style={pulse({ width: 50, height: 14, borderRadius: 4 })} />
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
