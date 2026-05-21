"use client";

import { useEffect, useState } from "react";

// Visible diagnostic overlay that logs page-lifecycle events on-screen so
// we can see, on the actual phone, what fires right before the WebView
// goes dark after a screenshot or background return. Ships safely behind
// a localStorage toggle.
//
// Two ways to toggle:
//
//   1. From inside the Capacitor app (no URL bar): tap anywhere on the
//      screen 5 times within 1 second. Toggles the overlay on/off.
//   2. From a browser with a URL bar (Safari, Chrome):
//        https://www.touritgolf.com/?debug=1   to enable
//        https://www.touritgolf.com/?debug=0   to disable
//
// The flag persists in localStorage across launches until toggled off.
// The `?debug=` param is stripped from the URL after it's applied so
// shared links don't leak the toggle state. Storage is per-origin and
// is NOT shared between Safari and the Capacitor WebView, so the
// 5-tap gesture is the only way to enable inside the installed app.

const STORAGE_KEY = "tourit-debug-overlay";
const MAX_EVENTS = 5;

interface DebugEvent {
  ts: number;
  label: string;
  detail?: string;
}

export default function DebugEventOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [events, setEvents] = useState<DebugEvent[]>([]);

  // Read URL param (toggle) and localStorage (persisted state).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const param = url.searchParams.get("debug");
    if (param === "1") {
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    } else if (param === "0") {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
    // Strip the param so it doesn't propagate into shared URLs.
    if (param !== null) {
      url.searchParams.delete("debug");
      const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") + url.hash;
      window.history.replaceState(window.history.state, "", clean);
    }
    try { setEnabled(localStorage.getItem(STORAGE_KEY) === "1"); } catch {}
  }, []);

  // 5-taps-in-1s gesture to toggle. Listens on touchstart globally but
  // doesn't preventDefault/stopPropagation — each tap still hits whatever
  // element is underneath, so no UI is blocked. This is the only way to
  // toggle from inside the Capacitor app, which has no URL bar.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const taps: number[] = [];
    const handler = () => {
      const now = Date.now();
      taps.push(now);
      while (taps.length > 5) taps.shift();
      if (taps.length === 5 && now - taps[0] < 1000) {
        let isOn = false;
        try { isOn = localStorage.getItem(STORAGE_KEY) === "1"; } catch {}
        try {
          if (isOn) localStorage.removeItem(STORAGE_KEY);
          else localStorage.setItem(STORAGE_KEY, "1");
        } catch {}
        setEnabled(!isOn);
        taps.length = 0;
      }
    };
    document.addEventListener("touchstart", handler, { passive: true });
    return () => document.removeEventListener("touchstart", handler);
  }, []);

  // Wire up listeners only when enabled.
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const push = (label: string, detail?: string) => {
      setEvents(prev => {
        const next = prev.length >= MAX_EVENTS ? prev.slice(prev.length - MAX_EVENTS + 1) : prev;
        return [...next, { ts: Date.now(), label, detail }];
      });
    };

    let lastVisible = !document.hidden;

    const onVis = () => {
      const visible = !document.hidden;
      push(`vis:${visible ? "visible" : "hidden"}`);
      if (!lastVisible && visible) push("foreground");
      lastVisible = visible;
    };
    const onPageHide = (e: PageTransitionEvent) => push("pagehide", `persisted=${e.persisted}`);
    const onPageShow = (e: PageTransitionEvent) => push("pageshow", `persisted=${e.persisted}`);
    const onFreeze = () => push("freeze");
    const onResume = () => push("resume");
    const onError = (e: ErrorEvent) => push("error", (e.message || "").slice(0, 80));
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "");
      push("unhandledrejection", reason.slice(0, 80));
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("freeze", onFreeze);
    document.addEventListener("resume", onResume);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    push("overlay:ready");

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("freeze", onFreeze);
      document.removeEventListener("resume", onResume);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 2px)",
        left: 4,
        right: 4,
        zIndex: 2147483647,
        background: "rgba(0,0,0,0.72)",
        color: "#fff",
        fontFamily: "ui-monospace, Menlo, monospace",
        fontSize: 9,
        lineHeight: 1.3,
        padding: "4px 6px",
        borderRadius: 4,
        pointerEvents: "none",
        textAlign: "left",
        maxHeight: 96,
        overflow: "hidden",
      }}
    >
      {events.length === 0 ? (
        <div style={{ opacity: 0.55 }}>debug overlay ready · ?debug=0 to disable</div>
      ) : (
        events.map((e, i) => {
          const t = new Date(e.ts);
          const hms = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}:${String(t.getSeconds()).padStart(2, "0")}.${String(t.getMilliseconds()).padStart(3, "0")}`;
          return (
            <div key={`${e.ts}-${i}`} style={{ opacity: i === events.length - 1 ? 1 : 0.55 }}>
              {hms} {e.label}{e.detail ? ` · ${e.detail}` : ""}
            </div>
          );
        })
      )}
    </div>
  );
}
