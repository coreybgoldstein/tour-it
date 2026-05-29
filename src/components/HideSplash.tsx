"use client";

import { useEffect } from "react";

// Hide the native Capacitor splash as fast as the WebView allows.
//
// The previous implementation held the splash for at least 3000ms
// "so the WebView has time to fully render" — this was the original
// fix for an iPad Air M3 App Store Review bug where hide() fired
// before any HTML had painted and reviewers saw an empty black
// WebView. With the home now SSR'd as a solid dark background
// (matches the splash backgroundColor in capacitor.config.ts) the
// "empty WebView" concern is gone: even if hide() fires before
// HomeTour mounts, the page background is already the brand-dark
// color so there's nothing visually empty.
//
// New behavior: schedule hide() inside a double-rAF, which fires
// after the browser has committed at least one paint. That's almost
// always <100ms after mount on a modern device. capacitor.config.ts
// still holds a 5s launchAutoHide as the final safety net for cases
// where JS doesn't load at all.

export default function HideSplash() {
  useEffect(() => {
    let cancelled = false;

    const hide = async () => {
      try {
        const mod = await import("@capacitor/splash-screen");
        await mod.SplashScreen.hide();
      } catch {
        // Throws on the web — fine.
      }
    };

    // Two requestAnimationFrame ticks → guarantees one paint has
    // committed before we yank the splash. Empirically <50ms on
    // iPhone 14 Pro, ~120ms on the iPad Air M3 that hit the
    // original review issue.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) hide();
      });
    });
    // Defensive second hide 800ms later in case the rAF callback
    // never fires (background tab, throttled timers, etc.).
    const safety = setTimeout(() => { if (!cancelled) hide(); }, 800);

    return () => { cancelled = true; clearTimeout(safety); };
  }, []);

  return null;
}
