"use client";

import { useEffect, RefObject } from "react";

// Drag-the-grip-down-to-close gesture for any bottom sheet.
//
// Attach the drag handler to the GRIP only, never the whole sheet.
// If it were the whole sheet, scrolling content inside would
// constantly try to close the sheet on every down-swipe and the
// UX would feel cursed.
//
// Sheet follows the finger 1:1 below the start position. Pulling
// UP is clamped to 0 so the sheet can't lift past its anchor.
// Threshold: release past 100px OR a downward flick (velocity
// > 0.6 px/ms) triggers the close. Anything else snaps back.
export function useSwipeDownToDismiss(
  gripRef: RefObject<HTMLElement | null>,
  sheetRef: RefObject<HTMLElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    const grip = gripRef.current;
    const sheet = sheetRef.current;
    if (!grip || !sheet) return;

    let startY = 0;
    let startT = 0;
    let lastY = 0;
    let dragging = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      lastY = startY;
      startT = performance.now();
      dragging = true;
      // Snap off the sheet's transition during the drag so the
      // translate follows the finger instantly. Restored on end.
      sheet.style.transition = "none";
    };

    const onMove = (e: TouchEvent) => {
      if (!dragging || e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      const delta = Math.max(0, y - startY); // clamp to ≥ 0 (no upward drag)
      sheet.style.transform = `translateY(${delta}px)`;
      lastY = y;
    };

    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      const delta = Math.max(0, lastY - startY);
      const dt = performance.now() - startT;
      const velocity = dt > 0 ? delta / dt : 0; // px/ms
      // Restore the natural transition for the snap-back or fly-out.
      sheet.style.transition = "transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)";
      if (delta > 100 || velocity > 0.6) {
        // Fly out, then close. The 260ms here matches the
        // .tourit-sheet's open animation curve so close feels
        // symmetrical to open.
        sheet.style.transform = "translateY(100%)";
        window.setTimeout(() => {
          onClose();
          // Reset transform so the next open doesn't start from
          // off-screen. Wait one tick so React can unmount cleanly
          // before we touch the element.
          if (sheet) {
            sheet.style.transform = "";
            sheet.style.transition = "";
          }
        }, 240);
      } else {
        sheet.style.transform = "translateY(0)";
      }
    };

    grip.addEventListener("touchstart", onStart, { passive: true });
    grip.addEventListener("touchmove", onMove, { passive: true });
    grip.addEventListener("touchend", onEnd);
    grip.addEventListener("touchcancel", onEnd);

    return () => {
      grip.removeEventListener("touchstart", onStart);
      grip.removeEventListener("touchmove", onMove);
      grip.removeEventListener("touchend", onEnd);
      grip.removeEventListener("touchcancel", onEnd);
    };
    // Refs are stable; onClose is captured fresh on every render via
    // the closure. Re-running the effect every render would tear
    // down and rebuild listeners on every parent update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
