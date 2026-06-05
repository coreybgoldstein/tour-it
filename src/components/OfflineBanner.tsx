"use client";

import { useEffect, useState } from "react";

/**
 * Slim fixed banner that drops in when the device loses network and slides
 * away when it returns. Gives the user a clear "this is why nothing's
 * loading" signal instead of silent failures or a frozen feed. Pairs with
 * the service worker's offline.html fallback, which covers cold navigations
 * that can't be served from cache.
 */
export default function OfflineBanner() {
  // Start optimistic (online) so SSR + first paint never flash the banner.
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    <div
      aria-hidden={!offline}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "calc(env(safe-area-inset-top) + 7px) 16px 7px",
        background: "#1c1c1c",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.85)",
        fontFamily: "'Outfit', sans-serif",
        fontSize: 13,
        fontWeight: 600,
        transform: offline ? "translateY(0)" : "translateY(-100%)",
        transition: "transform 0.25s ease",
        pointerEvents: offline ? "auto" : "none",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,170,0,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 1l22 22" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      No connection — showing your last loaded view
    </div>
  );
}
