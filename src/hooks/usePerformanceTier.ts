import { useCallback, useRef, useState } from "react";
import type { QualityTier } from "./useDeviceCapability";

const QUALITY_ORDER: QualityTier[] = ["low", "medium", "high"];

export function getNextQualityTier(
  tier: QualityTier,
  fps: number,
): QualityTier {
  if (fps < 26) return "low";
  if (fps < 42 && tier === "high") return "medium";
  return tier;
}

/** Downshift after sustained slow scene frames, never unrelated DOM RAF ticks. */
export function usePerformanceTier(initialTier: QualityTier) {
  const [measuredTier, setMeasuredTier] = useState<QualityTier>("high");
  const slowWindows = useRef(0);
  const tier =
    QUALITY_ORDER[
      Math.min(
        QUALITY_ORDER.indexOf(initialTier),
        QUALITY_ORDER.indexOf(measuredTier),
      )
    ];

  const reportPerformance = useCallback(
    (fps: number) => {
      const next = getNextQualityTier(tier, fps);
      if (next === tier) {
        slowWindows.current = 0;
        return;
      }
      slowWindows.current += 1;
      if (slowWindows.current >= 2) {
        slowWindows.current = 0;
        setMeasuredTier(next);
      }
    },
    [tier],
  );

  return { tier, reportPerformance };
}
