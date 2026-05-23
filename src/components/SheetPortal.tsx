"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Thin React Portal wrapper for bottom sheets that still use the raw
 * .tourit-sheet CSS classes (i.e. weren't yet converted to the
 * <BottomSheet> component). Wrap the backdrop + sheet pair in this so
 * the sheet renders at document.body and escapes any parent CSS
 * stacking context.
 *
 * Without portaling, the sheet's z-index is only effective inside its
 * nearest stacking-context ancestor — and the BottomNav (z-index 100,
 * sitting at page root) ends up rendering ABOVE a sheet with z-index
 * 210 if the sheet is nested inside something with a transform /
 * filter / will-change / position: sticky. Course page Save picker
 * hit this on 2026-05-23.
 *
 * Usage:
 *   <SheetPortal>
 *     <div className="tourit-sheet-backdrop" onClick={close} />
 *     <div className="tourit-sheet">
 *       <div className="tourit-sheet-grip" />
 *       ...
 *     </div>
 *   </SheetPortal>
 *
 * SSR-safe: returns null until mounted on the client, since
 * document.body doesn't exist during server render.
 */
export function SheetPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(<>{children}</>, document.body);
}
