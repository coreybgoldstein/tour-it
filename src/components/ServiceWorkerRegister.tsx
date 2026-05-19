"use client";

import { useEffect } from "react";

/**
 * Registers /public/sw.js in production. Caches static assets, images, and
 * HTML so navigation feels instant and the WebView no longer blanks while a
 * page reloads. The SW skips API/Supabase data requests entirely so live data
 * stays live.
 *
 * If something goes wrong: flip KILL_SWITCH in /public/sw.js to true and
 * redeploy. The next activate unregisters the worker for every user.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(err => {
        // eslint-disable-next-line @typescript-eslint/no-console -- diagnostic
        console.warn("[sw] registration failed:", err);
      });
  }, []);
  return null;
}
