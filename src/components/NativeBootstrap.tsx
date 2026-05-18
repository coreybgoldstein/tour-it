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

    // Heartbeat-only resume detection.
    //
    // Earlier iterations also reloaded on visibilitychange, blur/focus,
    // and pageshow(persisted). Those events fire on EVERY brief context
    // switch (notification banner, control center pull, screenshot,
    // glance at Messages) and the reload obliterated in-memory UI state
    // every single time. The native AppDelegate's probe-before-reload
    // path now handles the true backgrounding case after a 60s threshold
    // — the JS layer only needs to catch cases where the event loop was
    // actually paused, which is the one signal that genuinely proves the
    // WebView was suspended.
    const HEARTBEAT_INTERVAL_MS = 1000;
    const HEARTBEAT_GAP_THRESHOLD_MS = 60 * 1000;
    let reloading = false;
    let lastBeat = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-console -- diagnostic
    console.log("[NativeBootstrap] heartbeat-only resume-recovery active");

    const heartbeat = window.setInterval(() => {
      const now = Date.now();
      const gap = now - lastBeat;
      lastBeat = now;
      if (gap > HEARTBEAT_GAP_THRESHOLD_MS && !reloading) {
        reloading = true;
        // eslint-disable-next-line @typescript-eslint/no-console -- diagnostic
        console.log("[NativeBootstrap] heartbeat gap", gap, "ms — reloading");
        window.location.reload();
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(heartbeat);
    };
  }, []);

  return null;
}
