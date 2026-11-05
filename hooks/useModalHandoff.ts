import { useCallback, useEffect, useRef } from "react";

export function useModalHandoff<T>(fallbackMs = 600) {
  const pendingRef = useRef<T | null>(null);
  const openRef = useRef<((value: T) => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const openPending = useCallback(() => {
    clearTimer();
    const value = pendingRef.current;
    const open = openRef.current;
    pendingRef.current = null;
    openRef.current = null;
    if (value != null && open) open(value);
  }, [clearTimer]);

  const queue = useCallback(
    (value: T, open: (value: T) => void) => {
      pendingRef.current = value;
      openRef.current = open;
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        openPending();
      }, fallbackMs);
    },
    [clearTimer, openPending, fallbackMs],
  );

  const cancel = useCallback(() => {
    clearTimer();
    pendingRef.current = null;
    openRef.current = null;
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return { queue, onDismiss: openPending, cancel };
}
