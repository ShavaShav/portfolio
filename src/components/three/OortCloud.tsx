import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Group, Mesh } from "three";
import {
  BufferGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  Vector3,
} from "three";
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
  stretch: Vector3;
  detail: number;
  shapeSeed: number;
  roughness: number;
  metalness: number;
  surfaceGlow: number;
  pulseSpeed: number;
  pulsePhase: number;
  isHub: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function seededUnit(seed: number) {
  const x = Math.sin(seed) * 43758.5453123;
  return x - Math.floor(x);
}

function buildOortGeometry(body: AsteroidInstance): BufferGeometry {
  const chooseIco = seededUnit(body.shapeSeed * 1.37) > 0.42;
  const geometry = chooseIco
    ? new IcosahedronGeometry(body.size, body.detail)
    : new DodecahedronGeometry(body.size, body.detail);

  const positions = geometry.attributes.position;
  const vertex = new Vector3();
  const safeSize = Math.max(body.size, 1e-5);

  for (let i = 0; i < positions.count; i++) {
    vertex.set(positions.getX(i), positions.getY(i), positions.getZ(i));
    const nx = vertex.x / safeSize;
    const ny = vertex.y / safeSize;
    const nz = vertex.z / safeSize;
    const shape = body.shapeSeed;

    const broad = Math.sin(nx * 4.8 + shape * 1.9) * 0.18;
    const medium = Math.sin(ny * 7.4 + shape * 2.7) * 0.12;
    const fine = Math.sin((nx + ny + nz) * 10.2 + shape * 4.1) * 0.08;
    const ridge = Math.sin((nx - ny + nz) * 8.4 + shape * 5.6) * 0.06;
    const displacement = clamp(0.86 + broad + medium + fine + ridge, 0.55, 1.34);

    vertex.multiplyScalar(displacement);
    vertex.multiply(body.stretch);
    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function OortCloud({
  onSelect,
  visited = false,
  isMobile = false,
}: OortCloudProps) {
  const cloudRef = useRef<Group>(null);
  const meshRefs = useRef<Map<string, Mesh>>(new Map());
  const materialRefs = useRef<Map<string, Mesh>>(new Map());
  const asteroidGroupRefs = useRef<Map<string, Group>>(new Map());
  const geometryCacheRef = useRef<Map<string, BufferGeometry>>(new Map());
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
      size: 0.36,
      color: OORT_CLOUD.color,
      stretch: new Vector3(1.16, 0.92, 1.08),
      detail: 2,
      shapeSeed: 9.2,
      roughness: 0.58,
      metalness: 0.18,
      surfaceGlow: 0.74,
      pulseSpeed: 0.32,
      pulsePhase: 1.4,
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
        stretch: new Vector3(
          0.78 + seed1 * 0.6,
          0.72 + seed2 * 0.54,
          0.8 + seed3 * 0.62,
        ),
        detail: seed1 > 0.58 ? 1 : 0,
        shapeSeed: 30 + i * 17.4 + seed2 * 9,
        roughness: 0.74 + seed1 * 0.22,
        metalness: 0.04 + seed3 * 0.12,
        surfaceGlow: 0.28 + seed2 * 0.34,
        pulseSpeed: 0.42 + seed3 * 0.6,
        pulsePhase: seed1 * Math.PI * 2,
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

      const materialMesh = materialRefs.current.get(asteroid.id);
      if (materialMesh?.material && "emissiveIntensity" in materialMesh.material) {
        const pulse =
          0.68 +
          Math.sin(elapsed * asteroid.pulseSpeed + asteroid.pulsePhase) * 0.24;
        const base = hoveredId === asteroid.id ? 1.2 : asteroid.surfaceGlow;
        materialMesh.material.emissiveIntensity =
          (visited && asteroid.isHub ? 1.3 : base) * pulse;
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

  const setMaterialMeshRef = (id: string) => (mesh: Mesh | null) => {
    if (mesh) {
      materialRefs.current.set(id, mesh);
      return;
    }
    materialRefs.current.delete(id);
  };

  const getGeometry = useCallback((body: AsteroidInstance) => {
    const cached = geometryCacheRef.current.get(body.id);
    if (cached) {
      return cached;
    }

    const geometry = buildOortGeometry(body);
    geometryCacheRef.current.set(body.id, geometry);
    return geometry;
  }, []);

  useEffect(() => {
    return () => {
      for (const geometry of geometryCacheRef.current.values()) {
        geometry.dispose();
      }
      geometryCacheRef.current.clear();
    };
  }, []);

  return (
    <group ref={cloudRef}>
      {asteroids.map((asteroid) => (
        <group key={asteroid.id} ref={setGroupRef(asteroid.id)}>
          <mesh
            ref={(mesh) => {
              setMeshRef(asteroid.id)(mesh);
              setMaterialMeshRef(asteroid.id)(mesh);
            }}
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
            <primitive attach="geometry" object={getGeometry(asteroid)} />
            <meshStandardMaterial
              color={asteroid.color}
              emissive={asteroid.color}
              emissiveIntensity={asteroid.surfaceGlow}
              roughness={asteroid.roughness}
              metalness={asteroid.metalness}
              flatShading={!asteroid.isHub}
            />
          </mesh>

          {asteroid.isHub ? (
            <>
              <mesh scale={[1.12, 1.12, 1.12]}>
                <sphereGeometry args={[asteroid.size, 20, 20]} />
                <meshStandardMaterial
                  color="#9fefff"
                  emissive="#8fe8ff"
                  emissiveIntensity={0.36}
                  opacity={0.2}
                  roughness={0.6}
                  transparent
                />
              </mesh>
              <mesh rotation={[Math.PI / 2.6, 0.4, 0.2]}>
                <torusGeometry args={[asteroid.size * 1.55, asteroid.size * 0.08, 12, 54]} />
                <meshStandardMaterial
                  color="#75f0ff"
                  emissive="#7ee6ff"
                  emissiveIntensity={0.3}
                  metalness={0.35}
                  roughness={0.48}
                />
              </mesh>
            </>
          ) : null}

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
