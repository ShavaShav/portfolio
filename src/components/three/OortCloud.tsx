import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import type { Mesh } from "three";
import { Vector3 } from "three";
import { OORT_CLOUD } from "../../data/oortCloud";

type OortCloudProps = {
  onSelect: (planetId: string) => void;
  visited?: boolean;
};

type AsteroidInstance = {
  id: string;
  label: string;
  position: Vector3;
  rotationAxis: Vector3;
  rotationSpeed: number;
  size: number;
  color: string;
  isHub: boolean;
};

export function OortCloud({ onSelect, visited = false }: OortCloudProps) {
  const meshRefs = useRef<Map<string, Mesh>>(new Map());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const asteroids = useMemo<AsteroidInstance[]>(() => {
    const result: AsteroidInstance[] = [];
    const baseR = OORT_CLOUD.baseOrbitRadius;
    const basePhase = 5.5;

    result.push({
      id: OORT_CLOUD.id,
      label: OORT_CLOUD.label,
      position: new Vector3(
        baseR * Math.cos(basePhase),
        0,
        baseR * Math.sin(basePhase),
      ),
      rotationAxis: new Vector3(0.3, 1, 0.2).normalize(),
      rotationSpeed: 0.3,
      size: 0.3,
      color: OORT_CLOUD.color,
      isHub: true,
    });

    OORT_CLOUD.asteroids.forEach((asteroid, i) => {
      const angle = basePhase + (i - OORT_CLOUD.asteroids.length / 2) * 0.25;
      const seed1 = Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5;
      const seed2 = Math.sin(i * 269.5 + 183.3) * 0.5 + 0.5;
      const seed3 = Math.sin(i * 419.2 + 371.9) * 0.5 + 0.5;
      const radiusOffset = baseR + (seed1 - 0.5) * 3;
      const yOffset = (seed2 - 0.5) * 1.5;

      result.push({
        id: asteroid.id,
        label: asteroid.label,
        position: new Vector3(
          radiusOffset * Math.cos(angle),
          yOffset,
          radiusOffset * Math.sin(angle),
        ),
        rotationAxis: new Vector3(
          seed1 - 0.5,
          seed2 - 0.5,
          seed3 - 0.5,
        ).normalize(),
        rotationSpeed: 0.2 + seed3 * 0.5,
        size: asteroid.size,
        color: asteroid.color,
        isHub: false,
      });
    });

    return result;
  }, []);

  useFrame((_state, delta) => {
    asteroids.forEach((asteroid) => {
      const mesh = meshRefs.current.get(asteroid.id);
      if (mesh) {
        mesh.rotateOnAxis(
          asteroid.rotationAxis,
          asteroid.rotationSpeed * delta,
        );
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

  return (
    <group>
      {asteroids.map((asteroid) => (
        <group key={asteroid.id} position={asteroid.position}>
          <mesh
            ref={setMeshRef(asteroid.id)}
            onClick={(event) => {
              event.stopPropagation();
              onSelect("open-source");
            }}
            onPointerOut={(event) => {
              event.stopPropagation();
              setHoveredId(null);
              document.body.style.cursor = "default";
            }}
            onPointerOver={(event) => {
              event.stopPropagation();
              setHoveredId(asteroid.id);
              document.body.style.cursor = "pointer";
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
