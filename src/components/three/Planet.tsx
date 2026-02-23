import { Html, Ring } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Group, Mesh } from "three";
import { DoubleSide } from "three";
import { getPlanetPositionAtTime, type PlanetConfig } from "../../data/planets";
import type { QualityTier } from "../../hooks/useDeviceCapability";
import { createPlanetMaterial } from "../../shaders/planet/createPlanetMaterial";
import { Moon } from "./Moon";

type PlanetProps = {
  planet: PlanetConfig;
  onSelect: (planetId: string) => void;
  visited?: boolean;
  isMobile?: boolean;
  qualityTier?: QualityTier;
};

export function Planet({
  planet,
  onSelect,
  visited = false,
  isMobile = false,
  qualityTier = "high",
}: PlanetProps) {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const cloudRef = useRef<Mesh>(null);
  const [isHovered, setIsHovered] = useState(false);

  const materialBundle = useMemo(
    () =>
      createPlanetMaterial(
        {
          baseColor: planet.color,
          emissiveColor: planet.emissive,
          radius: planet.radius,
          visual: planet.visual,
        },
        qualityTier,
      ),
    [planet.color, planet.emissive, planet.radius, planet.visual, qualityTier],
  );

  useEffect(() => {
    document.body.style.cursor = isHovered ? "pointer" : "default";

    return () => {
      document.body.style.cursor = "default";
    };
  }, [isHovered]);

  useEffect(() => {
    materialBundle.setHover(isHovered);
  }, [isHovered, materialBundle]);

  useEffect(() => {
    return () => {
      materialBundle.dispose();
    };
  }, [materialBundle]);

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

    if (cloudRef.current) {
      cloudRef.current.rotation.y +=
        delta * (0.08 + materialBundle.cloudRotationSpeed);
    }

    materialBundle.update(elapsed);
  });

  return (
    <group ref={groupRef}>
      <mesh
        material={materialBundle.surfaceMaterial}
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
        <sphereGeometry
          args={[
            planet.radius,
            materialBundle.geometrySegments,
            materialBundle.geometrySegments,
          ]}
        />
      </mesh>

      {materialBundle.atmosphereMaterial ? (
        <mesh material={materialBundle.atmosphereMaterial}>
          <sphereGeometry
            args={[
              planet.radius * materialBundle.atmosphereScale,
              36,
              36,
            ]}
          />
        </mesh>
      ) : null}

      {materialBundle.cloudMaterial ? (
        <mesh material={materialBundle.cloudMaterial} ref={cloudRef}>
          <sphereGeometry
            args={[planet.radius * materialBundle.cloudScale, 42, 42]}
          />
        </mesh>
      ) : null}

      {/* Larger invisible touch target for mobile */}
      {isMobile ? (
        <mesh
          onClick={(event) => {
            event.stopPropagation();
            onSelect(planet.id);
          }}
          visible={false}
        >
          <sphereGeometry args={[planet.radius * 2.5, 16, 16]} />
          <meshBasicMaterial />
        </mesh>
      ) : null}

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

      {planet.moons?.map((moon) => (
        <Moon key={moon.id} moon={moon} onSelect={() => onSelect(planet.id)} />
      ))}

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
