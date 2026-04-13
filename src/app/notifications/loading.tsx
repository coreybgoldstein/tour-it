// Notifications page skeleton
export default function NotificationsLoading() {
  return (
    <div style={{ background: "#07100a", minHeight: "100vh", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "52px 20px 16px", borderBottom: "1px solid rgba(77,168,98,0.15)" }}>
        <div style={pulse({ width: 28, height: 28, borderRadius: 8 })} />
        <div style={pulse({ width: 130, height: 20, borderRadius: 8 })} />
      </div>

      {/* Notification rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={pulse({ width: 32, height: 32, borderRadius: "50%" })} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={pulse({ width: `${45 + (i % 3) * 12}%`, height: 13, borderRadius: 6 })} />
              <div style={pulse({ width: 30, height: 10, borderRadius: 5 })} />
            </div>
            <div style={pulse({ width: `${60 + (i % 2) * 15}%`, height: 10, borderRadius: 5 })} />
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
