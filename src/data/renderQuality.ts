import type { QualityTier } from "../hooks/useDeviceCapability";

// One budget controls geometry, particles, pixel fill, and postprocessing together.
export const RENDER_QUALITY = {
  high: {
    maxDpr: 1.75,
    stars: 3200,
    particles: 140,
    beltCount: 4800,
    sphereSegments: 64,
    bloom: true,
  },
  medium: {
    maxDpr: 1.25,
    stars: 1600,
    particles: 60,
    beltCount: 1800,
    sphereSegments: 40,
    bloom: true,
  },
  low: {
    maxDpr: 1,
    stars: 650,
    particles: 0,
    beltCount: 600,
    sphereSegments: 24,
    bloom: false,
  },
} satisfies Record<
  QualityTier,
  {
    maxDpr: number;
    stars: number;
    particles: number;
    beltCount: number;
    sphereSegments: number;
    bloom: boolean;
  }
>;
