import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

export function Sun() {
  const coreRef = useRef<Mesh>(null);
  const glowRef = useRef<Mesh>(null);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();
    const pulse = 1 + Math.sin(elapsed * 0.5) * 0.02;

    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.05;
      coreRef.current.scale.setScalar(pulse);
    }

    if (glowRef.current) {
      glowRef.current.scale.setScalar(1.3 + Math.sin(elapsed * 0.7) * 0.03);
    }
  });

  return (
    <group>
      <mesh ref={coreRef}>
        <sphereGeometry args={[1.5, 64, 64]} />
        <meshStandardMaterial
          color="#ff9900"
          emissive="#ff5500"
          emissiveIntensity={1.7}
          roughness={0.35}
          metalness={0.05}
        />
      </mesh>

      <mesh ref={glowRef}>
        <sphereGeometry args={[1.95, 32, 32]} />
        <meshBasicMaterial color="#ffbb55" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}
