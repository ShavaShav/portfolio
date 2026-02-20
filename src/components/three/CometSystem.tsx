import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import type { Points } from "three";

type Comet = {
  id: number;
  start: Vector3;
  direction: Vector3;
  speed: number;
  progress: number; // 0→1 across scene
  length: number;   // tail length in world units
};

const COMET_PARTICLE_COUNT = 50;
const SCENE_RADIUS = 30;

function randomOnSphere(radius: number): Vector3 {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return new Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
  );
}

function CometMesh({ comet }: { comet: Comet }) {
  const pointsRef = useRef<Points>(null);
  const geometryRef = useRef(new BufferGeometry());
  const positionsRef = useRef(new Float32Array(COMET_PARTICLE_COUNT * 3));

  useFrame(() => {
    if (!pointsRef.current) return;

    const headPos = comet.start
      .clone()
      .addScaledVector(comet.direction, comet.progress * SCENE_RADIUS * 2);

    for (let i = 0; i < COMET_PARTICLE_COUNT; i++) {
      const t = i / COMET_PARTICLE_COUNT;
      const tailOffset = t * comet.length;
      const pos = headPos.clone().addScaledVector(comet.direction, -tailOffset);
      positionsRef.current[i * 3] = pos.x;
      positionsRef.current[i * 3 + 1] = pos.y;
      positionsRef.current[i * 3 + 2] = pos.z;
    }

    geometryRef.current.setAttribute(
      "position",
      new Float32BufferAttribute(positionsRef.current, 3),
    );
    geometryRef.current.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometryRef.current}>
      <pointsMaterial
        color="#cce8ff"
        size={0.12}
        sizeAttenuation
        transparent
        opacity={0.75}
        depthWrite={false}
      />
    </points>
  );
}

export function CometSystem() {
  const [comets, setComets] = useState<Comet[]>([]);
  const nextIdRef = useRef(0);
  const nextSpawnTimeRef = useRef(15 + Math.random() * 15);
  const elapsedRef = useRef(0);

  useFrame((_, delta) => {
    elapsedRef.current += delta;

    // Advance each comet and remove ones that have exited
    setComets((prev) =>
      prev
        .map((c) => ({ ...c, progress: c.progress + delta * c.speed }))
        .filter((c) => c.progress < 1.0),
    );

    // Spawn a new comet at random intervals
    if (elapsedRef.current >= nextSpawnTimeRef.current) {
      nextSpawnTimeRef.current = elapsedRef.current + 15 + Math.random() * 15;
      const start = randomOnSphere(SCENE_RADIUS);
      const end = randomOnSphere(SCENE_RADIUS);
      const direction = end.clone().sub(start).normalize();

      setComets((prev) => [
        ...prev,
        {
          id: nextIdRef.current++,
          start,
          direction,
          speed: 0.28 + Math.random() * 0.12,
          progress: 0,
          length: 3 + Math.random() * 4,
        },
      ]);
    }
  });

  return (
    <>
      {comets.map((comet) => (
        <CometMesh comet={comet} key={comet.id} />
      ))}
    </>
  );
}
