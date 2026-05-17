"use client";

import { useEffect } from "react";

// One-time native shell setup for Capacitor iOS:
//
//   1. Hides the iOS keyboard accessory bar (the up/down/Done toolbar above
//      the keyboard) so form inputs feel like a native app instead of a
//      web page.
//
//   2. WKWebView resume-recovery. iOS aggressively suspends WebView
//      compositing/network/Suspense state when the app is backgrounded,
//      screenshotted, or sent to the app switcher. When it returns, in-flight
//      fetches and Suspense boundaries can hang forever — symptom is the
//      content area going totally blank while the layout (BottomNav) stays
//      alive, and tab navigation fails to repaint. We can't recover the
//      stuck render tree from JS, so on resume we just reload the page.
//      Gated to native only so PWA/web users don't reload on tab focus.
//
// Plugins are dynamic-imported so the standalone web build (no Capacitor)
// doesn't break.
export default function NativeBootstrap() {
  useEffect(() => {
    (async () => {
      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        await Keyboard.setAccessoryBarVisible({ isVisible: false });
      } catch {
        // Plugin not installed (web) — no-op.
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Capacitor injects window.Capacitor on every native page load.
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;

    // Reload threshold. Anything longer than this and we assume the WebView
    // may have entered the stuck post-suspend state and force a fresh
    // composite. 500ms covers screenshots (brief inactive state) without
    // firing on tiny focus glitches.
    const RESUME_RELOAD_THRESHOLD_MS = 500;
    let hiddenAt = 0;

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (!hiddenAt) return;
      const awayMs = Date.now() - hiddenAt;
      hiddenAt = 0;
      if (awayMs > RESUME_RELOAD_THRESHOLD_MS) {
        window.location.reload();
      }
    };

    // pageshow with persisted=true means iOS restored the page from BFCache,
    // which is the exact state where the suspend bug surfaces. Always reload.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return null;
}
