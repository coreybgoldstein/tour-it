// Lists page skeleton — tabs row + saved-course row placeholders
export default function ListsLoading() {
  return (
    <div style={{ background: "#07100a", minHeight: "100dvh", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: "calc(20px + env(safe-area-inset-top)) 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={pulse({ width: 80, height: 22, borderRadius: 6 })} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 14, padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={pulse({ width: 70, height: 30, borderRadius: 99 })} />
        <div style={pulse({ width: 90, height: 30, borderRadius: 99 })} />
        <div style={pulse({ width: 80, height: 30, borderRadius: 99 })} />
      </div>

      {/* Course rows */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={pulse({ width: 40, height: 40, borderRadius: 10 })} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={pulse({ width: `${55 + (i % 3) * 12}%`, height: 14, borderRadius: 5 })} />
              <div style={pulse({ width: `${35 + (i % 2) * 12}%`, height: 11, borderRadius: 4 })} />
            </div>
            <div style={pulse({ width: 12, height: 12, borderRadius: "50%" })} />
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
