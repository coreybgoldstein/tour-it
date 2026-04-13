// Course page skeleton
export default function CourseLoading() {
  return (
    <div style={{ background: "#07100a", minHeight: "100vh", paddingBottom: 100 }}>
      {/* Header / cover */}
      <div style={pulse({ height: 220, width: "100%", borderRadius: 0 })} />

      {/* Course info */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={pulse({ width: 52, height: 52, borderRadius: 12 })} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={pulse({ width: "65%", height: 18, borderRadius: 8 })} />
            <div style={pulse({ width: "45%", height: 13, borderRadius: 6 })} />
          </div>
        </div>

        {/* Hole row */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={pulse({ width: 44, height: 44, borderRadius: 10, flexShrink: 0 })} />
          ))}
        </div>
      </div>

      {/* Feed skeleton cards */}
      <div style={{ padding: "16px 0" }}>
        {[1, 2].map(i => (
          <div key={i} style={{ height: "calc(100svh - 320px)", margin: "0 0 8px", background: "rgba(255,255,255,0.03)", position: "relative" }}>
            <div style={{ position: "absolute", top: 16, left: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={pulse({ width: 36, height: 36, borderRadius: 8 })} />
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={pulse({ width: 120, height: 12, borderRadius: 5 })} />
                <div style={pulse({ width: 80, height: 10, borderRadius: 5 })} />
              </div>
            </div>
            <div style={{ position: "absolute", right: 16, bottom: 80, display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
              <div style={pulse({ width: 32, height: 32, borderRadius: "50%" })} />
              <div style={pulse({ width: 32, height: 32, borderRadius: "50%" })} />
              <div style={pulse({ width: 32, height: 32, borderRadius: "50%" })} />
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
