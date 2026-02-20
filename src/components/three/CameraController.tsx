import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useCallback, useEffect, useRef } from "react";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useIdleState } from "../../hooks/useIdleTimer";
import { CAMERA_DEFAULT } from "../../data/cameraPositions";
import {
  PLANETS,
  getPlanetById,
  getPlanetPositionAtTime,
} from "../../data/planets";

type CameraControllerProps = {
  flyToPlanetId?: string;
  isFlyingHome?: boolean;
  isEntering?: boolean;
  activePlanetId?: string;
  onArrivePlanet?: (planetId: string) => void;
  onArriveHome?: () => void;
  onEntranceComplete?: () => void;
  onNearestPlanetChange?: (planetId: string | null) => void;
};

// Pre-allocate reusable vectors to avoid GC churn in useFrame
const _cameraDir = new Vector3();
const _toPlanet = new Vector3();
const _offset = new Vector3();
const _planetPos = new Vector3();
const _moveDir = new Vector3();
const _sideDir = new Vector3();

const PROXIMITY_BASE_THRESHOLD = 6;
const AIM_THRESHOLD = 0.85;
const HYSTERESIS_MULTIPLIER = 1.5;
const WASD_SPEED = 0.15;

export function CameraController({
  flyToPlanetId,
  isFlyingHome = false,
  isEntering = false,
  activePlanetId,
  onArrivePlanet,
  onArriveHome,
  onEntranceComplete,
  onNearestPlanetChange,
}: CameraControllerProps) {
  const { camera, clock } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const activeTweenRef = useRef<gsap.core.Tween | null>(null);
  const activeFlightRef = useRef<string | null>(null);
  const hasEnteredRef = useRef(false);
  const nearestRef = useRef<string | null>(null);

  // Track idle state for auto-rotate
  const isIdle = useIdleState(30_000);

  // Track which keys are currently held for WASD flight
  const keysRef = useRef<Set<string>>(new Set());

  // Track the fly-to planet and progress for smooth tracking during flight
  const flyingPlanetRef = useRef<string | null>(null);
  const flyProgressRef = useRef(0);

  // Keyboard event handlers for WASD flight
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      keysRef.current.add(key);
    }
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    keysRef.current.delete(key);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  useEffect(() => {
    return () => {
      activeTweenRef.current?.kill();
      activeTweenRef.current = null;
    };
  }, []);

  // Entrance animation: zoom in from far away
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !isEntering || hasEnteredRef.current) {
      return;
    }

    hasEnteredRef.current = true;
    controls.enabled = false;

    const cameraState = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      tx: controls.target.x,
      ty: controls.target.y,
      tz: controls.target.z,
    };

    activeTweenRef.current = gsap.to(cameraState, {
      duration: 3.0,
      ease: "power2.out",
      x: CAMERA_DEFAULT.position[0],
      y: CAMERA_DEFAULT.position[1],
      z: CAMERA_DEFAULT.position[2],
      tx: CAMERA_DEFAULT.target[0],
      ty: CAMERA_DEFAULT.target[1],
      tz: CAMERA_DEFAULT.target[2],
      onUpdate: () => {
        camera.position.set(cameraState.x, cameraState.y, cameraState.z);
        controls.target.set(cameraState.tx, cameraState.ty, cameraState.tz);
        controls.update();
      },
      onComplete: () => {
        controls.enabled = true;
        activeTweenRef.current = null;
        onEntranceComplete?.();
      },
    });
  }, [isEntering, camera, onEntranceComplete]);

  // Fly-to-planet and fly-home animations
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    // Don't start fly-to during entrance animation
    if (isEntering && !hasEnteredRef.current) {
      return;
    }

    if (flyToPlanetId) {
      // Special case: Sun / About Me (stationary target)
      if (flyToPlanetId === "about") {
        if (activeFlightRef.current === "planet:about") {
          return;
        }
        activeFlightRef.current = "planet:about";
        flyingPlanetRef.current = null;
        activeTweenRef.current?.kill();
        controls.enabled = false;

        const cameraState = {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
          tx: controls.target.x,
          ty: controls.target.y,
          tz: controls.target.z,
        };

        activeTweenRef.current = gsap.to(cameraState, {
          duration: 1.5,
          ease: "power2.inOut",
          x: 0,
          y: 2,
          z: 5,
          tx: 0,
          ty: 0,
          tz: 0,
          onUpdate: () => {
            camera.position.set(cameraState.x, cameraState.y, cameraState.z);
            controls.target.set(cameraState.tx, cameraState.ty, cameraState.tz);
            controls.update();
          },
          onComplete: () => {
            controls.enabled = true;
            activeTweenRef.current = null;
            flyingPlanetRef.current = null;
            onArrivePlanet?.("about");
          },
        });
        return;
      }

      // Flying to an orbiting planet: animate a progress value 0→1
      // and compute position from the planet's LIVE position each frame
      const flightId = `planet:${flyToPlanetId}`;
      if (activeFlightRef.current === flightId) {
        return;
      }

      activeFlightRef.current = flightId;
      flyingPlanetRef.current = flyToPlanetId;
      flyProgressRef.current = 0;
      activeTweenRef.current?.kill();
      controls.enabled = false;

      // Capture starting position
      const startPos = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      };
      const startTarget = {
        x: controls.target.x,
        y: controls.target.y,
        z: controls.target.z,
      };

      const progressObj = { t: 0 };

      activeTweenRef.current = gsap.to(progressObj, {
        duration: 1.5,
        ease: "power2.inOut",
        t: 1,
        onUpdate: () => {
          flyProgressRef.current = progressObj.t;
          const t = progressObj.t;

          // Get planet's CURRENT position (tracks moving planet)
          const planet = getPlanetById(flyToPlanetId);
          if (!planet) return;
          const elapsed = clock.getElapsedTime();
          const pos = getPlanetPositionAtTime(planet, elapsed);

          // Compute camera offset from planet center
          const dist = Math.hypot(pos.x, pos.y, pos.z);
          const safeDist = dist === 0 ? 1 : dist;
          const closeDistance = planet.radius * 3;
          const scale = closeDistance / safeDist;

          const endPos = {
            x: pos.x + pos.x * scale,
            y: pos.y + pos.y * scale + planet.radius * 0.5,
            z: pos.z + pos.z * scale,
          };

          // Lerp from start to end based on progress
          camera.position.set(
            startPos.x + (endPos.x - startPos.x) * t,
            startPos.y + (endPos.y - startPos.y) * t,
            startPos.z + (endPos.z - startPos.z) * t,
          );
          controls.target.set(
            startTarget.x + (pos.x - startTarget.x) * t,
            startTarget.y + (pos.y - startTarget.y) * t,
            startTarget.z + (pos.z - startTarget.z) * t,
          );
          controls.update();
        },
        onComplete: () => {
          controls.enabled = true;
          activeTweenRef.current = null;
          flyingPlanetRef.current = null;
          onArrivePlanet?.(flyToPlanetId);
        },
      });

      return;
    }

    if (isFlyingHome) {
      if (activeFlightRef.current === "home") {
        return;
      }
      activeFlightRef.current = "home";
      flyingPlanetRef.current = null;
      activeTweenRef.current?.kill();
      controls.enabled = false;

      const cameraState = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        tx: controls.target.x,
        ty: controls.target.y,
        tz: controls.target.z,
      };

      activeTweenRef.current = gsap.to(cameraState, {
        duration: 1.5,
        ease: "power2.inOut",
        x: CAMERA_DEFAULT.position[0],
        y: CAMERA_DEFAULT.position[1],
        z: CAMERA_DEFAULT.position[2],
        tx: CAMERA_DEFAULT.target[0],
        ty: CAMERA_DEFAULT.target[1],
        tz: CAMERA_DEFAULT.target[2],
        onUpdate: () => {
          camera.position.set(cameraState.x, cameraState.y, cameraState.z);
          controls.target.set(cameraState.tx, cameraState.ty, cameraState.tz);
          controls.update();
        },
        onComplete: () => {
          controls.enabled = true;
          activeTweenRef.current = null;
          onArriveHome?.();
        },
      });

      return;
    }

    activeFlightRef.current = null;
    controls.enabled = true;
  }, [
    camera,
    clock,
    flyToPlanetId,
    isEntering,
    isFlyingHome,
    onArriveHome,
    onArrivePlanet,
  ]);

  // useFrame: dynamic constraints, planet tracking, WASD flight, proximity detection
  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    const elapsed = clock.getElapsedTime();

    // --- Dynamic OrbitControls constraints ---
    if (activePlanetId) {
      const planet = getPlanetById(activePlanetId);
      if (planet) {
        controls.minDistance = planet.radius * 1.8;
        controls.maxDistance = planet.radius * 8;
      }
      // Allow full 360° orbit around planet
      controls.minAzimuthAngle = -Infinity;
      controls.maxAzimuthAngle = Infinity;
      controls.minPolarAngle = 0.1;
      controls.maxPolarAngle = Math.PI - 0.1;
      controls.enablePan = false;
    } else {
      // Solar system free-flight: wide constraints
      controls.minDistance = 5;
      controls.maxDistance = 60;
      controls.minAzimuthAngle = -Infinity;
      controls.maxAzimuthAngle = Infinity;
      controls.minPolarAngle = 0.2;
      controls.maxPolarAngle = Math.PI - 0.2;
      controls.enablePan = true;

      // Clamp target to prevent drifting into void
      if (controls.target.length() > 25) {
        controls.target.clampLength(0, 25);
      }
    }

    // --- Planet tracking: follow orbiting planet ---
    if (activePlanetId && activePlanetId !== "about") {
      const planet = getPlanetById(activePlanetId);
      if (planet) {
        const pos = getPlanetPositionAtTime(planet, elapsed);
        _planetPos.set(pos.x, pos.y, pos.z);

        // Calculate camera offset from current target
        _offset.copy(camera.position).sub(controls.target);

        // Move target to planet's current position
        controls.target.copy(_planetPos);

        // Move camera to maintain same relative offset
        camera.position.copy(_planetPos).add(_offset);
      }
    }

    // --- WASD / Arrow key flight (only in solar system free-flight mode) ---
    if (!activePlanetId && !flyToPlanetId && !isFlyingHome && !isEntering && controls.enabled) {
      const keys = keysRef.current;
      if (keys.size > 0) {
        // Get camera forward direction (projected onto XZ plane for horizontal movement)
        camera.getWorldDirection(_moveDir);
        _moveDir.y = 0;
        _moveDir.normalize();

        // Side direction (perpendicular to forward on XZ plane)
        _sideDir.set(_moveDir.z, 0, -_moveDir.x);

        let dx = 0;
        let dz = 0;

        if (keys.has("w") || keys.has("arrowup")) {
          dx += _moveDir.x;
          dz += _moveDir.z;
        }
        if (keys.has("s") || keys.has("arrowdown")) {
          dx -= _moveDir.x;
          dz -= _moveDir.z;
        }
        if (keys.has("a") || keys.has("arrowleft")) {
          dx += _sideDir.x;
          dz += _sideDir.z;
        }
        if (keys.has("d") || keys.has("arrowright")) {
          dx -= _sideDir.x;
          dz -= _sideDir.z;
        }

        if (dx !== 0 || dz !== 0) {
          const len = Math.hypot(dx, dz);
          dx = (dx / len) * WASD_SPEED;
          dz = (dz / len) * WASD_SPEED;

          camera.position.x += dx;
          camera.position.z += dz;
          controls.target.x += dx;
          controls.target.z += dz;
        }
      }
    }

    // --- Idle auto-rotate (solar system free-flight only) ---
    if (isIdle && !activePlanetId && !flyToPlanetId && !isFlyingHome && !isEntering && controls.enabled) {
      const autoRotateSpeed = 0.0008;
      const angle = autoRotateSpeed;
      const cx = camera.position.x;
      const cz = camera.position.z;
      camera.position.x = cx * Math.cos(angle) - cz * Math.sin(angle);
      camera.position.z = cx * Math.sin(angle) + cz * Math.cos(angle);
      controls.update();
    }

    // --- Proximity detection (SOLAR_SYSTEM state only) ---
    if (!flyToPlanetId && !isFlyingHome && !activePlanetId && !isEntering) {
      camera.getWorldDirection(_cameraDir);

      let closestId: string | null = null;
      let closestScore = Infinity;

      // Check all planets
      for (const planet of PLANETS) {
        const pos = getPlanetPositionAtTime(planet, elapsed);
        _toPlanet.set(pos.x, pos.y, pos.z).sub(camera.position);
        const distance = _toPlanet.length();

        const threshold =
          PROXIMITY_BASE_THRESHOLD *
          Math.max(planet.orbitRadius / 10, 0.5) *
          (nearestRef.current === planet.id ? HYSTERESIS_MULTIPLIER : 1);

        if (distance > threshold) {
          continue;
        }

        const dot = _cameraDir.dot(_toPlanet.normalize());
        if (dot < AIM_THRESHOLD) {
          continue;
        }

        const score = distance * (1 - dot);
        if (score < closestScore) {
          closestScore = score;
          closestId = planet.id;
        }
      }

      // Also check the Sun (About Me) at origin
      _toPlanet.set(0, 0, 0).sub(camera.position);
      const sunDistance = _toPlanet.length();
      const sunThreshold =
        4 * (nearestRef.current === "about" ? HYSTERESIS_MULTIPLIER : 1);
      if (sunDistance <= sunThreshold) {
        const dot = _cameraDir.dot(_toPlanet.normalize());
        if (dot >= AIM_THRESHOLD) {
          const score = sunDistance * (1 - dot);
          if (score < closestScore) {
            closestScore = score;
            closestId = "about";
          }
        }
      }

      if (closestId !== nearestRef.current) {
        nearestRef.current = closestId;
        onNearestPlanetChange?.(closestId);
      }
    }

    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      dampingFactor={0.05}
      enableDamping
      enablePan={true}
      maxAzimuthAngle={Infinity}
      maxDistance={60}
      maxPolarAngle={Math.PI - 0.2}
      minAzimuthAngle={-Infinity}
      minDistance={5}
      minPolarAngle={0.2}
    />
  );
}
