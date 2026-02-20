import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import type { Points } from "three";

type AmbientParticlesProps = {
  count?: number;
};

export function AmbientParticles({ count = 200 }: AmbientParticlesProps) {
  const pointsRef = useRef<Points>(null);

  // Pre-compute phase offsets and speeds
  const { geometry, phases, speeds } = useMemo(() => {
    const geo = new BufferGeometry();
    const positions = new Float32Array(count * 3);
    const phaseArr = new Float32Array(count);
    const speedArr = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const r = 8 + Math.random() * 17;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      phaseArr[i] = Math.random() * Math.PI * 2;
      speedArr[i] = 0.02 + Math.random() * 0.06;
    }

    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    return { geometry: geo, phases: phaseArr, speeds: speedArr };
  }, [count]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const elapsed = clock.getElapsedTime();
    const positions = geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] += Math.sin(elapsed * speeds[i] + phases[i]) * 0.003;
    }

    geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#8ab4d4"
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </points>
  );
}
