"use client";

import { useEffect } from "react";

/**
 * Two responsibilities, both global:
 *
 *   1. Maintain `--keyboard-height` on <html> so any sheet can lift
 *      itself above the keyboard via CSS alone:
 *
 *        .my-sheet { bottom: var(--keyboard-height, 0px); }
 *
 *      The value is derived from `window.innerHeight - vv.height -
 *      vv.offsetTop`. That formula is correct in EVERY mode:
 *
 *        • Capacitor `Keyboard.resize: "native"` — the WebView itself
 *          shrinks when the keyboard opens. innerHeight shrinks with
 *          it; vv.height matches the shrunken innerHeight; the formula
 *          gives 0 — i.e. no extra CSS lift is needed because the
 *          shrink already did the lift for us.
 *
 *        • Capacitor `Keyboard.resize: "none"` — the WebView stays full
 *          height; vv.height shrinks to exclude the keyboard; the
 *          formula gives the keyboard height — exactly the lift the
 *          sheet needs.
 *
 *        • Web Safari / Chrome — same as resize:"none". Works.
 *
 *      An earlier version used Capacitor's reported keyboardHeight as
 *      the source of truth. That was always the FULL keyboard height
 *      regardless of resize mode, so under resize:"native" the CSS
 *      lift stacked on top of the native WebView shrink and sheets
 *      flew halfway up the screen (see the Contribute / profile-edit
 *      bug). The visualViewport formula self-corrects.
 *
 *   2. Body-scroll-lock whenever any `.tourit-sheet` is mounted. Same
 *      pattern CreateGameSheet / Quick Round use inline — promoted to
 *      a global concern so every sheet using the design-system class
 *      gets the lock for free. Prevents iOS from scrolling the layout
 *      viewport to bring a focused input into view, which would drag
 *      the position:fixed sheet with it.
 */
export default function KeyboardSync() {
  useEffect(() => {
    const root = document.documentElement;

    // ── 1. Keyboard-height publisher ──────────────────────────────
    const setHeight = (h: number) => {
      const px = Math.round(Math.max(0, h));
      if (root.style.getPropertyValue("--keyboard-height") === `${px}px`) return;
      root.style.setProperty("--keyboard-height", `${px}px`);
    };

    const recompute = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      // Layout-viewport bottom minus visible-viewport bottom.
      // < 50px is noise (URL-bar/chrome resize on web, accessory-bar
      // adjustments on iOS) — treat as "keyboard closed".
      const gap = window.innerHeight - vv.height - vv.offsetTop;
      setHeight(gap > 50 ? gap : 0);
    };

    const vv = window.visualViewport;
    if (vv) {
      recompute();
      vv.addEventListener("resize", recompute);
      vv.addEventListener("scroll", recompute);
    }

    // focusin gives an instant anticipatory lift so the sheet starts
    // moving before vv.resize fires (visual feels snappier). We use a
    // conservative 290px estimate — close enough that the sheet starts
    // animating, then the real vv.resize a few ms later snaps it to
    // the exact height.
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && !t.isContentEditable) return;
      const current = root.style.getPropertyValue("--keyboard-height");
      if (!current || current === "0px") setHeight(290);
    };
    document.addEventListener("focusin", onFocusIn);

    // ── 2. Body-scroll-lock while any .tourit-sheet is mounted ────
    // Track sheet count via MutationObserver so callers don't need to
    // opt in. When count > 0 we freeze body scroll the same way
    // CreateGameSheet does inline; when it returns to 0 we restore.
    let savedScrollY = 0;
    let savedBody: {
      position: string; top: string; left: string; right: string;
      width: string; overflow: string;
    } | null = null;

    const lock = () => {
      if (savedBody) return;
      savedScrollY = window.scrollY;
      const s = document.body.style;
      savedBody = {
        position: s.position, top: s.top, left: s.left,
        right: s.right, width: s.width, overflow: s.overflow,
      };
      s.position = "fixed";
      s.top = `-${savedScrollY}px`;
      s.left = "0";
      s.right = "0";
      s.width = "100%";
      s.overflow = "hidden";
    };
    const unlock = () => {
      if (!savedBody) return;
      const s = document.body.style;
      s.position = savedBody.position;
      s.top = savedBody.top;
      s.left = savedBody.left;
      s.right = savedBody.right;
      s.width = savedBody.width;
      s.overflow = savedBody.overflow;
      savedBody = null;
      window.scrollTo(0, savedScrollY);
    };

    const evaluate = () => {
      const anyOpen = document.querySelector(".tourit-sheet") !== null;
      if (anyOpen) lock(); else unlock();
    };

    evaluate();
    const mo = new MutationObserver(evaluate);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (vv) {
        vv.removeEventListener("resize", recompute);
        vv.removeEventListener("scroll", recompute);
      }
      document.removeEventListener("focusin", onFocusIn);
      mo.disconnect();
      unlock();
    };
  }, []);

  return null;
}
