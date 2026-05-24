import { useState, useEffect } from "react";
import { useIsDesktop } from "@/hooks/useIsDesktop";

/**
 * Returns true while the on-screen keyboard is visible (mobile only).
 * Always false on desktop.
 *
 * Two signals OR'd together so the answer flips fast enough to avoid
 * the "BottomNav flashes through the middle of the screen" bug:
 *
 * 1. focusin/focusout on document — fires INSTANTLY when a text input
 *    receives focus, BEFORE iOS starts animating the keyboard up. This
 *    is the critical one: it lets us hide the BottomNav before it has
 *    a chance to slide up with the shrinking visual viewport.
 * 2. visualViewport.resize — the canonical signal. Slower (fires after
 *    iOS finishes the keyboard animation, ~200-400ms) but catches the
 *    cases where the keyboard appears WITHOUT a focus event in our
 *    document (e.g. the search input gets auto-focused via ref and the
 *    focusin event fires on a not-yet-listening document).
 *
 * Either signal switching to "keyboard up" flips the hook. Both must
 * be off before the hook goes back to false, so a brief blur (e.g.
 * during a tab toggle that re-focuses 50ms later) doesn't cause the
 * nav to bounce in and out.
 */
export function useKeyboardOpen(): boolean {
  const [focusKeyboard, setFocusKeyboard] = useState(false);
  const [viewportKeyboard, setViewportKeyboard] = useState(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (isDesktop) return;
    const isEditable = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    };
    const onFocusIn = (e: FocusEvent) => { if (isEditable(e.target)) setFocusKeyboard(true); };
    const onFocusOut = (e: FocusEvent) => { if (isEditable(e.target)) setFocusKeyboard(false); };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    // Sync once on mount in case an input is already focused.
    if (isEditable(document.activeElement)) setFocusKeyboard(true);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [isDesktop]);

  useEffect(() => {
    if (isDesktop) return;
    const vv = (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
    if (!vv) return;
    const threshold = window.innerHeight * 0.75;
    const handler = () => setViewportKeyboard(vv.height < threshold);
    handler();
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, [isDesktop]);

  return focusKeyboard || viewportKeyboard;
}
