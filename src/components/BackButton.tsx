"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";

// Canonical back button. Uses the design-system circular chrome + green-safe
// chevron silhouette. Crucially it falls back to a sensible route when there
// is no in-app history to pop (e.g. the user opened a deep link / push
// notification straight into a leaf page), where a bare router.back() would
// dead-end or exit the app.
type BackButtonProps = {
  // Where to go when there's no history to pop. Defaults to home.
  fallback?: string;
  // Optional label rendered next to the chevron.
  label?: string;
  // Extra styles merged onto the button (e.g. absolute positioning).
  style?: CSSProperties;
  // Accessible label; defaults to "Go back".
  ariaLabel?: string;
};

export default function BackButton({ fallback = "/", label, style, ariaLabel = "Go back" }: BackButtonProps) {
  const router = useRouter();

  const onClick = () => {
    // history.length > 1 means there's somewhere to pop back to within this
    // tab. Otherwise route to the fallback so we never strand the user.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };

  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        display: "flex",
        alignItems: "center",
        gap: label ? 8 : 0,
        height: 34,
        width: label ? "auto" : 34,
        padding: label ? "0 12px 0 8px" : 0,
        borderRadius: label ? 17 : "50%",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
        ...style,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      {label ? <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>{label}</span> : null}
    </button>
  );
}
