import { useState, useEffect, useRef, useCallback } from "react";

export function useAutoHide(isActive: boolean, delay = 2000) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), delay);
  }, [delay]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isActive) {
      timerRef.current = setTimeout(() => setVisible(false), delay);
    } else {
      setVisible(true);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isActive, delay]);

  return { visible, show };
}
