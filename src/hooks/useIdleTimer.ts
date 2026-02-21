import { useEffect, useRef, useState } from "react";

/**
 * Returns `true` when the user has been idle for `idleMs` milliseconds.
 * Triggers a re-render when idle state changes.
 * Resets on any mouse movement, click, keydown, or touch event.
 */
export function useIdleState(idleMs: number = 30_000): boolean {
  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reset = () => {
      setIsIdle(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setIsIdle(true), idleMs);
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "wheel",
    ] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [idleMs]);

  return isIdle;
}
