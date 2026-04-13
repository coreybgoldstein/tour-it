// Search page skeleton
export default function SearchLoading() {
  return (
    <div style={{ background: "#07100a", minHeight: "100vh", padding: "52px 16px 100px" }}>
      {/* Search bar */}
      <div style={pulse({ height: 46, borderRadius: 14, marginBottom: 20 })} />

      {/* Section label */}
      <div style={pulse({ width: 120, height: 12, borderRadius: 6, marginBottom: 14 })} />

      {/* Course cards */}
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={pulse({ width: 48, height: 48, borderRadius: 10 })} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={pulse({ width: `${55 + (i % 3) * 15}%`, height: 13, borderRadius: 6 })} />
            <div style={pulse({ width: `${35 + (i % 2) * 10}%`, height: 10, borderRadius: 5 })} />
          </div>
        </div>
      ))}

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
