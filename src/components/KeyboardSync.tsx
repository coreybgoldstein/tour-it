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
    // True once Capacitor's keyboard plugin is wired up. When it is,
    // we IGNORE focusin/visualViewport — those secondary signals were
    // racing against Capacitor's authoritative keyboardHeight and
    // causing the sheet to re-animate two or three times on every
    // input focus (focusin fires 290 → cap fires 336 → vv fires 339
    // → three transitions back-to-back). One source of truth on
    // native eliminates the "two things competing" feel.
    let capActive = false;

    const root = document.documentElement;
    const setHeight = (h: number) => {
      if (cleanedUp) return;
      // Round to nearest px to avoid sub-pixel jitter from multiple
      // signals competing (Capacitor's exact value vs visualViewport's
      // settled value can differ by a fraction of a pixel).
      const px = Math.round(Math.max(0, h));
      // No-op if unchanged — prevents re-triggering the CSS transition
      // when two signals report the same height.
      if (root.style.getPropertyValue("--keyboard-height") === `${px}px`) return;
      root.style.setProperty("--keyboard-height", `${px}px`);
    };

    // 1. Capacitor native — most precise. Fires BEFORE the iOS
    //    keyboard animation starts, with the exact final height.
    //    Set capActive SYNCHRONOUSLY when we're on a native platform
    //    so focusin/visualViewport bail out from the very first
    //    focus — otherwise the dynamic import races against the
    //    user's first tap and we end up double-animating before
    //    the Capacitor listener attaches.
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) {
      capActive = true;
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
          // Plugin failed to load — re-enable web fallbacks so users
          // aren't stuck without keyboard tracking. Rare edge case but
          // worth handling so a missing-plugin install doesn't break
          // every form on the app.
          capActive = false;
        }
      })();
    }

    // 2. focusin — instant anticipatory lift. Only used on the WEB
    //    where Capacitor isn't available. On native we skip this
    //    entirely so we don't double-animate (see capActive above).
    const onFocusIn = (e: FocusEvent) => {
      if (capActive) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && !t.isContentEditable) return;
      const current = root.style.getPropertyValue("--keyboard-height");
      if (!current || current === "0px") setHeight(290);
    };
    document.addEventListener("focusin", onFocusIn);

    // 3. visualViewport — settles the height to the device-exact
    //    value. Web-only for the same reason as focusin: on native
    //    Capacitor's value is already correct and vv would race.
    const vv = window.visualViewport;
    let vvHandler: (() => void) | null = null;
    if (vv) {
      vvHandler = () => {
        if (capActive) return;
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
