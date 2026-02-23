import type { ThreeEvent } from "@react-three/fiber";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
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
  hasPlanetTarget?: boolean;
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
  shapeSeed: number;
  stretch: Vector3;
  detail: number;
  jitterOffset: Vector3;
  jitterVelocity: Vector3;
};

type AsteroidOverrides = Partial<
  Omit<AsteroidEntity, "id" | "kind" | "label" | "generation">
>;

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

type LaserShot = {
  id: string;
  position: Vector3;
  direction: Vector3;
  speed: number;
  age: number;
  ttl: number;
  length: number;
  color: string;
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
};

type ExplosionPulseProps = {
  effect: ExplosionEffect;
  onDone: (effectId: string) => void;
};

const CENTER_SCREEN = new Vector2(0, 0);
const SPAWN_RADIUS = 34;

const INITIAL_ASTEROID_COUNT = 12;
const MIN_ASTEROID_COUNT = 10;
const MAX_ASTEROID_SIZE = 0.14;
const MIN_ASTEROID_SIZE = 0.028;
const ASTEROID_SPLIT_THRESHOLD = 0.07;
const ASTEROID_SPLIT_FACTOR = 0.62;
const LASER_COLLISION_PAD = 0.04;

const ASTEROID_COLORS = ["#9aa4b1", "#8d948f", "#858f9b", "#b1a58e", "#717b89"];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function seededUnit(seed: number) {
  const x = Math.sin(seed) * 43758.5453123;
  return x - Math.floor(x);
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

function buildAsteroidGeometry(asteroid: AsteroidEntity): BufferGeometry {
  const chooseIco = seededUnit(asteroid.shapeSeed * 1.91) > 0.44;
  const geometry = chooseIco
    ? new IcosahedronGeometry(asteroid.size, asteroid.detail)
    : new DodecahedronGeometry(asteroid.size, asteroid.detail);

  const positions = geometry.attributes.position;
  const vertex = new Vector3();

  for (let i = 0; i < positions.count; i++) {
    vertex.set(positions.getX(i), positions.getY(i), positions.getZ(i));
    const safeSize = Math.max(asteroid.size, 1e-5);
    const nx = vertex.x / safeSize;
    const ny = vertex.y / safeSize;
    const nz = vertex.z / safeSize;
    const shape = asteroid.shapeSeed;

    const n1 = Math.sin(nx * 7.7 + shape * 2.9);
    const n2 = Math.sin(ny * 9.1 + shape * 4.3);
    const n3 = Math.sin(nz * 8.3 + shape * 6.1);
    const ridge = Math.sin((nx + ny + nz) * 6.5 + shape * 7.8);
    const displacement = clamp(
      0.84 + n1 * 0.14 + n2 * 0.13 + n3 * 0.1 + ridge * 0.09,
      0.56,
      1.26,
    );

    vertex.multiplyScalar(displacement);
    vertex.multiply(asteroid.stretch);
    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
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
  hasPlanetTarget = false,
  onCrosshairTargetChange,
}: EncounterSystemProps) {
  const { camera, gl } = useThree();

  const elapsedRef = useRef(0);
  const nextIdRef = useRef(0);
  const raycasterRef = useRef(new Raycaster());
  const meshRefs = useRef<Map<string, Mesh>>(new Map());
  const shotMeshRefs = useRef<Map<string, Mesh>>(new Map());
  const crosshairLabelRef = useRef<string | null>(null);
  const asteroidGeometryCacheRef = useRef<Map<string, BufferGeometry>>(
    new Map(),
  );

  const nextAsteroidSpawnAtRef = useRef(6 + Math.random() * 4);
  const nextCometSpawnAtRef = useRef(16 + Math.random() * 18);
  const nextSaucerSpawnAtRef = useRef(36 + Math.random() * 28);

  const tmpLookRef = useRef(new Vector3());
  const tmpDirRef = useRef(new Vector3());
  const shotStartRef = useRef(new Vector3());
  const shotEndRef = useRef(new Vector3());
  const collisionCenterRef = useRef(new Vector3());
  const collisionClosestRef = useRef(new Vector3());
  const collisionSegRef = useRef(new Vector3());
  const collisionToPointRef = useRef(new Vector3());

  const createId = useCallback((prefix: string) => {
    return `${prefix}-${nextIdRef.current++}`;
  }, []);

  const createAsteroid = useCallback(
    (generation = 0, overrides: AsteroidOverrides = {}): AsteroidEntity => {
      const axis = new Vector3(
        randomRange(-1, 1),
        randomRange(-1, 1),
        randomRange(-1, 1),
      );
      if (axis.lengthSq() < 0.01) {
        axis.set(0.22, 1, 0.32);
      }
      axis.normalize();

      const baseSize = MAX_ASTEROID_SIZE - generation * 0.024;
      const size = clamp(
        overrides.size ?? randomRange(baseSize * 0.75, baseSize * 1.05),
        MIN_ASTEROID_SIZE,
        MAX_ASTEROID_SIZE,
      );

      const direction = Math.random() < 0.5 ? -1 : 1;
      const color =
        overrides.color ??
        ASTEROID_COLORS[Math.floor(Math.random() * ASTEROID_COLORS.length)];
      const stretch =
        overrides.stretch?.clone() ??
        new Vector3(
          randomRange(0.82, 1.32),
          randomRange(0.72, 1.22),
          randomRange(0.82, 1.34),
        );

      return {
        kind: "asteroid",
        id: createId("asteroid"),
        label: generation > 0 ? "ASTEROID FRAGMENT" : "ASTEROID",
        generation,
        size,
        color,
        orbitRadius: overrides.orbitRadius ?? randomRange(6.5, 23),
        orbitSpeed:
          overrides.orbitSpeed ?? direction * randomRange(0.035, 0.09),
        orbitPhase: overrides.orbitPhase ?? randomRange(0, Math.PI * 2),
        inclination:
          overrides.inclination ??
          randomRange(0.06, 0.5) * (Math.random() < 0.5 ? -1 : 1),
        radialDriftAmplitude:
          overrides.radialDriftAmplitude ?? randomRange(0.12, 0.72),
        radialDriftSpeed: overrides.radialDriftSpeed ?? randomRange(0.2, 0.62),
        radialDriftPhase:
          overrides.radialDriftPhase ?? randomRange(0, Math.PI * 2),
        verticalWobbleAmplitude:
          overrides.verticalWobbleAmplitude ?? randomRange(0.1, 0.72),
        verticalWobbleSpeed:
          overrides.verticalWobbleSpeed ?? randomRange(0.16, 0.58),
        verticalWobblePhase:
          overrides.verticalWobblePhase ?? randomRange(0, Math.PI * 2),
        spinAxis: overrides.spinAxis?.clone() ?? axis,
        spinSpeed: overrides.spinSpeed ?? randomRange(0.2, 0.9),
        shapeSeed: overrides.shapeSeed ?? randomRange(1, 5000),
        stretch,
        detail: overrides.detail ?? (Math.random() > 0.52 ? 1 : 0),
        jitterOffset: overrides.jitterOffset?.clone() ?? new Vector3(),
        jitterVelocity: overrides.jitterVelocity?.clone() ?? new Vector3(),
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
      size: randomRange(0.11, 0.2),
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
      size: randomRange(0.18, 0.3),
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
  const [shots, setShots] = useState<LaserShot[]>([]);
  const [effects, setEffects] = useState<ExplosionEffect[]>([]);

  const asteroidsRef = useRef(asteroids);
  const cometsRef = useRef(comets);
  const saucersRef = useRef(saucers);
  const shotsRef = useRef(shots);

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

  const updateShots = useCallback(
    (updater: (previous: LaserShot[]) => LaserShot[]) => {
      setShots((previous) => {
        const next = updater(previous);
        shotsRef.current = next;
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

  const setShotMeshRef = useCallback(
    (shotId: string) => (mesh: Mesh | null) => {
      if (mesh) {
        shotMeshRefs.current.set(shotId, mesh);
        return;
      }
      shotMeshRefs.current.delete(shotId);
    },
    [],
  );

  const getAsteroidGeometry = useCallback((asteroid: AsteroidEntity) => {
    const cached = asteroidGeometryCacheRef.current.get(asteroid.id);
    if (cached) {
      return cached;
    }

    const geometry = buildAsteroidGeometry(asteroid);
    asteroidGeometryCacheRef.current.set(asteroid.id, geometry);
    return geometry;
  }, []);

  const removeAsteroidGeometry = useCallback((asteroidId: string) => {
    const geometry = asteroidGeometryCacheRef.current.get(asteroidId);
    if (!geometry) return;
    geometry.dispose();
    asteroidGeometryCacheRef.current.delete(asteroidId);
  }, []);

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
      };
    }

    return null;
  }, [camera]);

  const findSegmentHit = useCallback((start: Vector3, end: Vector3) => {
    let bestEntityId: string | null = null;
    let bestHitPoint: Vector3 | null = null;
    let bestT = Infinity;

    const segment = collisionSegRef.current.copy(end).sub(start);
    const segmentLengthSq = segment.lengthSq();
    if (segmentLengthSq < 1e-7) {
      return null;
    }

    for (const [entityId, mesh] of meshRefs.current) {
      mesh.getWorldPosition(collisionCenterRef.current);
      const hitRadiusValue = mesh.userData.hitRadius;
      const hitRadius =
        (typeof hitRadiusValue === "number" ? hitRadiusValue : 0.12) +
        LASER_COLLISION_PAD;

      const toPoint = collisionToPointRef.current
        .copy(collisionCenterRef.current)
        .sub(start);
      const t = clamp(toPoint.dot(segment) / segmentLengthSq, 0, 1);
      const closest = collisionClosestRef.current
        .copy(start)
        .addScaledVector(segment, t);
      const distSq = closest.distanceToSquared(collisionCenterRef.current);

      if (distSq > hitRadius * hitRadius) continue;
      if (t >= bestT) continue;

      bestT = t;
      bestEntityId = entityId;
      bestHitPoint = closest.clone();
    }

    if (!bestEntityId || !bestHitPoint) {
      return null;
    }

    return {
      entityId: bestEntityId,
      point: bestHitPoint,
    };
  }, []);

  const handleHit = useCallback(
    (entityId: string, hitPoint?: Vector3) => {
      if (!enabled) return;

      const mesh = meshRefs.current.get(entityId);
      const hitPosition =
        hitPoint?.clone() ??
        (mesh ? mesh.getWorldPosition(new Vector3()) : undefined);

      setCrosshairLabel(null);

      const asteroid = asteroidsRef.current.find(
        (entry) => entry.id === entityId,
      );
      if (asteroid) {
        if (asteroid.size > ASTEROID_SPLIT_THRESHOLD) {
          const nextGeneration = asteroid.generation + 1;
          const baseSize = Math.max(
            MIN_ASTEROID_SIZE,
            asteroid.size * ASTEROID_SPLIT_FACTOR,
          );

          const splitPush = Math.max(0.25, asteroid.size * 8.4);
          const orbitAngle =
            elapsedRef.current * asteroid.orbitSpeed + asteroid.orbitPhase;
          const tangent = new Vector3(
            -Math.sin(orbitAngle),
            0,
            Math.cos(orbitAngle),
          ).normalize();
          const radial = new Vector3(
            Math.cos(orbitAngle),
            0,
            Math.sin(orbitAngle),
          ).normalize();
          const vertical = new Vector3(0, 1, 0);

          const fragmentVelocityA = asteroid.jitterVelocity
            .clone()
            .multiplyScalar(0.35)
            .addScaledVector(tangent, splitPush)
            .addScaledVector(radial, splitPush * 0.45)
            .addScaledVector(vertical, randomRange(-0.22, 0.22));

          const fragmentVelocityB = asteroid.jitterVelocity
            .clone()
            .multiplyScalar(0.35)
            .addScaledVector(tangent, -splitPush)
            .addScaledVector(radial, -splitPush * 0.35)
            .addScaledVector(vertical, randomRange(-0.22, 0.22));

          const fragments = [
            createAsteroid(nextGeneration, {
              size: clamp(
                baseSize * randomRange(0.92, 1.08),
                MIN_ASTEROID_SIZE,
                MAX_ASTEROID_SIZE,
              ),
              orbitRadius: asteroid.orbitRadius,
              orbitSpeed: asteroid.orbitSpeed,
              orbitPhase: asteroid.orbitPhase,
              inclination: asteroid.inclination,
              radialDriftAmplitude: asteroid.radialDriftAmplitude,
              radialDriftSpeed: asteroid.radialDriftSpeed,
              radialDriftPhase: asteroid.radialDriftPhase,
              verticalWobbleAmplitude: asteroid.verticalWobbleAmplitude,
              verticalWobbleSpeed: asteroid.verticalWobbleSpeed,
              verticalWobblePhase: asteroid.verticalWobblePhase,
              color: asteroid.color,
              jitterOffset: asteroid.jitterOffset.clone(),
              jitterVelocity: fragmentVelocityA,
            }),
            createAsteroid(nextGeneration, {
              size: clamp(
                baseSize * randomRange(0.92, 1.08),
                MIN_ASTEROID_SIZE,
                MAX_ASTEROID_SIZE,
              ),
              orbitRadius: asteroid.orbitRadius,
              orbitSpeed: asteroid.orbitSpeed,
              orbitPhase: asteroid.orbitPhase,
              inclination: asteroid.inclination,
              radialDriftAmplitude: asteroid.radialDriftAmplitude,
              radialDriftSpeed: asteroid.radialDriftSpeed,
              radialDriftPhase: asteroid.radialDriftPhase,
              verticalWobbleAmplitude: asteroid.verticalWobbleAmplitude,
              verticalWobbleSpeed: asteroid.verticalWobbleSpeed,
              verticalWobblePhase: asteroid.verticalWobblePhase,
              color: asteroid.color,
              jitterOffset: asteroid.jitterOffset.clone(),
              jitterVelocity: fragmentVelocityB,
            }),
          ];

          removeAsteroidGeometry(entityId);
          updateAsteroids((previous) => [
            ...previous.filter((entry) => entry.id !== entityId),
            ...fragments,
          ]);
          if (hitPosition) {
            createExplosion(
              hitPosition,
              asteroid.color,
              asteroid.size * 1.9,
              0.32,
            );
          }
          audioManager.playAsteroidSplit();
          return;
        }

        removeAsteroidGeometry(entityId);
        updateAsteroids((previous) =>
          previous.filter((entry) => entry.id !== entityId),
        );
        if (hitPosition) {
          createExplosion(
            hitPosition,
            asteroid.color,
            asteroid.size * 2.9,
            0.45,
          );
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
          createExplosion(hitPosition, saucer.color, saucer.size * 3.7, 0.52);
        }
        audioManager.playExplosion();
      }
    },
    [
      createAsteroid,
      createExplosion,
      enabled,
      removeAsteroidGeometry,
      setCrosshairLabel,
      updateAsteroids,
      updateComets,
      updateSaucers,
    ],
  );

  const spawnLaserShot = useCallback(
    (origin: Vector3, direction: Vector3) => {
      updateShots((previous) => [
        ...previous,
        {
          id: createId("laser"),
          position: origin.clone(),
          direction: direction.clone().normalize(),
          speed: 64,
          age: 0,
          ttl: 1.2,
          length: 1.35,
          color: "#7be7ff",
        },
      ]);
    },
    [createId, updateShots],
  );

  const fireWeapon = useCallback(
    (directionOverride?: Vector3) => {
      if (!enabled) return;

      const direction = directionOverride
        ? directionOverride.clone().normalize()
        : camera.getWorldDirection(tmpDirRef.current).normalize();
      const origin = camera.position.clone().addScaledVector(direction, 0.85);
      spawnLaserShot(origin, direction);
      audioManager.playBlasterShot();
    },
    [camera, enabled, spawnLaserShot],
  );

  const handleMobileTap = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (!enabled || !isMobile) return;

      event.stopPropagation();
      const direction = event.point.clone().sub(camera.position).normalize();
      fireWeapon(direction);
    },
    [camera, enabled, fireWeapon, isMobile],
  );

  useEffect(() => {
    const canvas = gl.domElement;

    const onCanvasClickCapture = (event: MouseEvent) => {
      if (!enabled || isMobile) return;
      if (document.pointerLockElement !== canvas) return;
      if (hasPlanetTarget) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      fireWeapon();
    };

    canvas.addEventListener("click", onCanvasClickCapture, true);
    return () => {
      canvas.removeEventListener("click", onCanvasClickCapture, true);
    };
  }, [enabled, fireWeapon, gl.domElement, hasPlanetTarget, isMobile]);

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

  useEffect(() => {
    const activeIds = new Set(asteroids.map((asteroid) => asteroid.id));
    for (const [asteroidId, geometry] of asteroidGeometryCacheRef.current) {
      if (activeIds.has(asteroidId)) continue;
      geometry.dispose();
      asteroidGeometryCacheRef.current.delete(asteroidId);
    }
  }, [asteroids]);

  useEffect(() => {
    return () => {
      for (const geometry of asteroidGeometryCacheRef.current.values()) {
        geometry.dispose();
      }
      asteroidGeometryCacheRef.current.clear();
    };
  }, []);

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
        Math.sin(
          elapsed * asteroid.radialDriftSpeed + asteroid.radialDriftPhase,
        ) *
          asteroid.radialDriftAmplitude;

      asteroid.jitterOffset.addScaledVector(asteroid.jitterVelocity, dt);
      asteroid.jitterVelocity.multiplyScalar(Math.max(0, 1 - dt * 2.2));

      const x = Math.cos(orbitAngle) * localRadius + asteroid.jitterOffset.x;
      const z = Math.sin(orbitAngle) * localRadius + asteroid.jitterOffset.z;
      const y =
        Math.sin(orbitAngle) * asteroid.inclination +
        Math.sin(
          elapsed * asteroid.verticalWobbleSpeed + asteroid.verticalWobblePhase,
        ) *
          asteroid.verticalWobbleAmplitude +
        asteroid.jitterOffset.y;

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

    let shotsChanged = false;
    const nextShots: LaserShot[] = [];
    for (const shot of shotsRef.current) {
      shot.age += dt;
      shotStartRef.current.copy(shot.position);
      shot.position.addScaledVector(shot.direction, shot.speed * dt);
      shotEndRef.current.copy(shot.position);

      const collision = findSegmentHit(
        shotStartRef.current,
        shotEndRef.current,
      );
      if (collision) {
        shotsChanged = true;
        handleHit(collision.entityId, collision.point);
        continue;
      }

      if (shot.age > shot.ttl) {
        shotsChanged = true;
        continue;
      }

      nextShots.push(shot);
      const mesh = shotMeshRefs.current.get(shot.id);
      if (!mesh) continue;

      mesh.position.copy(shot.position);
      tmpLookRef.current.copy(shot.position).add(shot.direction);
      mesh.lookAt(tmpLookRef.current);
    }
    if (shotsChanged) {
      updateShots(() => nextShots);
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

    if (
      !enabled ||
      isMobile ||
      hasPlanetTarget ||
      document.pointerLockElement !== gl.domElement
    ) {
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
          onClick={handleMobileTap}
          ref={setMeshRef(asteroid.id)}
          userData={{
            entityId: asteroid.id,
            hitRadius: asteroid.size * 1.55,
            targetLabel: asteroid.label,
          }}
        >
          <primitive attach="geometry" object={getAsteroidGeometry(asteroid)} />
          <meshStandardMaterial
            color={asteroid.color}
            emissive={asteroid.color}
            emissiveIntensity={0.12}
            flatShading
            metalness={0.08}
            roughness={0.92}
          />
        </mesh>
      ))}

      {comets.map((comet) => (
        <mesh
          key={comet.id}
          onClick={handleMobileTap}
          ref={setMeshRef(comet.id)}
          scale={[0.56, 0.56, 2.1]}
          userData={{
            entityId: comet.id,
            hitRadius: comet.size * 1.25,
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
          onClick={handleMobileTap}
          ref={setMeshRef(saucer.id)}
          scale={[1.8, 0.55, 1.8]}
          userData={{
            entityId: saucer.id,
            hitRadius: saucer.size * 1.8,
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

      {shots.map((shot) => (
        <mesh key={shot.id} ref={setShotMeshRef(shot.id)}>
          <boxGeometry args={[0.045, 0.045, shot.length]} />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color={shot.color}
            depthWrite={false}
            opacity={0.92}
            toneMapped={false}
            transparent
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
