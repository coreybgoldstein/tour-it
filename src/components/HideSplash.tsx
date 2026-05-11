"use client";

import { useEffect } from "react";

// Tells the native Capacitor splash screen to hide as soon as the React tree
// has mounted, so the WebView's first paint never exposes a black background
// before the page is ready. No-op on the web.
//
// Belt-and-suspenders: also schedules a defensive 4s timeout in case the
// initial hide() call somehow doesn't take (e.g. plugin not registered yet).
// The native config still has launchAutoHide=true with a 5s fallback as a
// final safety net — same behavior we'd get from a vanilla browser environment.
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

    // Hide right away
    hide();

    // Defensive: hide again after a tick in case the plugin wasn't ready
    const t = setTimeout(() => { if (!cancelled) hide(); }, 4000);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  return null;
}
