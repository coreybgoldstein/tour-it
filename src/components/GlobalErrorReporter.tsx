"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/reportError";

// Mounted once in the root layout. Captures otherwise-uncaught runtime errors
// and promise rejections app-wide and forwards them to reportError (a no-op
// until NEXT_PUBLIC_SENTRY_DSN is configured).
export default function GlobalErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportError(e.error ?? e.message, { kind: "window.onerror" });
    const onRejection = (e: PromiseRejectionEvent) => reportError(e.reason, { kind: "unhandledrejection" });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
