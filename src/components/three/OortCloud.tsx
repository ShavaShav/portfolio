import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Group, InstancedMesh, Mesh } from "three";
import { Color, Object3D, Vector3 } from "three";
import { OORT_CLOUD } from "../../data/oortCloud";

type OortCloudProps = {
  onSelect: (planetId: string) => void;
  visited?: boolean;
  isMobile?: boolean;
};

type CloudInstance = {
  position: Vector3;
  rotation: Vector3;
  scale: number;
  color: Color;
};

type ProjectBody = {
  id: string;
  label: string;
  color: string;
  size: number;
  stretch: Vector3;
  basePosition: Vector3;
  rotationAxis: Vector3;
  rotationSpeed: number;
  driftAmplitude: Vector3;
  driftSpeed: Vector3;
  driftPhase: Vector3;
};

function seededUnit(seed: number) {
  const x = Math.sin(seed) * 43758.5453123;
  return x - Math.floor(x);
}

function sphericalToCartesian(radius: number, theta: number, phi: number) {
  return new Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
  );
}

function createCloudInstances(
  count: number,
  radiusMin: number,
  radiusMax: number,
  sizeMin: number,
  sizeMax: number,
  seedOffset: number,
) {
  const result: CloudInstance[] = [];

  for (let i = 0; i < count; i++) {
    const seed = i + seedOffset;
    const u1 = seededUnit(seed * 1.13 + 0.27);
    const u2 = seededUnit(seed * 2.41 + 3.17);
    const u3 = seededUnit(seed * 4.73 + 1.83);
    const u4 = seededUnit(seed * 6.01 + 2.91);
    const u5 = seededUnit(seed * 7.37 + 4.29);

    const theta = u1 * Math.PI * 2;
    const phi = Math.acos(2 * u2 - 1);
    const radius = radiusMin + Math.pow(u3, 0.68) * (radiusMax - radiusMin);
    const position = sphericalToCartesian(radius, theta, phi);

    const cold = 0.7 + u4 * 0.3;
    const bright = 0.55 + u5 * 0.45;
    const color = new Color(
      0.62 * bright * cold,
      0.82 * bright,
      1.0 * bright,
    );

    result.push({
      position,
      rotation: new Vector3(u4 * Math.PI, u5 * Math.PI, u1 * Math.PI),
      scale: sizeMin + u4 * (sizeMax - sizeMin),
      color,
    });
  }

  return result;
}

export function OortCloud({
  onSelect,
  visited = false,
  isMobile = false,
}: OortCloudProps) {
  const cloudRef = useRef<Group>(null);
  const cloudLayerARef = useRef<Group>(null);
  const cloudLayerBRef = useRef<Group>(null);
  const layerAMeshRef = useRef<InstancedMesh>(null);
  const layerBMeshRef = useRef<InstancedMesh>(null);
  const projectMeshRefs = useRef<Map<string, Mesh>>(new Map());
  const projectGroupRefs = useRef<Map<string, Group>>(new Map());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const cloudLayerA = useMemo(
    () =>
      createCloudInstances(
        isMobile ? 1200 : 4200,
        1.8,
        5.6,
        0.015,
        0.06,
        91,
      ),
    [isMobile],
  );

  const cloudLayerB = useMemo(
    () =>
      createCloudInstances(
        isMobile ? 700 : 2200,
        2.2,
        6.2,
        0.018,
        0.072,
        417,
      ),
    [isMobile],
  );

  const projects = useMemo<ProjectBody[]>(() => {
    return OORT_CLOUD.asteroids.map((project, index) => {
      const seed = index + 1;
      const u1 = seededUnit(seed * 1.31 + 5.71);
      const u2 = seededUnit(seed * 2.37 + 3.19);
      const u3 = seededUnit(seed * 3.89 + 2.77);
      const u4 = seededUnit(seed * 4.81 + 7.11);
      const u5 = seededUnit(seed * 5.67 + 8.23);

      const theta = u1 * Math.PI * 2;
      const phi = Math.acos(2 * u2 - 1);
      const radius = 2.2 + u3 * 2.8;
      const basePosition = sphericalToCartesian(radius, theta, phi);
      const axis = new Vector3(u2 - 0.5, u3 - 0.5, u4 - 0.5);
      if (axis.lengthSq() < 0.001) {
        axis.set(0.3, 1, 0.2);
      }
      axis.normalize();

      return {
        id: project.id,
        label: project.label,
        color: project.color,
        size: Math.max(0.14, project.size * 2.05),
        stretch: new Vector3(0.8 + u4 * 0.52, 0.72 + u5 * 0.58, 0.82 + u3 * 0.55),
        basePosition,
        rotationAxis: axis,
        rotationSpeed: 0.24 + u1 * 0.56,
        driftAmplitude: new Vector3(0.06 + u2 * 0.16, 0.04 + u3 * 0.14, 0.06 + u4 * 0.16),
        driftSpeed: new Vector3(0.18 + u4 * 0.32, 0.2 + u5 * 0.28, 0.16 + u1 * 0.34),
        driftPhase: new Vector3(u3 * Math.PI * 2, u4 * Math.PI * 2, u5 * Math.PI * 2),
      };
    });
  }, []);

  useEffect(() => {
    const dummy = new Object3D();

    const applyLayer = (mesh: InstancedMesh | null, instances: CloudInstance[]) => {
      if (!mesh) return;
      for (let i = 0; i < instances.length; i++) {
        const instance = instances[i];
        dummy.position.copy(instance.position);
        dummy.rotation.set(
          instance.rotation.x,
          instance.rotation.y,
          instance.rotation.z,
        );
        dummy.scale.setScalar(instance.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, instance.color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    };

    applyLayer(layerAMeshRef.current, cloudLayerA);
    applyLayer(layerBMeshRef.current, cloudLayerB);
  }, [cloudLayerA, cloudLayerB]);

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

    if (cloudLayerARef.current) {
      cloudLayerARef.current.rotation.y += delta * 0.011;
      cloudLayerARef.current.rotation.x = Math.sin(elapsed * 0.08) * 0.09;
    }

    if (cloudLayerBRef.current) {
      cloudLayerBRef.current.rotation.y -= delta * 0.007;
      cloudLayerBRef.current.rotation.z = Math.cos(elapsed * 0.06) * 0.11;
    }

    projects.forEach((project) => {
      const group = projectGroupRefs.current.get(project.id);
      if (!group) return;

      group.position.set(
        project.basePosition.x +
          Math.sin(elapsed * project.driftSpeed.x + project.driftPhase.x) *
            project.driftAmplitude.x,
        project.basePosition.y +
          Math.sin(elapsed * project.driftSpeed.y + project.driftPhase.y) *
            project.driftAmplitude.y,
        project.basePosition.z +
          Math.sin(elapsed * project.driftSpeed.z + project.driftPhase.z) *
            project.driftAmplitude.z,
      );

      const mesh = projectMeshRefs.current.get(project.id);
      if (mesh) {
        mesh.rotateOnAxis(project.rotationAxis, project.rotationSpeed * delta);
      }
    });
  });

  const setProjectMeshRef = (id: string) => (mesh: Mesh | null) => {
    if (mesh) {
      projectMeshRefs.current.set(id, mesh);
      return;
    }
    projectMeshRefs.current.delete(id);
  };

  const setProjectGroupRef = (id: string) => (group: Group | null) => {
    if (group) {
      projectGroupRefs.current.set(id, group);
      return;
    }
    projectGroupRefs.current.delete(id);
  };

  return (
    <group ref={cloudRef}>
      <group ref={cloudLayerARef}>
        <instancedMesh
          args={[undefined, undefined, cloudLayerA.length]}
          frustumCulled={false}
          ref={layerAMeshRef}
        >
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            emissive="#8edcff"
            emissiveIntensity={0.18}
            metalness={0.16}
            roughness={0.66}
            vertexColors
          />
        </instancedMesh>
      </group>

      <group ref={cloudLayerBRef}>
        <instancedMesh
          args={[undefined, undefined, cloudLayerB.length]}
          frustumCulled={false}
          ref={layerBMeshRef}
        >
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            emissive="#b8eeff"
            emissiveIntensity={0.24}
            metalness={0.22}
            roughness={0.54}
            vertexColors
          />
        </instancedMesh>
      </group>

      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect("open-source");
        }}
        visible={false}
      >
        <sphereGeometry args={[6.6, 20, 20]} />
        <meshBasicMaterial />
      </mesh>

      {projects.map((project) => (
        <group key={project.id} ref={setProjectGroupRef(project.id)}>
          <mesh
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
              setHoveredId(project.id);
            }}
            ref={setProjectMeshRef(project.id)}
            scale={project.stretch.toArray()}
          >
            <icosahedronGeometry args={[project.size, 1]} />
            <meshStandardMaterial
              color={project.color}
              emissive={project.color}
              emissiveIntensity={
                hoveredId === project.id || visited ? 1.22 : 0.62
              }
              metalness={0.28}
              roughness={0.48}
            />
          </mesh>

          <mesh scale={[1.15, 1.15, 1.15]}>
            <sphereGeometry args={[project.size, 14, 14]} />
            <meshStandardMaterial
              color="#d7f6ff"
              emissive={project.color}
              emissiveIntensity={0.12}
              opacity={0.18}
              roughness={0.62}
              transparent
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
              <sphereGeometry args={[project.size * 2.8, 8, 8]} />
              <meshBasicMaterial />
            </mesh>
          ) : null}

          {hoveredId === project.id ? (
            <Html
              center
              distanceFactor={10}
              position={[0, project.size + 0.3, 0]}
            >
              <div className="planet-label planet-label--active">
                <strong>{project.label}</strong>
              </div>
            </Html>
          ) : null}
        </group>
      ))}
    </group>
  );
}
