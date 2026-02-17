import { Html, Ring } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group, Mesh } from "three";
import type { PlanetConfig } from "../../data/planets";

type PlanetProps = {
  planet: PlanetConfig;
  onSelect: (planetId: string) => void;
};

export function Planet({ planet, onSelect }: PlanetProps) {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = isHovered ? "pointer" : "default";

    return () => {
      document.body.style.cursor = "default";
    };
  }, [isHovered]);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();
    const angle = elapsed * planet.orbitSpeed + planet.orbitPhase;

    const x = planet.orbitRadius * Math.cos(angle);
    const z = planet.orbitRadius * Math.sin(angle);
    const y =
      Math.sin(angle) * planet.orbitInclination * planet.orbitRadius * 0.2;

    if (groupRef.current) {
      groupRef.current.position.set(x, y, z);
    }

    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.45;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(planet.id);
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          setIsHovered(false);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setIsHovered(true);
        }}
        ref={meshRef}
      >
        <sphereGeometry args={[planet.radius, 36, 36]} />
        <meshStandardMaterial
          color={planet.color}
          emissive={planet.emissive}
          emissiveIntensity={isHovered ? 1.25 : 0.55}
          metalness={0.2}
          roughness={0.65}
        />
      </mesh>

      {planet.hasRings ? (
        <Ring
          args={[planet.radius * 1.45, planet.radius * 2.35, 64]}
          rotation={[-Math.PI / 2.8, 0.35, 0]}
        >
          <meshBasicMaterial
            color={planet.ringColor ?? "#ffffff"}
            opacity={0.42}
            side={2}
            transparent
          />
        </Ring>
      ) : null}

      <Html center distanceFactor={10} position={[0, planet.radius + 0.6, 0]}>
        <div
          className={`planet-label ${isHovered ? "planet-label--active" : ""}`}
        >
          <strong>{planet.label}</strong>
          <span>{planet.subtitle}</span>
        </div>
      </Html>
    </group>
  );
}
