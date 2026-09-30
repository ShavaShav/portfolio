import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getNextQualityTier, usePerformanceTier } from "./usePerformanceTier";
import { RENDER_QUALITY } from "../data/renderQuality";

describe("scene quality", () => {
  it("reduces high quality to medium for sustained sub-42fps rendering", () => {
    expect(getNextQualityTier("high", 35)).toBe("medium");
    expect(getNextQualityTier("medium", 35)).toBe("medium");
  });
  it("uses low quality below 26fps and never upgrades automatically", () => {
    expect(getNextQualityTier("high", 20)).toBe("low");
    expect(getNextQualityTier("medium", 20)).toBe("low");
    expect(getNextQualityTier("low", 60)).toBe("low");
    expect(getNextQualityTier("high", 60)).toBe("high");
  });
  it("works under StrictMode and waits for two slow windows", () => {
    const { result } = renderHook(() => usePerformanceTier("high"), {
      wrapper: StrictMode,
    });
    act(() => result.current.reportPerformance(35));
    expect(result.current.tier).toBe("high");
    act(() => result.current.reportPerformance(35));
    expect(result.current.tier).toBe("medium");
    act(() => result.current.reportPerformance(20));
    act(() => result.current.reportPerformance(20));
    expect(result.current.tier).toBe("low");
  });
  it("does not downgrade for isolated stalls", () => {
    const { result } = renderHook(() => usePerformanceTier("high"));
    act(() => result.current.reportPerformance(20));
    act(() => result.current.reportPerformance(60));
    act(() => result.current.reportPerformance(20));
    expect(result.current.tier).toBe("high");
  });
  it("respects the device ceiling when the viewport changes", () => {
    const { result, rerender } = renderHook(
      ({ initialTier }) => usePerformanceTier(initialTier),
      { initialProps: { initialTier: "medium" as "medium" | "high" } },
    );
    expect(result.current.tier).toBe("medium");
    act(() => result.current.reportPerformance(20));
    act(() => result.current.reportPerformance(20));
    rerender({ initialTier: "high" });
    expect(result.current.tier).toBe("low");
  });
  it("reduces all expensive budgets together and disables low-tier bloom", () => {
    for (const key of [
      "maxDpr",
      "stars",
      "particles",
      "beltCount",
      "sphereSegments",
    ] as const) {
      expect(RENDER_QUALITY.high[key]).toBeGreaterThan(
        RENDER_QUALITY.medium[key],
      );
      expect(RENDER_QUALITY.medium[key]).toBeGreaterThan(
        RENDER_QUALITY.low[key],
      );
    }
    expect(RENDER_QUALITY.low.bloom).toBe(false);
    expect(RENDER_QUALITY.low.particles).toBe(0);
  });
});
