import { useEffect, useRef, useState } from "react";
import type { QualityTier } from "./useDeviceCapability";

/**
 * Monitors FPS during the first 4 seconds of rendering.
 * If average FPS < 30, downgrades quality to "low".
 */
export function usePerformanceTier(initialTier: QualityTier): QualityTier {
  const [tier, setTier] = useState<QualityTier>(initialTier);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const measuringRef = useRef(true);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!measuringRef.current) return;

    const startTime = performance.now();
    const MEASURE_DURATION = 4000; // 4 seconds

    const tick = () => {
      if (!measuringRef.current) return;

      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - startTime;

      if (elapsed >= MEASURE_DURATION) {
        measuringRef.current = false;
        const avgFps = (frameCountRef.current / elapsed) * 1000;
        if (avgFps < 30) {
          setTier("low");
        }
        return;
      }

      lastTimeRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      measuringRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return tier;
}
