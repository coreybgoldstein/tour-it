"use client";

// SectionAddButton — the compact "+" affordance that sits at the right
// edge of a section sub-header (Games, Scorecard, Clips, Notes…). Replaces
// the heavier labelled green pills so a screen with several sections reads
// calmly. Icon-only by design; `label` is the accessible name.

export function SectionAddButton({ onClick, label, disabled, busy }: { onClick: () => void; label: string; disabled?: boolean; busy?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={label}
      style={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        background: "rgba(77,168,98,0.15)",
        border: "1px solid rgba(77,168,98,0.35)",
        color: "#4da862",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled || busy ? "default" : "pointer",
        flexShrink: 0,
        padding: 0,
      }}
    >
      {busy ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "tourit-spin 0.8s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
          <style>{`@keyframes tourit-spin { to { transform: rotate(360deg); } }`}</style>
        </>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      )}
    </button>
  );
}
