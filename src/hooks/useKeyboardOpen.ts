import { useState, useEffect } from "react";
import { useIsDesktop } from "@/hooks/useIsDesktop";

/**
 * Returns true while the on-screen keyboard is visible (mobile only).
 * Uses visualViewport: when the height drops below 75% of window height we
 * assume the keyboard is up. Always false on desktop.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  const isDesktop = useIsDesktop();
  useEffect(() => {
    if (isDesktop) return;
    const vv = (window as unknown as { visualViewport?: VisualViewport }).visualViewport;
    if (!vv) return;
    const threshold = window.innerHeight * 0.75;
    const handler = () => setOpen(vv.height < threshold);
    handler();
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, [isDesktop]);
  return open;
}
