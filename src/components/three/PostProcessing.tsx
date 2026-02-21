import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Vignette,
} from "@react-three/postprocessing";
import { Vector2 } from "three";

type PostProcessingProps = {
  reducedQuality?: boolean;
};

export function PostProcessing({
  reducedQuality = false,
}: PostProcessingProps) {
  if (reducedQuality) {
    return (
      <EffectComposer>
        <Bloom
          intensity={0.8}
          luminanceSmoothing={0.7}
          luminanceThreshold={0.2}
          mipmapBlur
        />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer>
      <Bloom
        intensity={1.25}
        luminanceSmoothing={0.7}
        luminanceThreshold={0.15}
        mipmapBlur
      />
      <Vignette darkness={0.45} eskil={false} offset={0.4} />
      <ChromaticAberration
        modulationOffset={0}
        offset={new Vector2(0.0008, 0.0008)}
        radialModulation={false}
      />
    </EffectComposer>
  );
}
