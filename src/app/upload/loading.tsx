// Upload flow skeleton — back button + step label + course picker placeholder
// while the page bundle + auth check resolve. Stops the "blank dark screen"
// gap when tapping the green Upload tab.
export default function UploadLoading() {
  return (
    <div style={{ background: "#07100a", minHeight: "100dvh" }}>
      {/* Sticky header — matches the real upload-header structure */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(20px + env(safe-area-inset-top)) 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={pulse({ width: 36, height: 36, borderRadius: "50%" })} />
        <div style={pulse({ width: 140, height: 14, borderRadius: 6 })} />
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: "rgba(255,255,255,0.06)", margin: "0 20px 28px", borderRadius: 99 }}>
        <div style={{ height: 2, width: "16%", background: "#4da862", borderRadius: 99 }} />
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px" }}>
        {/* Step label + title + sub */}
        <div style={pulse({ width: 70, height: 11, borderRadius: 4, marginBottom: 8 })} />
        <div style={pulse({ width: "75%", height: 26, borderRadius: 6, marginBottom: 6 })} />
        <div style={pulse({ width: "55%", height: 13, borderRadius: 5, marginBottom: 24 })} />

        {/* Search input */}
        <div style={pulse({ width: "100%", height: 44, borderRadius: 12, marginBottom: 12 })} />

        {/* Course list rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={pulse({ width: 38, height: 38, borderRadius: 10 })} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={pulse({ width: `${50 + (i % 3) * 10}%`, height: 14, borderRadius: 5 })} />
                <div style={pulse({ width: `${30 + (i % 2) * 15}%`, height: 11, borderRadius: 4 })} />
              </div>
            </div>
          ))}
        </div>
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
