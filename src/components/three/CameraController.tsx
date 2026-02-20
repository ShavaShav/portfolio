import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useCallback, useEffect, useRef } from "react";
import { Euler, MathUtils, Quaternion, Vector3 } from "three";
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
const _forward = new Vector3();
const _quat = new Quaternion();
const _euler = new Euler(0, 0, 0, "YXZ");

const PROXIMITY_BASE_THRESHOLD = 6;
const AIM_THRESHOLD = 0.85;
const HYSTERESIS_MULTIPLIER = 1.5;

// Space-shooter flight params
const THRUST_SPEED = 0.12;
const ROLL_SPEED = 0.022;
const MOUSE_SENSITIVITY = 0.0018;
const PITCH_LIMIT = Math.PI * 0.45; // ~81°

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
  const { camera, gl, clock } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const activeTweenRef = useRef<gsap.core.Tween | null>(null);
  const activeFlightRef = useRef<string | null>(null);
  const hasEnteredRef = useRef(false);
  const nearestRef = useRef<string | null>(null);

  // Track idle state for auto-rotate
  const isIdle = useIdleState(30_000);

  // Space-shooter state
  const keysRef = useRef<Set<string>>(new Set());
  const yawRef = useRef(0);   // radians, accumulated from mouse X
  const pitchRef = useRef(0); // radians, accumulated from mouse Y
  const rollRef = useRef(0);  // radians, accumulated from A/D
  const pointerLockedRef = useRef(false);

  // Track the fly-to planet and progress for smooth tracking during flight
  const flyingPlanetRef = useRef<string | null>(null);
  const flyProgressRef = useRef(0);

  // --- Pointer lock management ---
  const requestPointerLock = useCallback(() => {
    if (!pointerLockedRef.current) {
      gl.domElement.requestPointerLock();
    }
  }, [gl]);

  useEffect(() => {
    const canvas = gl.domElement;

    const onLockChange = () => {
      pointerLockedRef.current = document.pointerLockElement === canvas;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!pointerLockedRef.current) return;
      if (activePlanetId || flyToPlanetId || isFlyingHome || isEntering) return;

      yawRef.current -= e.movementX * MOUSE_SENSITIVITY;
      pitchRef.current = MathUtils.clamp(
        pitchRef.current - e.movementY * MOUSE_SENSITIVITY,
        -PITCH_LIMIT,
        PITCH_LIMIT,
      );
    };

    document.addEventListener("pointerlockchange", onLockChange);
    canvas.addEventListener("mousemove", onMouseMove);

    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      canvas.removeEventListener("mousemove", onMouseMove);
    };
  }, [gl, activePlanetId, flyToPlanetId, isFlyingHome, isEntering]);

  // Release pointer lock when entering planet view or fly-to
  useEffect(() => {
    if (activePlanetId || flyToPlanetId || isFlyingHome || isEntering) {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    }
  }, [activePlanetId, flyToPlanetId, isFlyingHome, isEntering]);

  // Keyboard event handlers
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d"].includes(key)) {
      keysRef.current.add(key);
    }
    // F toggles mouse-look (pointer lock); Escape is handled by the browser automatically
    if (key === "f" && !activePlanetId && !flyToPlanetId && !isFlyingHome && !isEntering) {
      if (pointerLockedRef.current) {
        document.exitPointerLock();
      } else {
        requestPointerLock();
      }
    }
  }, [activePlanetId, flyToPlanetId, isFlyingHome, isEntering, requestPointerLock]);

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

  // Initialize yaw/pitch from current camera orientation when entering free-flight
  const prevActivePlanetRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    // When we transition from planet view back to free-flight, sync angles
    if (!activePlanetId && prevActivePlanetRef.current) {
      _euler.setFromQuaternion(camera.quaternion, "YXZ");
      yawRef.current = _euler.y;
      pitchRef.current = _euler.x;
      rollRef.current = _euler.z;
    }
    prevActivePlanetRef.current = activePlanetId;
  }, [activePlanetId, camera]);

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
        // Sync angles after entrance
        _euler.setFromQuaternion(camera.quaternion, "YXZ");
        yawRef.current = _euler.y;
        pitchRef.current = _euler.x;
        rollRef.current = _euler.z;
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
      const flightId = `planet:${flyToPlanetId}`;
      if (activeFlightRef.current === flightId) {
        return;
      }

      activeFlightRef.current = flightId;
      flyingPlanetRef.current = flyToPlanetId;
      flyProgressRef.current = 0;
      activeTweenRef.current?.kill();
      controls.enabled = false;

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

          const planet = getPlanetById(flyToPlanetId);
          if (!planet) return;
          const elapsed = clock.getElapsedTime();
          const pos = getPlanetPositionAtTime(planet, elapsed);

          const dist = Math.hypot(pos.x, pos.y, pos.z);
          const safeDist = dist === 0 ? 1 : dist;
          const closeDistance = planet.radius * 3;
          const scale = closeDistance / safeDist;

          const endPos = {
            x: pos.x + pos.x * scale,
            y: pos.y + pos.y * scale + planet.radius * 0.5,
            z: pos.z + pos.z * scale,
          };

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
          // Sync angles when returning home
          _euler.setFromQuaternion(camera.quaternion, "YXZ");
          yawRef.current = _euler.y;
          pitchRef.current = _euler.x;
          rollRef.current = _euler.z;
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

  // useFrame: space-shooter controls in free-flight, orbit controls in planet view
  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const elapsed = clock.getElapsedTime();

    // --- Planet orbit mode (OrbitControls handles everything) ---
    if (activePlanetId) {
      const planet = getPlanetById(activePlanetId);
      if (planet) {
        controls.minDistance = planet.radius * 1.8;
        controls.maxDistance = planet.radius * 8;
      }
      controls.minAzimuthAngle = -Infinity;
      controls.maxAzimuthAngle = Infinity;
      controls.minPolarAngle = 0.1;
      controls.maxPolarAngle = Math.PI - 0.1;
      controls.enablePan = false;

      // Track orbiting planet
      if (activePlanetId !== "about") {
        const planet2 = getPlanetById(activePlanetId);
        if (planet2) {
          const pos = getPlanetPositionAtTime(planet2, elapsed);
          _planetPos.set(pos.x, pos.y, pos.z);
          _offset.copy(camera.position).sub(controls.target);
          controls.target.copy(_planetPos);
          camera.position.copy(_planetPos).add(_offset);
        }
      }

      controls.update();
      return;
    }

    // --- Free-flight: space-shooter controls ---
    if (!flyToPlanetId && !isFlyingHome && !isEntering && controls.enabled) {
      const keys = keysRef.current;
      const hasInput = keys.size > 0;

      // Build camera orientation from yaw + pitch + roll
      _euler.set(pitchRef.current, yawRef.current, rollRef.current, "YXZ");
      _quat.setFromEuler(_euler);
      camera.quaternion.copy(_quat);

      // Thrust: W forward, S backward (along camera look direction)
      if (keys.has("w") || keys.has("s")) {
        camera.getWorldDirection(_forward);
        const thrust = keys.has("w") ? THRUST_SPEED : -THRUST_SPEED;
        camera.position.addScaledVector(_forward, thrust);
      }

      // Roll: A rolls left, D rolls right
      if (keys.has("a")) {
        rollRef.current -= ROLL_SPEED;
      }
      if (keys.has("d")) {
        rollRef.current += ROLL_SPEED;
      }

      // Idle auto-rotate (gentle orbit around Y axis when no input and idle)
      if (isIdle && !hasInput && !pointerLockedRef.current) {
        yawRef.current += 0.0008;
        camera.quaternion.setFromEuler(
          new Euler(pitchRef.current, yawRef.current, rollRef.current, "YXZ"),
        );
      }

      // Proximity detection
      camera.getWorldDirection(_cameraDir);

      let closestId: string | null = null;
      let closestScore = Infinity;

      for (const planet of PLANETS) {
        const pos = getPlanetPositionAtTime(planet, elapsed);
        _toPlanet.set(pos.x, pos.y, pos.z).sub(camera.position);
        const distance = _toPlanet.length();

        const threshold =
          PROXIMITY_BASE_THRESHOLD *
          Math.max(planet.orbitRadius / 10, 0.5) *
          (nearestRef.current === planet.id ? HYSTERESIS_MULTIPLIER : 1);

        if (distance > threshold) continue;

        const dot = _cameraDir.dot(_toPlanet.normalize());
        if (dot < AIM_THRESHOLD) continue;

        const score = distance * (1 - dot);
        if (score < closestScore) {
          closestScore = score;
          closestId = planet.id;
        }
      }

      // Check Sun
      _toPlanet.set(0, 0, 0).sub(camera.position);
      const sunDistance = _toPlanet.length();
      const sunThreshold = 4 * (nearestRef.current === "about" ? HYSTERESIS_MULTIPLIER : 1);
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

      // Keep OrbitControls target in sync with camera position so
      // the planet-orbit transition starts from the right place
      controls.target.copy(camera.position).addScaledVector(_cameraDir, 5);
      controls.update();
    }
  });

  // OrbitControls is used only in planet-orbit view and during GSAP tweens
  // In free-flight, we drive the camera directly and keep controls in sync
  return (
    <OrbitControls
      ref={controlsRef}
      dampingFactor={0.05}
      enableDamping
      enablePan={false}
      maxAzimuthAngle={Infinity}
      maxDistance={60}
      maxPolarAngle={Math.PI - 0.2}
      minAzimuthAngle={-Infinity}
      minDistance={5}
      minPolarAngle={0.2}
    />
  );
}
