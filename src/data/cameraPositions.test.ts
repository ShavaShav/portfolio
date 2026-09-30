import { describe, expect, it } from "vitest";
import { CAMERA_DEFAULT, getOverviewCameraPosition } from "./cameraPositions";

describe("overview framing", () => {
  it("keeps the desktop overview position", () => {
    expect(getOverviewCameraPosition(16 / 9)).toEqual(CAMERA_DEFAULT.position);
  });
  it("pulls back in portrait to keep more destinations in view", () => {
    expect(getOverviewCameraPosition(390 / 716)[2]).toBeGreaterThan(
      CAMERA_DEFAULT.position[2] * 2,
    );
  });
  it("bounds extreme portrait aspect ratios", () => {
    expect(getOverviewCameraPosition(0.01).every(Number.isFinite)).toBe(true);
    expect(getOverviewCameraPosition(0.01)[2]).toBeLessThan(150);
  });
});
