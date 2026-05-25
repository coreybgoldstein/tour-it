"use client";

import { useEffect } from "react";

export type ToastKind = "error" | "success";
export type ToastState = { msg: string; kind: ToastKind } | null;

/**
 * Top-anchored inline toast pill.
 *
 * Replaces native `alert()` calls — those block the UI on iOS WebView and
 * look unprofessional. Pattern in consumers:
 *
 *   const [toast, setToast] = useState<ToastState>(null);
 *   setToast({ msg: "Saved", kind: "success" });
 *   <Toast toast={toast} onDismiss={() => setToast(null)} />
 *
 * The component owns the auto-dismiss timer so callers don't need to wire
 * their own setTimeout. 3s is long enough to read a short error and short
 * enough that it doesn't overstay its welcome.
 */
export default function Toast({
  toast,
  onDismiss,
  durationMs = 3000,
}: {
  toast: ToastState;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [toast, onDismiss, durationMs]);

  if (!toast) return null;

  const isError = toast.kind === "error";
  const borderColor = isError ? "#ef4444" : "#4da862";
  const bgColor = isError ? "rgba(127, 29, 29, 0.85)" : "rgba(34, 81, 50, 0.85)";

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onDismiss}
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 16px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10000,
        maxWidth: "90vw",
        padding: "10px 16px",
        borderRadius: 12,
        border: `1px solid ${borderColor}`,
        background: bgColor,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        color: "#fff",
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.4,
        textAlign: "center",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        cursor: "pointer",
      }}
    >
      {toast.msg}
    </div>
  );
}
