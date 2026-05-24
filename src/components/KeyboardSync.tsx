"use client";

import { useEffect } from "react";

/**
 * Maintains a global `--keyboard-height` CSS variable on
 * <html> that tracks the on-screen keyboard height in pixels.
 *
 * Mount once at the app root. Every sheet, modal, or form anywhere
 * in the app can then react to the keyboard using CSS alone:
 *
 *   .my-sheet {
 *     bottom: var(--keyboard-height, 0px);
 *     transition: bottom 0.25s cubic-bezier(0.32, 0.72, 0, 1);
 *   }
 *
 * This is the Instagram-grade pattern. Native iOS apps achieve smooth
 * keyboard transitions by:
 *   1. Receiving UIKeyboardWillShowNotification with the keyboard's
 *      final height BEFORE iOS starts the rise animation
 *   2. Animating their UI with the same duration + curve as the
 *      keyboard, so UI and keyboard move in true lockstep
 *
 * In a Capacitor WebView the equivalent is @capacitor/keyboard's
 * keyboardWillShow event, which fires before iOS animates the
 * keyboard up and gives us the final height. We set the CSS var
 * synchronously in that callback, the browser kicks off the
 * transition at the exact instant the keyboard starts moving, and
 * the cubic-bezier(0.32, 0.72, 0, 1) curve (Apple's "snappy" curve,
 * same one SwiftUI uses) matches the keyboard's rise exactly.
 *
 * Layered signals so it works everywhere:
 *   1. @capacitor/keyboard's keyboardWillShow — native iOS/Android
 *      (precise, fires before animation)
 *   2. document.focusin — instant fallback for web AND a pre-warm
 *      for native (estimates 290px on iPhone keyboard so the lift
 *      starts even before Capacitor's event resolves)
 *   3. visualViewport.resize — last-mile refinement to the
 *      device-exact height as the keyboard fully opens (handles
 *      web browsers + iOS Safari without Capacitor)
 */
export default function KeyboardSync() {
  useEffect(() => {
    let detachCapacitor: (() => void) | null = null;
    let cleanedUp = false;

    const root = document.documentElement;
    const setHeight = (h: number) => {
      if (cleanedUp) return;
      // Round to nearest px to avoid sub-pixel jitter from multiple
      // signals competing (Capacitor's exact value vs visualViewport's
      // settled value can differ by a fraction of a pixel).
      const px = Math.round(Math.max(0, h));
      root.style.setProperty("--keyboard-height", `${px}px`);
    };

    // 1. Capacitor native — most precise. Fires BEFORE the iOS
    //    keyboard animation starts, with the exact final height.
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) {
      (async () => {
        try {
          const { Keyboard } = await import("@capacitor/keyboard");
          const showHandle = await Keyboard.addListener("keyboardWillShow", (info: { keyboardHeight: number }) => {
            setHeight(info.keyboardHeight);
          });
          const hideHandle = await Keyboard.addListener("keyboardWillHide", () => {
            setHeight(0);
          });
          detachCapacitor = () => {
            showHandle.remove();
            hideHandle.remove();
          };
        } catch {
          // Plugin not registered — fall through to web fallbacks below
        }
      })();
    }

    // 2. focusin — instant anticipatory lift. Pre-warms the CSS var
    //    to ~290px (typical iPhone keyboard) the moment an editable
    //    element gains focus. Capacitor's keyboardWillShow refines
    //    to the device-exact value once it fires; visualViewport
    //    handles cases where Capacitor isn't available.
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && !t.isContentEditable) return;
      // Only pre-warm if we don't already have a real value (which
      // would be the case if Capacitor's listener fired faster than
      // the focus event, which can happen on subsequent focuses).
      const current = root.style.getPropertyValue("--keyboard-height");
      if (!current || current === "0px") setHeight(290);
    };
    document.addEventListener("focusin", onFocusIn);

    // 3. visualViewport — settles the height to the device-exact
    //    value once the keyboard is fully open. Required for web
    //    where Capacitor isn't available, and a useful safety net
    //    on native.
    const vv = window.visualViewport;
    let vvHandler: (() => void) | null = null;
    if (vv) {
      vvHandler = () => {
        const h = Math.max(0, window.innerHeight - vv.offsetTop - vv.height);
        // <50px likely means the keyboard isn't actually up — just
        // chrome resize from URL bar or accessory bar adjustments.
        setHeight(h > 50 ? h : 0);
      };
      vv.addEventListener("resize", vvHandler);
      vv.addEventListener("scroll", vvHandler);
    }

    return () => {
      cleanedUp = true;
      detachCapacitor?.();
      document.removeEventListener("focusin", onFocusIn);
      if (vv && vvHandler) {
        vv.removeEventListener("resize", vvHandler);
        vv.removeEventListener("scroll", vvHandler);
      }
    };
  }, []);

  return null;
}
