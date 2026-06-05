"use client";

import { useEffect, useState } from "react";
import Toast, { type ToastState } from "@/components/Toast";
import { onToast } from "@/lib/toast";

// Single global toast renderer. Mounted once in the root layout so any code
// (hooks, fetch error handlers) can call showToast() and have it surface here.
export default function ToastHost() {
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => onToast(({ msg, kind }) => setToast({ msg, kind })), []);

  return <Toast toast={toast} onDismiss={() => setToast(null)} />;
}
