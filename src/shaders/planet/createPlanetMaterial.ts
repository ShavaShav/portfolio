import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  MeshStandardMaterial,
  ShaderMaterial,
} from "three";
import type { PlanetVisualConfig } from "../../data/planets";
import type { QualityTier } from "../../hooks/useDeviceCapability";
import {
  atmosphereFragmentShader,
  atmosphereVertexShader,
  cloudFragmentShader,
  cloudVertexShader,
  planetFragmentShader,
  planetVertexShader,
} from "./planetShaders";

type PlanetMaterialConfig = {
  baseColor: string;
  emissiveColor: string;
  radius: number;
  visual?: PlanetVisualConfig;
};

type PlanetSurfaceMaterial = MeshStandardMaterial | ShaderMaterial;

export type PlanetMaterialBundle = {
  surfaceMaterial: PlanetSurfaceMaterial;
  atmosphereMaterial: ShaderMaterial | null;
  cloudMaterial: ShaderMaterial | null;
  geometrySegments: number;
  atmosphereScale: number;
  cloudScale: number;
  cloudRotationSpeed: number;
  update: (elapsedTime: number) => void;
  setHover: (hovered: boolean) => void;
  dispose: () => void;
};

const DEFAULT_VISUAL: PlanetVisualConfig = {
  palette: ["#233041", "#4f6484", "#9cb8d8"],
  oceanColor: "#275f9f",
  landThreshold: 0.48,
  atmosphereColor: "#7ab7ff",
  atmosphereIntensity: 0.48,
  noiseScale: 3.2,
  detailScale: 8.2,
  banding: 1.6,
  displacementScale: 0.012,
  emissiveDetailColor: "#7ab7ff",
  emissiveDetailStrength: 0.14,
  seed: 9.1,
  surfaceType: "rocky",
};

function resolveVisualConfig(visual?: PlanetVisualConfig): PlanetVisualConfig {
  if (!visual) {
    return DEFAULT_VISUAL;
  }

  return {
    ...DEFAULT_VISUAL,
    ...visual,
    palette: visual.palette ?? DEFAULT_VISUAL.palette,
    oceanColor: visual.oceanColor ?? DEFAULT_VISUAL.oceanColor,
    landThreshold: visual.landThreshold ?? DEFAULT_VISUAL.landThreshold,
    clouds: visual.clouds,
  };
}

function toSurfaceTypeValue(surfaceType: PlanetVisualConfig["surfaceType"]) {
  switch (surfaceType) {
    case "gas":
      return 1;
    case "crystalline":
      return 2;
    case "terran":
      return 3;
    case "rocky":
    default:
      return 0;
  }
}

function makeColor(hex: string) {
  return new Color(hex);
}

export function createPlanetMaterial(
  config: PlanetMaterialConfig,
  qualityTier: QualityTier,
): PlanetMaterialBundle {
  const visual = resolveVisualConfig(config.visual);

  if (qualityTier === "low") {
    const surfaceMaterial = new MeshStandardMaterial({
      color: config.baseColor,
      emissive: visual.emissiveDetailColor || config.emissiveColor,
      emissiveIntensity: 0.52,
      roughness: 0.62,
      metalness: 0.2,
    });

    return {
      surfaceMaterial,
      atmosphereMaterial: null,
      cloudMaterial: null,
      geometrySegments: 28,
      atmosphereScale: 1.04,
      cloudScale: 1.08,
      cloudRotationSpeed: 0,
      update: () => undefined,
      setHover: (hovered) => {
        surfaceMaterial.emissiveIntensity = hovered ? 1.0 : 0.52;
      },
      dispose: () => {
        surfaceMaterial.dispose();
      },
    };
  }

  const highQuality = qualityTier === "high";
  const cloudConfig = visual.clouds;
  const allowDisplacement =
    highQuality &&
    visual.surfaceType !== "gas" &&
    visual.displacementScale > 0.0005;
  const maxDisplacementForRadius = config.radius * 0.03;
  const effectiveDisplacement = allowDisplacement
    ? Math.min(visual.displacementScale, maxDisplacementForRadius)
    : 0;

  const surfaceMaterial = new ShaderMaterial({
    vertexShader: planetVertexShader,
    fragmentShader: planetFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uNoiseScale: { value: visual.noiseScale * (highQuality ? 1 : 0.9) },
      uDetailScale: { value: visual.detailScale * (highQuality ? 1 : 0.82) },
      uBanding: { value: visual.banding },
      uSurfaceType: { value: toSurfaceTypeValue(visual.surfaceType) },
      uUseThirdColor: { value: highQuality ? 1 : 0 },
      uDetailIntensity: { value: highQuality ? 0.2 : 0.12 },
      uEmissiveDetailStrength: {
        value: visual.emissiveDetailStrength * (highQuality ? 1 : 0.72),
      },
      uHoverBoost: { value: 0 },
      uSeed: { value: visual.seed },
      uColorA: { value: makeColor(visual.palette[0]) },
      uColorB: { value: makeColor(visual.palette[1]) },
      uColorC: { value: makeColor(visual.palette[2]) },
      uOceanColor: { value: makeColor(visual.oceanColor ?? "#275f9f") },
      uLandThreshold: { value: visual.landThreshold ?? 0.48 },
      uEmissiveDetailColor: { value: makeColor(visual.emissiveDetailColor) },
      uDisplacementScale: { value: effectiveDisplacement },
      uEnableDisplacement: { value: allowDisplacement ? 1 : 0 },
    },
  });

  const atmosphereMaterial = new ShaderMaterial({
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uAtmosphereIntensity: {
        value: visual.atmosphereIntensity * (highQuality ? 1 : 0.78),
      },
      uHoverBoost: { value: 0 },
      uAtmosphereColor: { value: makeColor(visual.atmosphereColor) },
    },
    transparent: true,
    depthWrite: false,
    side: BackSide,
    blending: AdditiveBlending,
  });

  let cloudMaterial: ShaderMaterial | null = null;

  if (highQuality && cloudConfig?.enabled) {
    cloudMaterial = new ShaderMaterial({
      vertexShader: cloudVertexShader,
      fragmentShader: cloudFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uNoiseScale: { value: cloudConfig.noiseScale },
        uOpacity: { value: cloudConfig.opacity },
        uSpeed: { value: cloudConfig.speed },
        uSeed: { value: visual.seed * 1.3 },
        uHoverBoost: { value: 0 },
        uCloudColor: { value: makeColor(cloudConfig.color) },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
  }

  return {
    surfaceMaterial,
    atmosphereMaterial,
    cloudMaterial,
    geometrySegments: highQuality ? 72 : 48,
    atmosphereScale: highQuality ? 1.1 : 1.065,
    cloudScale: 1.032,
    cloudRotationSpeed: cloudConfig?.speed ?? 0,
    update: (elapsedTime: number) => {
      (surfaceMaterial.uniforms.uTime as { value: number }).value = elapsedTime;
      (atmosphereMaterial.uniforms.uTime as { value: number }).value =
        elapsedTime;

      if (cloudMaterial) {
        (cloudMaterial.uniforms.uTime as { value: number }).value = elapsedTime;
      }
    },
    setHover: (hovered: boolean) => {
      const hoverValue = hovered ? 1 : 0;
      (surfaceMaterial.uniforms.uHoverBoost as { value: number }).value =
        hoverValue;
      (atmosphereMaterial.uniforms.uHoverBoost as { value: number }).value =
        hoverValue;

      if (cloudMaterial) {
        (cloudMaterial.uniforms.uHoverBoost as { value: number }).value =
          hoverValue;
      }
    },
    dispose: () => {
      surfaceMaterial.dispose();
      atmosphereMaterial.dispose();
      cloudMaterial?.dispose();
    },
  };
}
