import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Group, Mesh } from "three";
import { Vector3 } from "three";
import { OORT_CLOUD } from "../../data/oortCloud";

type OortCloudProps = {
  onSelect: (planetId: string) => void;
  visited?: boolean;
  isMobile?: boolean;
};

type AsteroidInstance = {
  id: string;
  label: string;
  rotationAxis: Vector3;
  rotationSpeed: number;
  orbitRadius: number;
  orbitPhase: number;
  orbitSpeed: number;
  driftAmplitude: number;
  driftSpeed: number;
  driftPhase: number;
  verticalAmplitude: number;
  verticalSpeed: number;
  verticalPhase: number;
  size: number;
  color: string;
  isHub: boolean;
};

export function OortCloud({
  onSelect,
  visited = false,
  isMobile = false,
}: OortCloudProps) {
  const cloudRef = useRef<Group>(null);
  const meshRefs = useRef<Map<string, Mesh>>(new Map());
  const asteroidGroupRefs = useRef<Map<string, Group>>(new Map());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const asteroids = useMemo<AsteroidInstance[]>(() => {
    const result: AsteroidInstance[] = [];

    result.push({
      id: OORT_CLOUD.id,
      label: OORT_CLOUD.label,
      rotationAxis: new Vector3(0.3, 1, 0.2).normalize(),
      rotationSpeed: 0.3,
      orbitRadius: 0,
      orbitPhase: 0,
      orbitSpeed: 0,
      driftAmplitude: 0,
      driftSpeed: 0,
      driftPhase: 0,
      verticalAmplitude: 0,
      verticalSpeed: 0,
      verticalPhase: 0,
      size: 0.3,
      color: OORT_CLOUD.color,
      isHub: true,
    });

    OORT_CLOUD.asteroids.forEach((asteroid, i) => {
      const seed1 = Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5;
      const seed2 = Math.sin(i * 269.5 + 183.3) * 0.5 + 0.5;
      const seed3 = Math.sin(i * 419.2 + 371.9) * 0.5 + 0.5;

      result.push({
        id: asteroid.id,
        label: asteroid.label,
        rotationAxis: new Vector3(
          seed1 - 0.5,
          seed2 - 0.5,
          seed3 - 0.5,
        ).normalize(),
        rotationSpeed: 0.2 + seed3 * 0.5,
        orbitRadius: 1.2 + seed1 * 2.8,
        orbitPhase: i * 0.95 + seed2 * Math.PI,
        orbitSpeed: 0.08 + seed3 * 0.16,
        driftAmplitude: 0.07 + seed2 * 0.14,
        driftSpeed: 0.22 + seed1 * 0.3,
        driftPhase: seed3 * Math.PI * 2,
        verticalAmplitude: 0.08 + seed2 * 0.34,
        verticalSpeed: 0.26 + seed3 * 0.42,
        verticalPhase: seed1 * Math.PI * 2,
        size: asteroid.size,
        color: asteroid.color,
        isHub: false,
      });
    });

    return result;
  }, []);

  useEffect(() => {
    document.body.style.cursor = hoveredId ? "pointer" : "default";

    return () => {
      document.body.style.cursor = "default";
    };
  }, [hoveredId]);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();
    const orbitAngle = elapsed * OORT_CLOUD.orbitSpeed + OORT_CLOUD.orbitPhase;
    const cloudX = OORT_CLOUD.baseOrbitRadius * Math.cos(orbitAngle);
    const cloudY =
      Math.sin(orbitAngle) *
      OORT_CLOUD.orbitInclination *
      OORT_CLOUD.baseOrbitRadius *
      0.2;
    const cloudZ = OORT_CLOUD.baseOrbitRadius * Math.sin(orbitAngle);

    if (cloudRef.current) {
      cloudRef.current.position.set(cloudX, cloudY, cloudZ);
    }

    asteroids.forEach((asteroid) => {
      const asteroidGroup = asteroidGroupRefs.current.get(asteroid.id);

      if (asteroidGroup) {
        if (asteroid.isHub) {
          asteroidGroup.position.set(0, 0, 0);
        } else {
          const localAngle = elapsed * asteroid.orbitSpeed + asteroid.orbitPhase;
          const radialDrift =
            Math.sin(elapsed * asteroid.driftSpeed + asteroid.driftPhase) *
            asteroid.driftAmplitude;
          const localRadius = asteroid.orbitRadius + radialDrift;
          const yOffset =
            Math.sin(elapsed * asteroid.verticalSpeed + asteroid.verticalPhase) *
            asteroid.verticalAmplitude;

          asteroidGroup.position.set(
            Math.cos(localAngle) * localRadius,
            yOffset,
            Math.sin(localAngle) * localRadius,
          );
        }
      }

      const mesh = meshRefs.current.get(asteroid.id);
      if (mesh) {
        mesh.rotateOnAxis(asteroid.rotationAxis, asteroid.rotationSpeed * delta);
      }
    });
  });

  const setMeshRef = (id: string) => (mesh: Mesh | null) => {
    if (mesh) {
      meshRefs.current.set(id, mesh);
      return;
    }
    meshRefs.current.delete(id);
  };

  const setGroupRef = (id: string) => (group: Group | null) => {
    if (group) {
      asteroidGroupRefs.current.set(id, group);
      return;
    }
    asteroidGroupRefs.current.delete(id);
  };

  return (
    <group ref={cloudRef}>
      {asteroids.map((asteroid) => (
        <group key={asteroid.id} ref={setGroupRef(asteroid.id)}>
          <mesh
            ref={setMeshRef(asteroid.id)}
            onClick={(event) => {
              event.stopPropagation();
              onSelect("open-source");
            }}
            onPointerOut={(event) => {
              event.stopPropagation();
              setHoveredId(null);
            }}
            onPointerOver={(event) => {
              event.stopPropagation();
              setHoveredId(asteroid.id);
            }}
          >
            <icosahedronGeometry args={[asteroid.size, 1]} />
            <meshStandardMaterial
              color={asteroid.color}
              emissive={asteroid.color}
              emissiveIntensity={
                hoveredId === asteroid.id || (visited && asteroid.isHub)
                  ? 1.2
                  : 0.4
              }
              roughness={0.8}
              flatShading
            />
          </mesh>

          {isMobile ? (
            <mesh
              onClick={(event) => {
                event.stopPropagation();
                onSelect("open-source");
              }}
              visible={false}
            >
              <sphereGeometry args={[asteroid.size * 2.5, 8, 8]} />
              <meshBasicMaterial />
            </mesh>
          ) : null}

          {hoveredId === asteroid.id ? (
            <Html
              center
              distanceFactor={10}
              position={[0, asteroid.size + 0.3, 0]}
            >
              <div className="planet-label planet-label--active">
                <strong>{asteroid.label}</strong>
              </div>
            </Html>
          ) : null}
        </group>
      ))}
    </group>
  );
}
