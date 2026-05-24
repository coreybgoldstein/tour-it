"use client";

import { createPortal } from "react-dom";

/**
 * Thin React Portal wrapper for bottom sheets that still use the raw
 * .tourit-sheet CSS classes. Wrap the backdrop + sheet pair in this
 * so the sheet renders at document.body and escapes any parent CSS
 * stacking context.
 *
 * Without portaling, the sheet's z-index is only effective inside its
 * nearest stacking-context ancestor — and chrome like the BottomNav
 * or the profile feed-modal can render ABOVE a sheet with z-index
 * 210 if the sheet is nested inside something with a transform /
 * filter / will-change / position: sticky / overflow: scroll.
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
 * Earlier this used a useState/useEffect mounted-check to be SSR-safe,
 * but the resulting first-render-null + second-render-portal pattern
 * was adding a perceptible delay before the sheet appeared on iOS —
 * Corey saw it as "comment sheet takes forever to open on the profile
 * page". Since this component is "use client" only and callers always
 * gate it behind a state flag (e.g. {open && <SheetPortal>...}), we
 * can skip the mounted dance: when this component renders for real,
 * the client is already hydrated and document.body exists. The
 * `typeof window` guard handles the harmless SSR-pass case where the
 * gating state is somehow truthy at SSR (never happens in practice
 * since the gates are flipped by user gestures).
 */
export function SheetPortal({ children }: { children: React.ReactNode }) {
  if (typeof window === "undefined") return null;
  return createPortal(<>{children}</>, document.body);
}
