"use client";

import { useEffect, useState } from "react";

/**
 * Mobile-web → iOS App Store download banner.
 *
 * Shown only when ALL of these are true:
 *   - Running in a real browser (not inside the Capacitor WebView, where
 *     the user is ALREADY in the app)
 *   - Device is iOS (iPhone/iPad/iPod)
 *   - User hasn't dismissed within the last 7 days (localStorage)
 *
 * Tap "Get the app" → App Store listing for Tour It (Apple ID 6761743149).
 * Tap the × → snooze the banner for 7 days.
 *
 * Lives at z-index 1500 — above TourItTopBar (100) and most overlays,
 * below any modal sheet that needs to win (which all sit at 200+ inside
 * full-screen modals where the banner is already irrelevant).
 *
 * Reason this is custom (vs. apple's native <meta name="apple-itunes-app">
 * Smart Banner): more control over copy, design matches Tour It's
 * editorial language, and it can ship a clearer CTA. Smart Banner is one
 * line of HTML but gives a generic blue strip we can't style.
 */

const STORAGE_KEY = "tourit-app-banner-dismissed-at";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const APP_STORE_URL = "https://apps.apple.com/app/id6761743149";

export default function AppDownloadBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Inside the Capacitor WebView — the user is already in the app.
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) return;

    // iOS only — Android version isn't shipped yet.
    const ua = navigator.userAgent || "";
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    if (!isIOS) return;

    // Don't show inside an iOS home-screen PWA either.
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return;

    // Check dismissal window.
    try {
      const dismissedAtStr = localStorage.getItem(STORAGE_KEY);
      if (dismissedAtStr) {
        const dismissedAt = parseInt(dismissedAtStr, 10);
        if (!isNaN(dismissedAt) && Date.now() - dismissedAt < DISMISS_DURATION_MS) return;
      }
    } catch {}

    setShow(true);
  }, []);

  // Push page content down by the banner's height while it's visible so it
  // doesn't overlay the TopBar (covering the hamburger button). We use a
  // CSS custom property on <html> so any layout that wants to participate
  // can read it; we also set body padding-top directly as a simple default
  // that just works for the existing page layouts. Cleared on dismiss /
  // unmount so the page snaps back to its normal offset.
  useEffect(() => {
    if (!show) return;
    const BANNER_HEIGHT_PX = 68; // 44 icon + 10/12 vertical padding + 1 border + small safe-area buffer
    const root = document.documentElement;
    const prevBodyPadding = document.body.style.paddingTop;
    const prevRootVar = root.style.getPropertyValue("--app-banner-offset");
    document.body.style.paddingTop = `calc(${BANNER_HEIGHT_PX}px + env(safe-area-inset-top, 0px))`;
    root.style.setProperty("--app-banner-offset", `calc(${BANNER_HEIGHT_PX}px + env(safe-area-inset-top, 0px))`);
    return () => {
      document.body.style.paddingTop = prevBodyPadding;
      if (prevRootVar) root.style.setProperty("--app-banner-offset", prevRootVar);
      else root.style.removeProperty("--app-banner-offset");
    };
  }, [show]);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1500,
        background: "linear-gradient(180deg, #0d2318 0%, #0a1c12 100%)",
        borderBottom: "1px solid rgba(77,168,98,0.32)",
        paddingTop: "env(safe-area-inset-top)",
        animation: "tourit-app-banner-in 0.35s ease-out",
        boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px 12px" }}>
        {/* App icon */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            overflow: "hidden",
            flexShrink: 0,
            background: "#fff",
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="Tour It" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>

        {/* Title + subtitle */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
            Tour It
          </div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Real intel, hole by hole. Open in the app.
          </div>
        </div>

        {/* CTA — links to App Store. dismiss() also fires so the banner
            doesn't bug them again on return. */}
        <a
          href={APP_STORE_URL}
          onClick={dismiss}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "#4da862",
            color: "#fff",
            fontFamily: "'Outfit', sans-serif",
            fontSize: 12,
            fontWeight: 700,
            padding: "8px 14px",
            borderRadius: 99,
            textDecoration: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(77,168,98,0.35)",
          }}
        >
          Get the app
        </a>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <style>{`@keyframes tourit-app-banner-in { from { transform: translateY(-110%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}
