import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Group, InstancedMesh } from "three";
import { Color, Object3D, Vector3 } from "three";
import { OORT_CLOUD } from "../../data/oortCloud";

type OortCloudProps = {
  isMobile?: boolean;
};

type RingInstance = {
  position: Vector3;
  rotation: Vector3;
  scale: number;
  color: Color;
};

function seededUnit(seed: number) {
  const x = Math.sin(seed) * 43758.5453123;
  return x - Math.floor(x);
}

function createRingInstances(
  count: number,
  innerRadius: number,
  outerRadius: number,
  thickness: number,
  sizeMin: number,
  sizeMax: number,
  seedOffset: number,
) {
  const result: RingInstance[] = [];

  for (let i = 0; i < count; i += 1) {
    const seed = i + seedOffset;
    const u1 = seededUnit(seed * 1.13 + 0.29);
    const u2 = seededUnit(seed * 2.37 + 1.07);
    const u3 = seededUnit(seed * 3.83 + 2.41);
    const u4 = seededUnit(seed * 4.91 + 3.19);
    const u5 = seededUnit(seed * 5.67 + 4.53);

    const angle = u1 * Math.PI * 2;
    const radius =
      innerRadius + Math.pow(u2, 0.72) * (outerRadius - innerRadius);
    const radialJitter = (u3 - 0.5) * 0.24;

    const x = (radius + radialJitter) * Math.cos(angle);
    const z = (radius + radialJitter) * Math.sin(angle);
    const y = (u4 - 0.5) * thickness;

    const brightness = 0.55 + u5 * 0.45;
    const iceTint = 0.85 + u3 * 0.15;

    result.push({
      position: new Vector3(x, y, z),
      rotation: new Vector3(u2 * Math.PI, u4 * Math.PI, u5 * Math.PI),
      scale: sizeMin + u5 * (sizeMax - sizeMin),
      color: new Color(
        0.6 * brightness * iceTint,
        0.83 * brightness,
        1.0 * brightness,
      ),
    });
  }

  return result;
}

export function OortCloud({ isMobile = false }: OortCloudProps) {
  const ringRef = useRef<Group>(null);
  const layerARef = useRef<InstancedMesh>(null);
  const layerBRef = useRef<InstancedMesh>(null);

  const layerA = useMemo(
    () =>
      createRingInstances(
        isMobile ? 2200 : 6800,
        OORT_CLOUD.innerRadius,
        OORT_CLOUD.outerRadius,
        OORT_CLOUD.thickness,
        0.012,
        0.055,
        73,
      ),
    [isMobile],
  );

  const layerB = useMemo(
    () =>
      createRingInstances(
        isMobile ? 1200 : 3600,
        OORT_CLOUD.innerRadius + 0.2,
        OORT_CLOUD.outerRadius - 0.2,
        OORT_CLOUD.thickness * 0.85,
        0.015,
        0.07,
        311,
      ),
    [isMobile],
  );

  useEffect(() => {
    const dummy = new Object3D();

    const applyLayer = (mesh: InstancedMesh | null, instances: RingInstance[]) => {
      if (!mesh) return;

      for (let i = 0; i < instances.length; i += 1) {
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

    applyLayer(layerARef.current, layerA);
    applyLayer(layerBRef.current, layerB);
  }, [layerA, layerB]);

  useFrame(({ clock }, delta) => {
    if (ringRef.current) {
      const elapsed = clock.getElapsedTime();
      ringRef.current.rotation.y += delta * 0.0035;
      ringRef.current.rotation.x = Math.sin(elapsed * 0.05) * 0.012;
    }
  });

  return (
    <group ref={ringRef}>
      <instancedMesh
        args={[undefined, undefined, layerA.length]}
        frustumCulled={false}
        ref={layerARef}
      >
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          emissive={OORT_CLOUD.emissive}
          emissiveIntensity={0.14}
          metalness={0.16}
          roughness={0.7}
          vertexColors
        />
      </instancedMesh>

      <instancedMesh
        args={[undefined, undefined, layerB.length]}
        frustumCulled={false}
        ref={layerBRef}
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          emissive="#b9ecff"
          emissiveIntensity={0.18}
          metalness={0.21}
          roughness={0.55}
          vertexColors
        />
      </instancedMesh>
    </group>
  );
}
