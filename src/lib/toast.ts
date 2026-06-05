import type { ToastKind } from "@/components/Toast";

// Global, fire-from-anywhere toast. Hooks and non-component code (useLike,
// useSave, fetch error paths) can't render a <Toast> directly, so they emit
// an event that the single <ToastHost> mounted in the root layout listens for.
// In SSR / non-browser contexts this is a no-op.

const TOAST_EVENT = "tourit:toast";

export type ToastDetail = { msg: string; kind: ToastKind };

export function showToast(msg: string, kind: ToastKind = "error") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { msg, kind } }));
}

export function onToast(handler: (detail: ToastDetail) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<ToastDetail>).detail);
  window.addEventListener(TOAST_EVENT, listener);
  return () => window.removeEventListener(TOAST_EVENT, listener);
}
