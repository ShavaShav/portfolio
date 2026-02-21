import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import type { Mesh } from "three";
import type { MoonConfig } from "../../data/planets";

type MoonProps = {
  moon: MoonConfig;
  onSelect?: (moonId: string) => void;
};

export function Moon({ moon, onSelect }: MoonProps) {
  const meshRef = useRef<Mesh>(null);
  const [isHovered, setIsHovered] = useState(false);

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) return;

    const elapsed = clock.getElapsedTime();
    const angle = elapsed * moon.orbitSpeed + moon.orbitPhase;

    meshRef.current.position.set(
      moon.orbitRadius * Math.cos(angle),
      moon.orbitRadius * 0.1 * Math.sin(angle * 0.7),
      moon.orbitRadius * Math.sin(angle),
    );

    meshRef.current.rotation.y += delta * 0.6;
  });

  return (
    <mesh
      ref={meshRef}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(moon.id);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        setIsHovered(false);
        document.body.style.cursor = "default";
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setIsHovered(true);
        document.body.style.cursor = "pointer";
      }}
    >
      <sphereGeometry args={[moon.radius, 16, 16]} />
      <meshStandardMaterial
        color={moon.color}
        emissive={moon.color}
        emissiveIntensity={isHovered ? 1.0 : 0.3}
        roughness={0.7}
      />
      {isHovered ? (
        <Html center distanceFactor={8} position={[0, moon.radius + 0.2, 0]}>
          <div className="planet-label planet-label--active">
            <strong>{moon.label}</strong>
            <span>{moon.subtitle}</span>
          </div>
        </Html>
      ) : null}
    </mesh>
  );
}
