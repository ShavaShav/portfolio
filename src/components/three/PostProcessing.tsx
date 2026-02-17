import { Bloom, EffectComposer } from "@react-three/postprocessing";

export function PostProcessing() {
  return (
    <EffectComposer>
      <Bloom
        intensity={1.25}
        luminanceSmoothing={0.7}
        luminanceThreshold={0.15}
        mipmapBlur
      />
    </EffectComposer>
  );
}
