"use client";

import { useEffect } from "react";

// One-time native shell setup for Capacitor iOS. Currently:
//   1. Hides the iOS keyboard accessory bar (the up/down/Done toolbar above
//      the keyboard) so form inputs feel like a native app instead of a
//      web page. The QuickType autocomplete bar is iOS-managed; we suppress
//      it per-input via autoComplete="off" where it isn't useful.
// All calls dynamic-import the plugin so the web build (which doesn't have
// Capacitor) doesn't break.
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

  return null;
}
