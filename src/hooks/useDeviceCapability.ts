/**
 * Detects device capability and returns a quality tier.
 * Mobile: viewport < 768px OR touch-primary device.
 */

export type QualityTier = "high" | "medium" | "low";

export type DeviceCapability = {
  isMobile: boolean;
  qualityTier: QualityTier;
};

function detectMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768 || navigator.maxTouchPoints > 0;
}

// Simple synchronous detection — no hook needed for static device check
export function getDeviceCapability(): DeviceCapability {
  const isMobile = detectMobile();
  return {
    isMobile,
    qualityTier: isMobile ? "medium" : "high",
  };
}

import { useEffect, useState } from "react";

export function useDeviceCapability(): DeviceCapability {
  const [capability, setCapability] = useState<DeviceCapability>(
    getDeviceCapability,
  );

  useEffect(() => {
    const update = () => setCapability(getDeviceCapability());
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  return capability;
}
