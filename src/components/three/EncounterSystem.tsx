import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AdditiveBlending,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { audioManager } from "../../audio/AudioManager";

type EncounterSystemProps = {
  enabled?: boolean;
  isMobile?: boolean;
  onCrosshairTargetChange?: (targetLabel: string | null) => void;
};

type AsteroidEntity = {
  kind: "asteroid";
  id: string;
  label: string;
  generation: number;
  size: number;
  color: string;
  orbitRadius: number;
  orbitSpeed: number;
  orbitPhase: number;
  inclination: number;
  radialDriftAmplitude: number;
  radialDriftSpeed: number;
  radialDriftPhase: number;
  verticalWobbleAmplitude: number;
  verticalWobbleSpeed: number;
  verticalWobblePhase: number;
  spinAxis: Vector3;
  spinSpeed: number;
};

type CometEntity = {
  kind: "comet";
  id: string;
  label: string;
  size: number;
  color: string;
  start: Vector3;
  direction: Vector3;
  pathLength: number;
  speed: number;
  progress: number;
  spinSpeed: number;
};

type SaucerEntity = {
  kind: "saucer";
  id: string;
  label: string;
  size: number;
  color: string;
  orbitRadius: number;
  orbitSpeed: number;
  orbitPhase: number;
  verticalBase: number;
  verticalAmplitude: number;
  verticalSpeed: number;
  verticalPhase: number;
  wobblePhase: number;
  spinSpeed: number;
  lifetime: number;
  age: number;
};

type ExplosionEffect = {
  id: string;
  position: Vector3;
  color: string;
  size: number;
  duration: number;
};

type CrosshairHit = {
  entityId: string;
  targetLabel: string | null;
  point: Vector3;
};

type ExplosionPulseProps = {
  effect: ExplosionEffect;
  onDone: (effectId: string) => void;
};

const CENTER_SCREEN = new Vector2(0, 0);
const SPAWN_RADIUS = 34;
const INITIAL_ASTEROID_COUNT = 10;
const MIN_ASTEROID_COUNT = 8;
const MIN_ASTEROID_SIZE = 0.085;
const ASTEROID_SPLIT_THRESHOLD = 0.16;
const ASTEROID_SPLIT_FACTOR = 0.62;
const ASTEROID_COLORS = [
  "#bfc7d7",
  "#8f9aa8",
  "#7b8795",
  "#c8b89b",
  "#a1b0c2",
];

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomPointOnSphere(radius: number) {
  const theta = randomRange(0, Math.PI * 2);
  const phi = Math.acos(randomRange(-1, 1));
  return new Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
  );
}

function ExplosionPulse({ effect, onDone }: ExplosionPulseProps) {
  const meshRef = useRef<Mesh>(null);
  const ageRef = useRef(0);
  const doneRef = useRef(false);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;

    ageRef.current += delta;
    const t = Math.min(ageRef.current / effect.duration, 1);
    const eased = 1 - Math.pow(1 - t, 2);
    const scale = 0.28 + eased * effect.size;
    meshRef.current.scale.setScalar(scale);

    if (meshRef.current.material instanceof MeshBasicMaterial) {
      meshRef.current.material.opacity = Math.max(
        0,
        0.92 * Math.pow(1 - t, 1.8),
      );
    }

    if (t >= 1 && !doneRef.current) {
      doneRef.current = true;
      onDone(effect.id);
    }
  });

  return (
    <mesh position={effect.position.toArray()} ref={meshRef}>
      <sphereGeometry args={[0.25, 14, 14]} />
      <meshBasicMaterial
        blending={AdditiveBlending}
        color={effect.color}
        depthWrite={false}
        opacity={0.92}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
}

export function EncounterSystem({
  enabled = true,
  isMobile = false,
  onCrosshairTargetChange,
}: EncounterSystemProps) {
  const { camera, gl } = useThree();

  const elapsedRef = useRef(0);
  const nextIdRef = useRef(0);
  const raycasterRef = useRef(new Raycaster());
  const meshRefs = useRef<Map<string, Mesh>>(new Map());
  const crosshairLabelRef = useRef<string | null>(null);

  const nextAsteroidSpawnAtRef = useRef(6 + Math.random() * 5);
  const nextCometSpawnAtRef = useRef(16 + Math.random() * 18);
  const nextSaucerSpawnAtRef = useRef(36 + Math.random() * 28);

  const tmpLookRef = useRef(new Vector3());

  const createId = useCallback((prefix: string) => {
    return `${prefix}-${nextIdRef.current++}`;
  }, []);

  const createAsteroid = useCallback(
    (
      generation = 0,
      overrides: Partial<
        Omit<AsteroidEntity, "id" | "kind" | "label" | "generation">
      > = {},
    ): AsteroidEntity => {
      const axis = new Vector3(
        randomRange(-1, 1),
        randomRange(-1, 1),
        randomRange(-1, 1),
      );
      if (axis.lengthSq() < 0.01) {
        axis.set(0.25, 1, 0.35);
      }
      axis.normalize();

      const size = Math.max(
        MIN_ASTEROID_SIZE,
        overrides.size ?? 0.4 - generation * 0.075 + Math.random() * 0.28,
      );
      const direction = Math.random() < 0.5 ? -1 : 1;
      const color =
        overrides.color ??
        ASTEROID_COLORS[Math.floor(Math.random() * ASTEROID_COLORS.length)];

      return {
        kind: "asteroid",
        id: createId("asteroid"),
        label: generation > 0 ? "ASTEROID FRAGMENT" : "ASTEROID",
        generation,
        size,
        color,
        orbitRadius: overrides.orbitRadius ?? randomRange(6.5, 23),
        orbitSpeed: overrides.orbitSpeed ?? direction * randomRange(0.035, 0.09),
        orbitPhase: overrides.orbitPhase ?? randomRange(0, Math.PI * 2),
        inclination:
          overrides.inclination ??
          randomRange(0.06, 0.5) * (Math.random() < 0.5 ? -1 : 1),
        radialDriftAmplitude:
          overrides.radialDriftAmplitude ?? randomRange(0.2, 0.95),
        radialDriftSpeed: overrides.radialDriftSpeed ?? randomRange(0.2, 0.62),
        radialDriftPhase:
          overrides.radialDriftPhase ?? randomRange(0, Math.PI * 2),
        verticalWobbleAmplitude:
          overrides.verticalWobbleAmplitude ?? randomRange(0.12, 0.9),
        verticalWobbleSpeed:
          overrides.verticalWobbleSpeed ?? randomRange(0.16, 0.58),
        verticalWobblePhase:
          overrides.verticalWobblePhase ?? randomRange(0, Math.PI * 2),
        spinAxis: overrides.spinAxis ?? axis,
        spinSpeed: overrides.spinSpeed ?? randomRange(0.2, 0.9),
      };
    },
    [createId],
  );

  const createComet = useCallback((): CometEntity => {
    const start = randomPointOnSphere(SPAWN_RADIUS + randomRange(1, 4));
    const end = randomPointOnSphere(SPAWN_RADIUS + randomRange(1, 4));
    const travel = end.clone().sub(start);
    const pathLength = Math.max(1, travel.length());

    return {
      kind: "comet",
      id: createId("comet"),
      label: "COMET",
      size: randomRange(0.13, 0.24),
      color: "#d7ebff",
      start,
      direction: travel.normalize(),
      pathLength,
      speed: randomRange(0.22, 0.36),
      progress: -0.18,
      spinSpeed: randomRange(0.8, 1.9),
    };
  }, [createId]);

  const createSaucer = useCallback((): SaucerEntity => {
    return {
      kind: "saucer",
      id: createId("saucer"),
      label: "ALIEN SAUCER",
      size: randomRange(0.2, 0.34),
      color: "#8fffd4",
      orbitRadius: randomRange(9, 22),
      orbitSpeed: randomRange(0.09, 0.16) * (Math.random() < 0.5 ? -1 : 1),
      orbitPhase: randomRange(0, Math.PI * 2),
      verticalBase: randomRange(-2.3, 2.4),
      verticalAmplitude: randomRange(0.35, 1.15),
      verticalSpeed: randomRange(0.45, 1.1),
      verticalPhase: randomRange(0, Math.PI * 2),
      wobblePhase: randomRange(0, Math.PI * 2),
      spinSpeed: randomRange(1.6, 2.8),
      lifetime: randomRange(14, 24),
      age: 0,
    };
  }, [createId]);

  const [asteroids, setAsteroids] = useState<AsteroidEntity[]>(() =>
    Array.from({ length: INITIAL_ASTEROID_COUNT }, () => createAsteroid(0)),
  );
  const [comets, setComets] = useState<CometEntity[]>([]);
  const [saucers, setSaucers] = useState<SaucerEntity[]>([]);
  const [effects, setEffects] = useState<ExplosionEffect[]>([]);

  const asteroidsRef = useRef(asteroids);
  const cometsRef = useRef(comets);
  const saucersRef = useRef(saucers);

  const updateAsteroids = useCallback(
    (updater: (previous: AsteroidEntity[]) => AsteroidEntity[]) => {
      setAsteroids((previous) => {
        const next = updater(previous);
        asteroidsRef.current = next;
        return next;
      });
    },
    [],
  );

  const updateComets = useCallback(
    (updater: (previous: CometEntity[]) => CometEntity[]) => {
      setComets((previous) => {
        const next = updater(previous);
        cometsRef.current = next;
        return next;
      });
    },
    [],
  );

  const updateSaucers = useCallback(
    (updater: (previous: SaucerEntity[]) => SaucerEntity[]) => {
      setSaucers((previous) => {
        const next = updater(previous);
        saucersRef.current = next;
        return next;
      });
    },
    [],
  );

  const setCrosshairLabel = useCallback(
    (label: string | null) => {
      if (crosshairLabelRef.current === label) return;
      crosshairLabelRef.current = label;
      onCrosshairTargetChange?.(label);
    },
    [onCrosshairTargetChange],
  );

  const setMeshRef = useCallback(
    (entityId: string) => (mesh: Mesh | null) => {
      if (mesh) {
        meshRefs.current.set(entityId, mesh);
        return;
      }
      meshRefs.current.delete(entityId);
    },
    [],
  );

  const createExplosion = useCallback(
    (position: Vector3, color: string, size: number, duration = 0.45) => {
      setEffects((previous) => [
        ...previous,
        {
          id: createId("fx"),
          position: position.clone(),
          color,
          size,
          duration,
        },
      ]);
    },
    [createId],
  );

  const getCrosshairHit = useCallback((): CrosshairHit | null => {
    const targets = Array.from(meshRefs.current.values());
    if (targets.length === 0) return null;

    const raycaster = raycasterRef.current;
    raycaster.setFromCamera(CENTER_SCREEN, camera);
    const intersections = raycaster.intersectObjects(targets, false);

    for (const intersection of intersections) {
      const entityId = intersection.object.userData.entityId;
      if (typeof entityId !== "string") continue;

      return {
        entityId,
        targetLabel:
          typeof intersection.object.userData.targetLabel === "string"
            ? (intersection.object.userData.targetLabel as string)
            : null,
        point: intersection.point.clone(),
      };
    }

    return null;
  }, [camera]);

  const handleHit = useCallback(
    (entityId: string, hitPoint?: Vector3) => {
      if (!enabled) return;

      const mesh = meshRefs.current.get(entityId);
      const hitPosition =
        hitPoint?.clone() ??
        (mesh ? mesh.getWorldPosition(new Vector3()) : undefined);

      audioManager.playBlasterShot();
      setCrosshairLabel(null);

      const asteroid = asteroidsRef.current.find((entry) => entry.id === entityId);
      if (asteroid) {
        if (asteroid.size > ASTEROID_SPLIT_THRESHOLD) {
          const nextGeneration = asteroid.generation + 1;
          const baseSize = Math.max(
            MIN_ASTEROID_SIZE,
            asteroid.size * ASTEROID_SPLIT_FACTOR,
          );
          const fragments = [0, 1].map((index) => {
            const direction = index === 0 ? -1 : 1;
            return createAsteroid(nextGeneration, {
              size: Math.max(
                MIN_ASTEROID_SIZE,
                baseSize * randomRange(0.92, 1.08),
              ),
              orbitRadius: Math.max(
                5.5,
                asteroid.orbitRadius + direction * randomRange(0.35, 0.95),
              ),
              orbitSpeed:
                asteroid.orbitSpeed *
                (Math.random() < 0.5 ? -1 : 1) *
                randomRange(0.92, 1.28),
              orbitPhase:
                asteroid.orbitPhase + direction * randomRange(0.18, 0.62),
              inclination: asteroid.inclination * randomRange(0.8, 1.2),
              color: asteroid.color,
            });
          });

          updateAsteroids((previous) => [
            ...previous.filter((entry) => entry.id !== entityId),
            ...fragments,
          ]);
          if (hitPosition) {
            createExplosion(hitPosition, asteroid.color, asteroid.size * 1.8, 0.32);
          }
          audioManager.playAsteroidSplit();
          return;
        }

        updateAsteroids((previous) =>
          previous.filter((entry) => entry.id !== entityId),
        );
        if (hitPosition) {
          createExplosion(hitPosition, asteroid.color, asteroid.size * 2.7, 0.45);
        }
        audioManager.playExplosion();
        return;
      }

      const comet = cometsRef.current.find((entry) => entry.id === entityId);
      if (comet) {
        updateComets((previous) =>
          previous.filter((entry) => entry.id !== entityId),
        );
        if (hitPosition) {
          createExplosion(hitPosition, comet.color, comet.size * 3.2, 0.5);
        }
        audioManager.playExplosion();
        return;
      }

      const saucer = saucersRef.current.find((entry) => entry.id === entityId);
      if (saucer) {
        updateSaucers((previous) =>
          previous.filter((entry) => entry.id !== entityId),
        );
        if (hitPosition) {
          createExplosion(hitPosition, saucer.color, saucer.size * 3.5, 0.52);
        }
        audioManager.playExplosion();
      }
    },
    [
      createAsteroid,
      createExplosion,
      enabled,
      setCrosshairLabel,
      updateAsteroids,
      updateComets,
      updateSaucers,
    ],
  );

  useEffect(() => {
    const canvas = gl.domElement;

    const onCanvasClickCapture = (event: MouseEvent) => {
      if (!enabled || isMobile) return;
      if (document.pointerLockElement !== canvas) return;

      const hit = getCrosshairHit();
      if (!hit) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handleHit(hit.entityId, hit.point);
    };

    canvas.addEventListener("click", onCanvasClickCapture, true);
    return () => {
      canvas.removeEventListener("click", onCanvasClickCapture, true);
    };
  }, [enabled, getCrosshairHit, gl.domElement, handleHit, isMobile]);

  useEffect(() => {
    if (!enabled) {
      setCrosshairLabel(null);
    }
  }, [enabled, setCrosshairLabel]);

  useEffect(() => {
    return () => {
      setCrosshairLabel(null);
    };
  }, [setCrosshairLabel]);

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05);
    elapsedRef.current += dt;
    const elapsed = elapsedRef.current;

    for (const asteroid of asteroidsRef.current) {
      const mesh = meshRefs.current.get(asteroid.id);
      if (!mesh) continue;

      const orbitAngle = elapsed * asteroid.orbitSpeed + asteroid.orbitPhase;
      const localRadius =
        asteroid.orbitRadius +
        Math.sin(elapsed * asteroid.radialDriftSpeed + asteroid.radialDriftPhase) *
          asteroid.radialDriftAmplitude;

      const x = Math.cos(orbitAngle) * localRadius;
      const z = Math.sin(orbitAngle) * localRadius;
      const y =
        Math.sin(orbitAngle) * asteroid.inclination +
        Math.sin(
          elapsed * asteroid.verticalWobbleSpeed + asteroid.verticalWobblePhase,
        ) *
          asteroid.verticalWobbleAmplitude;

      mesh.position.set(x, y, z);
      mesh.rotateOnAxis(asteroid.spinAxis, asteroid.spinSpeed * dt);
    }

    let cometsChanged = false;
    const nextComets: CometEntity[] = [];
    for (const comet of cometsRef.current) {
      comet.progress += dt * comet.speed;
      if (comet.progress > 1.15) {
        cometsChanged = true;
        continue;
      }

      nextComets.push(comet);
      const mesh = meshRefs.current.get(comet.id);
      if (!mesh) continue;

      mesh.position
        .copy(comet.start)
        .addScaledVector(comet.direction, comet.pathLength * comet.progress);
      tmpLookRef.current.copy(mesh.position).add(comet.direction);
      mesh.lookAt(tmpLookRef.current);
      mesh.rotateZ(comet.spinSpeed * dt);
    }
    if (cometsChanged) {
      updateComets(() => nextComets);
    }

    let saucersChanged = false;
    const nextSaucers: SaucerEntity[] = [];
    for (const saucer of saucersRef.current) {
      saucer.age += dt;
      if (saucer.age >= saucer.lifetime) {
        saucersChanged = true;
        continue;
      }

      nextSaucers.push(saucer);
      const mesh = meshRefs.current.get(saucer.id);
      if (!mesh) continue;

      const angle = elapsed * saucer.orbitSpeed + saucer.orbitPhase;
      const x = Math.cos(angle) * saucer.orbitRadius;
      const z = Math.sin(angle) * saucer.orbitRadius;
      const y =
        saucer.verticalBase +
        Math.sin(elapsed * saucer.verticalSpeed + saucer.verticalPhase) *
          saucer.verticalAmplitude;

      mesh.position.set(x, y, z);
      mesh.rotation.y += saucer.spinSpeed * dt;
      mesh.rotation.x =
        Math.sin(elapsed * 1.2 + saucer.wobblePhase) * 0.06 +
        Math.cos(elapsed * 0.7 + saucer.wobblePhase) * 0.03;
    }
    if (saucersChanged) {
      updateSaucers(() => nextSaucers);
    }

    if (enabled) {
      if (
        asteroidsRef.current.length < MIN_ASTEROID_COUNT &&
        elapsed >= nextAsteroidSpawnAtRef.current
      ) {
        nextAsteroidSpawnAtRef.current = elapsed + randomRange(6, 11);
        updateAsteroids((previous) => [...previous, createAsteroid(0)]);
      }

      if (elapsed >= nextCometSpawnAtRef.current) {
        nextCometSpawnAtRef.current = elapsed + randomRange(22, 42);
        updateComets((previous) => [...previous, createComet()]);
      }

      if (elapsed >= nextSaucerSpawnAtRef.current) {
        nextSaucerSpawnAtRef.current = elapsed + randomRange(48, 92);
        if (saucersRef.current.length === 0 && Math.random() > 0.28) {
          updateSaucers((previous) => [...previous, createSaucer()]);
        }
      }
    }

    if (!enabled || isMobile || document.pointerLockElement !== gl.domElement) {
      setCrosshairLabel(null);
      return;
    }

    const hit = getCrosshairHit();
    setCrosshairLabel(hit?.targetLabel ?? null);
  });

  return (
    <>
      {asteroids.map((asteroid) => (
        <mesh
          key={asteroid.id}
          onClick={(event) => {
            if (!enabled) return;
            if (!isMobile) return;
            event.stopPropagation();
            handleHit(asteroid.id);
          }}
          ref={setMeshRef(asteroid.id)}
          userData={{
            entityId: asteroid.id,
            targetLabel: asteroid.label,
          }}
        >
          <icosahedronGeometry args={[asteroid.size, asteroid.size > 0.25 ? 1 : 0]} />
          <meshStandardMaterial
            color={asteroid.color}
            emissive={asteroid.color}
            emissiveIntensity={0.32}
            flatShading
            roughness={0.76}
          />
        </mesh>
      ))}

      {comets.map((comet) => (
        <mesh
          key={comet.id}
          onClick={(event) => {
            if (!enabled) return;
            if (!isMobile) return;
            event.stopPropagation();
            handleHit(comet.id);
          }}
          ref={setMeshRef(comet.id)}
          scale={[0.65, 0.65, 2.35]}
          userData={{
            entityId: comet.id,
            targetLabel: comet.label,
          }}
        >
          <sphereGeometry args={[comet.size, 14, 14]} />
          <meshBasicMaterial
            color={comet.color}
            opacity={0.88}
            toneMapped={false}
            transparent
          />
        </mesh>
      ))}

      {saucers.map((saucer) => (
        <mesh
          key={saucer.id}
          onClick={(event) => {
            if (!enabled) return;
            if (!isMobile) return;
            event.stopPropagation();
            handleHit(saucer.id);
          }}
          ref={setMeshRef(saucer.id)}
          scale={[1.8, 0.55, 1.8]}
          userData={{
            entityId: saucer.id,
            targetLabel: saucer.label,
          }}
        >
          <sphereGeometry args={[saucer.size, 20, 16]} />
          <meshStandardMaterial
            color={saucer.color}
            emissive={saucer.color}
            emissiveIntensity={1}
            metalness={0.68}
            roughness={0.3}
          />
        </mesh>
      ))}

      {effects.map((effect) => (
        <ExplosionPulse
          effect={effect}
          key={effect.id}
          onDone={(effectId) => {
            setEffects((previous) =>
              previous.filter((entry) => entry.id !== effectId),
            );
          }}
        />
      ))}
    </>
  );
}
