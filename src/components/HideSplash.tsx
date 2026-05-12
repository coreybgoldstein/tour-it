"use client";

import { useEffect } from "react";

// Holds the native Capacitor splash screen up for at least 3 seconds before
// telling it to hide, so the WebView has time to fully render the home
// screen on slower devices (e.g. the iPad Air M3 that App Store Review
// ran the app on — too-fast hide() exposed an empty black WebView). No-op
// on the web. The native config keeps launchAutoHide at 5s as the final
// safety net if JS never loads at all.
const SPLASH_MIN_HOLD_MS = 3000;

export default function HideSplash() {
  useEffect(() => {
    let cancelled = false;

    const hide = async () => {
      try {
        const mod = await import("@capacitor/splash-screen");
        await mod.SplashScreen.hide();
      } catch {
        // @capacitor/splash-screen throws on the web — that's fine
      }
    };

    // Wait at least 3 seconds before hiding the splash so the WebView is
    // guaranteed to have painted its first frame on iPad. Even if React
    // mounted immediately, we don't yank the splash early.
    const t1 = setTimeout(() => { if (!cancelled) hide(); }, SPLASH_MIN_HOLD_MS);
    // Defensive second call in case the first one missed the plugin
    const t2 = setTimeout(() => { if (!cancelled) hide(); }, SPLASH_MIN_HOLD_MS + 1500);
    return () => { cancelled = true; clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return null;
}
