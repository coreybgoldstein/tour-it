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

    // Layered resume detection. iOS screenshots specifically don't fire
    // visibilitychange in WKWebView (the app stays "visible"), so we also
    // listen on window blur/focus and run an event-loop heartbeat. Any one
    // of these tripping after a suspect interval is enough to reload.
    const RESUME_RELOAD_THRESHOLD_MS = 150;
    const HEARTBEAT_GAP_THRESHOLD_MS = 2000;
    let suspendedAt = 0;
    let reloading = false;
    // eslint-disable-next-line @typescript-eslint/no-console -- diagnostic
    console.log("[NativeBootstrap] resume-recovery v2 active");

    const reloadOnce = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    const markSuspended = () => {
      if (!suspendedAt) suspendedAt = Date.now();
    };
    const markResumed = () => {
      if (!suspendedAt) return;
      const awayMs = Date.now() - suspendedAt;
      suspendedAt = 0;
      if (awayMs > RESUME_RELOAD_THRESHOLD_MS) reloadOnce();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") markSuspended();
      else markResumed();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      // persisted=true means iOS restored from BFCache — always stale.
      if (e.persisted) reloadOnce();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("blur", markSuspended);
    window.addEventListener("focus", markResumed);

    // Event-loop heartbeat. If the JS engine was paused for > 2s, the
    // WebView was almost certainly suspended by iOS — reload to recover
    // any stuck render state. This catches the cases where no lifecycle
    // event fires at all (e.g., the iOS app switcher snapshot capture).
    let lastBeat = Date.now();
    const heartbeat = window.setInterval(() => {
      const now = Date.now();
      const gap = now - lastBeat;
      lastBeat = now;
      if (gap > HEARTBEAT_GAP_THRESHOLD_MS) reloadOnce();
    }, 1000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("blur", markSuspended);
      window.removeEventListener("focus", markResumed);
      clearInterval(heartbeat);
    };
  }, []);

  return null;
}
