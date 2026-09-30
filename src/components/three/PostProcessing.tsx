import {
  Bloom,
  EffectComposer,
  FXAA,
  ToneMapping,
} from "@react-three/postprocessing";
import type { QualityTier } from "../../hooks/useDeviceCapability";

type PostProcessingProps = {
  reducedQuality?: boolean;
  qualityTier?: QualityTier;
};

export function PostProcessing({
  reducedQuality = false,
  qualityTier = "high",
}: PostProcessingProps) {
  // Low tier bypasses all render targets and full-screen passes. The sun's
  // Fresnel corona still provides a glow without bloom.
  if (reducedQuality || qualityTier === "low") return null;

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        intensity={0.65}
        luminanceSmoothing={0.4}
        luminanceThreshold={1.1}
        mipmapBlur
        levels={qualityTier === "high" ? 6 : 4}
      />
      <FXAA />
      <ToneMapping />
    </EffectComposer>
  );
}
