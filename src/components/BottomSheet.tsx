"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Single source of truth for every bottom sheet in the app. Pairs with
 * the .tourit-sheet CSS family in globals.css. Centralising the JSX
 * shape (backdrop, container, grip, optional sticky footer) means
 * every modal — filter, edit profile, save course, report clip, share,
 * trip game — opens, closes, and reads identically.
 *
 * Why this shape:
 *   - <BottomSheet open onClose> renders the backdrop + sheet only
 *     when open. The caller controls visibility with their own state.
 *   - variant="auto" hugs content (avatar picker, share menu). Default
 *     is a 60vh min-height half-sheet. variant="full" bumps to 80vh
 *     for filter sheets with many fields.
 *   - footer={<button>Submit</button>} renders a sticky bottom row
 *     that stays visible while the form scrolls and above the iOS
 *     keyboard — critical so users always see the submit affordance.
 *   - id is optional but useful for hooking up useKeyboardAwareSheet
 *     (which targets DOM elements by id to nudge them above the
 *     keyboard on iOS).
 *
 * No keyboard logic lives inside the component — useKeyboardAwareSheet
 * is the companion hook that adjusts bottom + maxHeight in place. Both
 * pieces work together: this component renders the sheet; the hook
 * keeps it visible when the keyboard pops up.
 */
export type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Default: half-sheet (60vh min). "auto" hugs content. "full" bumps to 80vh min. */
  variant?: "default" | "auto" | "full";
  /** Optional sticky footer — renders below a scrollable body. Use for
   *  the primary submit button on form sheets so it's always visible. */
  footer?: React.ReactNode;
  /** Optional id for useKeyboardAwareSheet hook to target. */
  id?: string;
  children: React.ReactNode;
};

export function BottomSheet({ open, onClose, variant = "default", footer, id, children }: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  // Lock body scroll while the sheet is open so background content
  // doesn't bleed through swipes that should target the sheet itself.
  useEffect(() => {
    setMounted(true);
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || !mounted) return null;

  const sheetClass = [
    "tourit-sheet",
    variant === "auto" ? "tourit-sheet--auto" : "",
    variant === "full" ? "tourit-sheet--full" : "",
  ].filter(Boolean).join(" ");

  // Portal the sheet to document.body so it escapes any parent that
  // creates a CSS stacking context (transform, filter, will-change,
  // position: sticky, etc). Without this, the sheet's z-index 210 is
  // scoped to that local context — and the BottomNav at z-index 100,
  // which sits at the page root, ends up rendering ABOVE the sheet.
  // That was the bug Corey hit on the course Save picker on 2026-05-23.
  return createPortal(
    <>
      <div className="tourit-sheet-backdrop" onClick={onClose} />
      <div className={sheetClass} id={id} onClick={e => e.stopPropagation()}>
        <div className="tourit-sheet-grip" />
        {footer ? (
          <>
            <div className="tourit-sheet-body">{children}</div>
            <div className="tourit-sheet-footer">{footer}</div>
          </>
        ) : children}
      </div>
    </>,
    document.body,
  );
}
