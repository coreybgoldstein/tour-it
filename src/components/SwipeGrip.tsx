"use client";

import { useRef } from "react";
import { useSwipeDownToDismiss } from "@/hooks/useSwipeDownToDismiss";

// Drop-in grip handle with swipe-down-to-dismiss wired in.
//
// Usage: declare a ref on the sheet panel, render <SwipeGrip
// sheetRef={ref} onClose={...}/> as the first child. The grip is
// the touch target — content inside the sheet never accidentally
// triggers the close because the swipe listener only attaches
// to the grip element, not the whole sheet.
export function SwipeGrip({
  sheetRef,
  onClose,
  style,
}: {
  sheetRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  style?: React.CSSProperties;
}) {
  const gripRef = useRef<HTMLDivElement>(null);
  useSwipeDownToDismiss(gripRef, sheetRef, onClose);
  return (
    <div
      ref={gripRef}
      aria-label="Drag down to close"
      style={{
        padding: "10px 0 6px",
        display: "flex",
        justifyContent: "center",
        cursor: "grab",
        flexShrink: 0,
        touchAction: "none",
        ...style,
      }}
    >
      <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 99 }} />
    </div>
  );
}
