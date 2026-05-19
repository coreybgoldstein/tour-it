import { useEffect } from "react";

/**
 * Keeps a fixed-position bottom sheet visible when the on-screen keyboard
 * opens. Tracks `window.visualViewport` and adjusts the element's `bottom`
 * and `maxHeight` so the sheet (and any submit button inside it) stays above
 * the keyboard on iOS Safari / Capacitor WebView.
 *
 * The target element must be `position: fixed` and have a stable id. When
 * the sheet is closed or the keyboard isn't up, inline overrides are cleared
 * so the element's normal CSS takes over.
 *
 * Companion to `useKeyboardOpen` (boolean): use that one when you want to
 * hide a floating CTA entirely; use this one when the element IS the form
 * and needs to stay reachable.
 */
export function useKeyboardAwareSheet(open: boolean, elementId: string) {
  useEffect(() => {
    if (!open) return;
    const vv = (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
    if (!vv) return;
    const sync = () => {
      const el = document.getElementById(elementId);
      if (!el) return;
      const keyboardHeight = Math.max(0, window.innerHeight - vv.offsetTop - vv.height);
      if (keyboardHeight > 50) {
        el.style.bottom = `${keyboardHeight}px`;
        el.style.maxHeight = `${vv.height - 40}px`;
      } else {
        el.style.bottom = "";
        el.style.maxHeight = "";
      }
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      const el = document.getElementById(elementId);
      if (el) {
        el.style.bottom = "";
        el.style.maxHeight = "";
      }
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [open, elementId]);
}
