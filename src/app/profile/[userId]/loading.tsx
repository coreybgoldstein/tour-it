// Profile page skeleton — shown by Next.js between tap-on-profile-link and
// the real page rendering. Mirrors the mahogany plaque + tabs + clip grid
// so the eye locks onto the layout immediately and the perceived wait
// drops from ~500ms-feels-slow to ~500ms-feels-instant.
export default function ProfileLoading() {
  return (
    <div style={{ background: "#07100a", minHeight: "100dvh", paddingBottom: 100 }}>
      {/* Mahogany plaque section */}
      <div style={{
        background: "linear-gradient(180deg, #2a1810 0%, #1a0f08 100%)",
        borderTop: "1px solid rgba(180,145,60,0.25)",
        borderBottom: "1px solid rgba(180,145,60,0.25)",
        padding: "calc(env(safe-area-inset-top) + 80px) 20px 20px",
      }}>
        {/* Avatar + username row */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={pulse({ width: 88, height: 88, borderRadius: "50%" })} />
          <div style={pulse({ width: 120, height: 18, borderRadius: 6 })} />
          {/* Pills row */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <div style={pulse({ width: 60, height: 22, borderRadius: 99 })} />
            <div style={pulse({ width: 90, height: 22, borderRadius: 99 })} />
            <div style={pulse({ width: 70, height: 22, borderRadius: 99 })} />
          </div>
          {/* Stats line */}
          <div style={pulse({ width: 200, height: 12, borderRadius: 5, marginTop: 4 })} />
        </div>

        {/* Progression tracker card */}
        <div style={{ marginTop: 20, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={pulse({ width: 60, height: 14, borderRadius: 5 })} />
            <div style={pulse({ width: 50, height: 14, borderRadius: 5 })} />
          </div>
          <div style={pulse({ width: "100%", height: 6, borderRadius: 99 })} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={pulse({ width: 80, height: 11, borderRadius: 5 })} />
            <div style={pulse({ width: 60, height: 11, borderRadius: 5 })} />
          </div>
        </div>

        {/* Gold divider */}
        <div style={{ height: 1, background: "rgba(180,145,60,0.35)", margin: "20px 0" }} />

        {/* Trophy plaque 4-col grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={pulse({ aspectRatio: "1 / 1", borderRadius: 8 })} />
          ))}
        </div>
      </div>

      {/* Clips / Rounds tabs */}
      <div style={{ display: "flex", gap: 24, padding: "20px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={pulse({ width: 70, height: 16, borderRadius: 5 })} />
        <div style={pulse({ width: 70, height: 16, borderRadius: 5 })} />
      </div>

      {/* Clip grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, padding: 2 }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={pulse({ aspectRatio: "3 / 4", borderRadius: 0 })} />
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
