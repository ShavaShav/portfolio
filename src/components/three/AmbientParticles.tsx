import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";

const vertexShader = `
  uniform float uTime;
  uniform float uPointScale;
  attribute float aPhase;
  varying float vBrightness;
  void main() {
    vec3 displaced = position;
    displaced.y += sin(uTime * 0.08 + aPhase) * 0.18;
    displaced.x += cos(uTime * 0.06 + aPhase) * 0.12;
    vBrightness = 0.35 + 0.2 * sin(aPhase + uTime * 0.4);
    vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(uPointScale / max(1.0, -viewPosition.z), 1.0, 4.0);
  }
`;

const fragmentShader = `
  varying float vBrightness;
  void main() {
    float falloff = 1.0 - smoothstep(0.1, 0.5, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(vec3(0.42, 0.67, 0.75), falloff * vBrightness);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function AmbientParticles({ count = 140 }: { count?: number }) {
  const { size, gl } = useThree();
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uPointScale: { value: 40 } }),
    [],
  );
  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const unit = (seed: number) => {
      const value = Math.sin(seed * 127.1) * 43758.5453;
      return value - Math.floor(value);
    };
    for (let i = 0; i < count; i++) {
      const radius = 8 + unit(i + 1) * 17;
      const theta = unit(i + 71) * Math.PI * 2;
      const phi = Math.acos(2 * unit(i + 137) - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
      phases[i] = unit(i + 193) * Math.PI * 2;
    }
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geo.setAttribute("aPhase", new Float32BufferAttribute(phases, 1));
    geo.computeBoundingSphere();
    if (geo.boundingSphere) geo.boundingSphere.radius += 0.3;
    return geo;
  }, [count]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uPointScale.value = size.height * gl.getPixelRatio() * 0.045;
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  );
}
