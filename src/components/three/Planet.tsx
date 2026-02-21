import { Html, Ring } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Group, Mesh } from "three";
import { DoubleSide } from "three";
import { getPlanetPositionAtTime, type PlanetConfig } from "../../data/planets";

type PlanetProps = {
  planet: PlanetConfig;
  onSelect: (planetId: string) => void;
  visited?: boolean;
};

export function Planet({ planet, onSelect, visited = false }: PlanetProps) {
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
    const planetPosition = getPlanetPositionAtTime(planet, elapsed);

    if (groupRef.current) {
      groupRef.current.position.set(
        planetPosition.x,
        planetPosition.y,
        planetPosition.z,
      );
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
            side={DoubleSide}
            transparent
          />
        </Ring>
      ) : null}

      {/* Visited glow ring */}
      {visited ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry
            args={[planet.radius * 1.55, planet.radius * 1.65, 48]}
          />
          <meshBasicMaterial
            color={planet.color}
            opacity={0.35}
            transparent
            depthWrite={false}
          />
        </mesh>
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
