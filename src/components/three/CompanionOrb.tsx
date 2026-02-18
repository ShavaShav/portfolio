import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

type CompanionOrbProps = {
  active: boolean;
  pulsing: boolean;
};

export function CompanionOrb({ active, pulsing }: CompanionOrbProps) {
  const orbRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!orbRef.current) {
      return;
    }

    const elapsed = clock.getElapsedTime();
    const pulse = pulsing ? 0.25 + Math.sin(elapsed * 10) * 0.15 : 0.12;

    orbRef.current.scale.setScalar(active ? 1 + pulse : 0.5);

    const material = orbRef.current.material;
    if (Array.isArray(material)) {
      return;
    }

    material.opacity = active ? 0.28 + pulse * 0.5 : 0;
  });

  return (
    <mesh position={[-6.4, -2.2, 3.4]} ref={orbRef}>
      <sphereGeometry args={[0.08, 20, 20]} />
      <meshBasicMaterial color="#7dffe2" transparent />
    </mesh>
  );
}
