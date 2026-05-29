// Home loading skeleton. Renders the *shape* of HomeTour (the new
// loop home) — search bar, Near Me rail, Your Tour card, Feed rail —
// so the transition from skeleton → real content is a swap, not a
// flash of an entirely different feed-shaped layout. Previously this
// painted a TikTok-style full-screen feed skeleton (matching the old
// HomeClassic home) and showed for ~2 seconds before HomeTour took
// over, which read as a broken first-paint.

export default function HomeLoading() {
  return (
    <div style={{ background: "#07100a", minHeight: "100dvh", color: "#fff", paddingBottom: 96 }}>
      <style>{`
        @keyframes tourit-load-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Empty space where TourItTopBar will mount (rendered globally
          by layout.tsx; we don't try to mimic it here to avoid a
          double-render seam when it appears). */}

      {/* MayCompetitionBanner placeholder strip */}
      <div style={pulse({ height: 38, marginTop: 70, marginLeft: 0, marginRight: 0 })} />

      <div style={{ padding: "10px 16px 0" }}>
        {/* Search bar */}
        <div style={pulse({ width: "100%", height: 46, borderRadius: 12, marginTop: 0 })} />

        {/* Courses Near Me section label + rail */}
        <div style={pulse({ width: 200, height: 14, marginTop: 22, borderRadius: 6 })} />
        <div style={{ display: "flex", gap: 10, marginTop: 12, overflow: "hidden" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={pulse({ width: 160, height: 210, borderRadius: 12, flexShrink: 0 })} />
          ))}
        </div>

        {/* Your Tour module */}
        <div style={pulse({ width: 120, height: 14, marginTop: 22, borderRadius: 6 })} />
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.85fr) minmax(0, 1fr)", gap: 8, marginTop: 10 }}>
          <div style={pulse({ height: 168, borderRadius: 14 })} />
          <div style={pulse({ height: 168, borderRadius: 14 })} />
        </div>

        {/* Tour the Feed */}
        <div style={pulse({ width: 160, height: 14, marginTop: 24, borderRadius: 6 })} />
        <div style={{ display: "flex", gap: 8, marginTop: 10, overflow: "hidden" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={pulse({ width: 96, height: 170, borderRadius: 12, flexShrink: 0 })} />
          ))}
        </div>
      </div>
    </div>
  );
}

function pulse(extra: React.CSSProperties): React.CSSProperties {
  return {
    background: "rgba(77,168,98,0.06)",
    border: "1px solid rgba(77,168,98,0.08)",
    animation: "tourit-load-pulse 1.4s ease-in-out infinite",
    ...extra,
  };
}
