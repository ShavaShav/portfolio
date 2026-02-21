import { useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useCallback, useEffect, useRef } from "react";
import { Euler, MathUtils, Quaternion, Vector2, Vector3 } from "three";
import { CAMERA_DEFAULT } from "../../data/cameraPositions";
import {
  PLANETS,
  getPlanetById,
  getPlanetPositionAtTime,
} from "../../data/planets";
import { useIdleState } from "../../hooks/useIdleTimer";

type CameraControllerProps = {
  flyToPlanetId?: string;
  isFlyingHome?: boolean;
  isEntering?: boolean;
  activePlanetId?: string;
  onArrivePlanet?: (planetId: string) => void;
  onArriveHome?: () => void;
  onEntranceComplete?: () => void;
  onNearestPlanetChange?: (planetId: string | null) => void;
  onDisengagePlanet?: () => void;
  /** Called when user clicks while pointer-locked with a planet in the crosshair */
  onSelectPlanet?: (planetId: string) => void;
  onCrosshairPlanetChange?: (planetId: string | null) => void;
  onPointerLockChange?: (locked: boolean) => void;
};

// Pre-allocate reusable vectors to avoid GC churn in useFrame
const _cameraDir = new Vector3();
const _toPlanet = new Vector3();
const _planetPos = new Vector3();
const _forward = new Vector3();
const _right = new Vector3();
const _worldUp = new Vector3(0, 1, 0);
const _deltaRot = new Quaternion();
const _pitchAxis = new Vector3();
const _yawAxis = new Vector3(0, 1, 0);
const _euler = new Euler();

const PROXIMITY_BASE_THRESHOLD = 6;
const AIM_THRESHOLD = 0.85;
const HYSTERESIS_MULTIPLIER = 1.5;

// dot-product threshold for crosshair aim (higher = tighter cone, ~2° at 0.9994)
const CROSSHAIR_AIM_THRESHOLD = 0.994;

// 6DoF flight tuning
const THRUST_SPEED = 0.12;
const STRAFE_SPEED = 0.10;
const VERTICAL_SPEED = 0.10;
const ROLL_SPEED = 0.025;
const MOUSE_SENSITIVITY = 0.0018;
const PITCH_LIMIT = Math.PI * 0.48; // ~86 degrees

export function CameraController({
  flyToPlanetId,
  isFlyingHome = false,
  isEntering = false,
  activePlanetId,
  onArrivePlanet,
  onArriveHome,
  onEntranceComplete,
  onNearestPlanetChange,
  onDisengagePlanet,
  onSelectPlanet,
  onCrosshairPlanetChange,
  onPointerLockChange,
}: CameraControllerProps) {
  const { camera, gl, clock } = useThree();

  const activeTweenRef = useRef<gsap.core.Tween | null>(null);
  const activeFlightRef = useRef<string | null>(null);
  const hasEnteredRef = useRef(false);
  const nearestRef = useRef<string | null>(null);

  // Track idle state for auto-rotate
  const isIdle = useIdleState(30_000);

  // Track which keys are currently held
  const keysRef = useRef<Set<string>>(new Set());

  // Mouse look state
  const isPointerLockedRef = useRef(false);
  const mouseDeltaRef = useRef<Vector2>(new Vector2());

  // Accumulated pitch to enforce limits
  const pitchRef = useRef(0);

  // Whether flight controls are active (not in tween / locked state)
  const flightActiveRef = useRef(true);

  // Track the fly-to planet progress for smooth tracking during flight
  const flyingPlanetRef = useRef<string | null>(null);

  // Planet position at last frame — used to compute per-frame delta while locked on
  const prevPlanetPosRef = useRef<Vector3>(new Vector3());
  // Whether we've captured the initial planet position for the current lock-on
  const offsetCapturedRef = useRef(false);

  // Planet currently centered in the crosshair (pointer-locked free-flight)
  const crosshairPlanetRef = useRef<string | null>(null);

  // Stable refs to callbacks so pointer-lock event handlers don't go stale
  const onPlanetSelectRef = useRef<((id: string) => void) | null>(null);
  const onPointerLockChangeRef = useRef<((locked: boolean) => void) | null>(null);
  useEffect(() => {
    onPlanetSelectRef.current = onSelectPlanet ?? null;
    onPointerLockChangeRef.current = onPointerLockChange ?? null;
  });

  // ── Pointer lock ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = gl.domElement;

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      isPointerLockedRef.current = locked;
      onPointerLockChangeRef.current?.(locked);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isPointerLockedRef.current) return;
      mouseDeltaRef.current.x += e.movementX;
      mouseDeltaRef.current.y += e.movementY;
    };

    // Click: acquire pointer lock, or if already locked, lock on to crosshair planet
    const onCanvasClick = () => {
      if (!isPointerLockedRef.current) {
        if (flightActiveRef.current) canvas.requestPointerLock();
      } else {
        // Already pointer-locked → lock on to whatever is in crosshair
        const id = crosshairPlanetRef.current;
        if (id && onPlanetSelectRef.current) {
          onPlanetSelectRef.current(id);
        }
      }
    };

    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onCanvasClick);

    return () => {
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onCanvasClick);
    };
  }, [gl.domElement]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      // Ignore if typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const flightKeys = new Set([
        "w", "s", "a", "d", "q", "e",
        "shift", "control", " ", "c",
        "arrowup", "arrowdown", "arrowleft", "arrowright",
      ]);

      if (flightKeys.has(key)) {
        event.preventDefault();
        keysRef.current.add(key);

        // Disengage from planet when user hits any flight key
        if (activePlanetId && onDisengagePlanet) {
          onDisengagePlanet();
        }
      }
    },
    [activePlanetId, onDisengagePlanet],
  );

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    keysRef.current.delete(event.key.toLowerCase());
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Kill tweens on unmount
  useEffect(() => {
    return () => {
      activeTweenRef.current?.kill();
      activeTweenRef.current = null;
    };
  }, []);

  // ── Entrance animation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEntering || hasEnteredRef.current) return;

    hasEnteredRef.current = true;
    flightActiveRef.current = false;

    camera.lookAt(0, 0, 0);

    const cameraState = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    };

    activeTweenRef.current = gsap.to(cameraState, {
      duration: 3.0,
      ease: "power2.out",
      x: CAMERA_DEFAULT.position[0],
      y: CAMERA_DEFAULT.position[1],
      z: CAMERA_DEFAULT.position[2],
      onUpdate: () => {
        camera.position.set(cameraState.x, cameraState.y, cameraState.z);
        camera.lookAt(0, 0, 0);
      },
      onComplete: () => {
        activeTweenRef.current = null;
        flightActiveRef.current = true;
        // Reset pitch tracking to match post-lookAt orientation
        _euler.setFromQuaternion(camera.quaternion, "YXZ");
        pitchRef.current = _euler.x;
        onEntranceComplete?.();
      },
    });
  }, [isEntering, camera, onEntranceComplete]);

  // ── Fly-to-planet / fly-home animations ───────────────────────────────────
  useEffect(() => {
    if (isEntering && !hasEnteredRef.current) return;

    if (flyToPlanetId) {
      if (flyToPlanetId === "about") {
        if (activeFlightRef.current === "planet:about") return;
        activeFlightRef.current = "planet:about";
        flyingPlanetRef.current = null;
        activeTweenRef.current?.kill();
        flightActiveRef.current = false;

        const cameraState = {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
        };
        const targetPos = { x: 0, y: 2, z: 5 };

        activeTweenRef.current = gsap.to(cameraState, {
          duration: 1.5,
          ease: "power2.inOut",
          x: targetPos.x,
          y: targetPos.y,
          z: targetPos.z,
          onUpdate: () => {
            camera.position.set(cameraState.x, cameraState.y, cameraState.z);
            camera.lookAt(0, 0, 0);
          },
          onComplete: () => {
            activeTweenRef.current = null;
            flightActiveRef.current = true;
            _euler.setFromQuaternion(camera.quaternion, "YXZ");
            pitchRef.current = _euler.x;
            flyingPlanetRef.current = null;
            onArrivePlanet?.("about");
          },
        });
        return;
      }

      // Flying to an orbiting planet
      const flightId = `planet:${flyToPlanetId}`;
      if (activeFlightRef.current === flightId) return;

      activeFlightRef.current = flightId;
      flyingPlanetRef.current = flyToPlanetId;
      activeTweenRef.current?.kill();
      flightActiveRef.current = false;

      const startPos = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      };

      const progressObj = { t: 0 };

      activeTweenRef.current = gsap.to(progressObj, {
        duration: 1.5,
        ease: "power2.inOut",
        t: 1,
        onUpdate: () => {
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
          camera.lookAt(pos.x, pos.y, pos.z);
        },
        onComplete: () => {
          activeTweenRef.current = null;
          flightActiveRef.current = true;
          _euler.setFromQuaternion(camera.quaternion, "YXZ");
          pitchRef.current = _euler.x;
          flyingPlanetRef.current = null;
          onArrivePlanet?.(flyToPlanetId);
        },
      });
      return;
    }

    if (isFlyingHome) {
      if (activeFlightRef.current === "home") return;
      activeFlightRef.current = "home";
      flyingPlanetRef.current = null;
      activeTweenRef.current?.kill();
      flightActiveRef.current = false;

      const cameraState = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      };

      activeTweenRef.current = gsap.to(cameraState, {
        duration: 1.5,
        ease: "power2.inOut",
        x: CAMERA_DEFAULT.position[0],
        y: CAMERA_DEFAULT.position[1],
        z: CAMERA_DEFAULT.position[2],
        onUpdate: () => {
          camera.position.set(cameraState.x, cameraState.y, cameraState.z);
          camera.lookAt(0, 0, 0);
        },
        onComplete: () => {
          activeTweenRef.current = null;
          flightActiveRef.current = true;
          _euler.setFromQuaternion(camera.quaternion, "YXZ");
          pitchRef.current = _euler.x;
          onArriveHome?.();
        },
      });
      return;
    }

    activeFlightRef.current = null;
    flightActiveRef.current = true;
  }, [
    camera,
    clock,
    flyToPlanetId,
    isEntering,
    isFlyingHome,
    onArriveHome,
    onArrivePlanet,
  ]);

  // ── Per-frame: 6DoF flight, planet tracking, proximity detection ──────────
  useFrame((_state, delta) => {
    const elapsed = clock.getElapsedTime();
    const dt = Math.min(delta, 0.05); // cap to avoid huge jumps

    // --- Planet tracking: move with the planet as it orbits, maintain offset ---
    if (activePlanetId && activePlanetId !== "about") {
      const planet = getPlanetById(activePlanetId);
      if (planet) {
        const pos = getPlanetPositionAtTime(planet, elapsed);
        _planetPos.set(pos.x, pos.y, pos.z);

        if (!offsetCapturedRef.current) {
          // Record the planet's initial position so we can track its delta each frame
          prevPlanetPosRef.current.copy(_planetPos);
          offsetCapturedRef.current = true;
        } else {
          // Move camera by how much the planet moved this frame
          _forward.copy(_planetPos).sub(prevPlanetPosRef.current);
          camera.position.add(_forward);
          prevPlanetPosRef.current.copy(_planetPos);
        }

        // Always face the planet
        camera.lookAt(_planetPos);
      }
    } else {
      // Reset offset tracking when not locked on
      offsetCapturedRef.current = false;
    }

    // --- 6DoF flight controls (active during free-flight only) ---
    if (
      flightActiveRef.current &&
      !activePlanetId &&
      !flyToPlanetId &&
      !isFlyingHome &&
      !isEntering
    ) {
      const keys = keysRef.current;

      // Mouse look (pointer-locked)
      if (isPointerLockedRef.current) {
        const dx = mouseDeltaRef.current.x * MOUSE_SENSITIVITY;
        const dy = mouseDeltaRef.current.y * MOUSE_SENSITIVITY;
        mouseDeltaRef.current.set(0, 0);

        if (dx !== 0 || dy !== 0) {
          // Yaw: rotate around world Y
          _deltaRot.setFromAxisAngle(_yawAxis, -dx);
          camera.quaternion.premultiply(_deltaRot);

          // Pitch: rotate around camera local X, clamped
          const newPitch = MathUtils.clamp(
            pitchRef.current - dy,
            -PITCH_LIMIT,
            PITCH_LIMIT,
          );
          const pitchDelta = newPitch - pitchRef.current;
          pitchRef.current = newPitch;

          _pitchAxis.set(1, 0, 0).applyQuaternion(camera.quaternion);
          _deltaRot.setFromAxisAngle(_pitchAxis, pitchDelta);
          camera.quaternion.premultiply(_deltaRot);
        }
      }

      // Thrust / strafe / vertical
      camera.getWorldDirection(_forward);
      _right.crossVectors(_forward, _worldUp).normalize();

      if (keys.has("w") || keys.has("arrowup")) {
        camera.position.addScaledVector(_forward, THRUST_SPEED * dt * 60);
      }
      if (keys.has("s") || keys.has("arrowdown")) {
        camera.position.addScaledVector(_forward, -THRUST_SPEED * dt * 60);
      }
      if (keys.has("a") || keys.has("arrowleft")) {
        camera.position.addScaledVector(_right, -STRAFE_SPEED * dt * 60);
      }
      if (keys.has("d") || keys.has("arrowright")) {
        camera.position.addScaledVector(_right, STRAFE_SPEED * dt * 60);
      }

      // Vertical: Shift = up, Ctrl = down; also Space = up, C = down
      if (keys.has("shift") || keys.has(" ")) {
        camera.position.y += VERTICAL_SPEED * dt * 60;
      }
      if (keys.has("control") || keys.has("c")) {
        camera.position.y -= VERTICAL_SPEED * dt * 60;
      }

      // Roll: Q = roll left, E = roll right
      if (keys.has("q")) {
        _forward.copy(camera.getWorldDirection(_forward));
        _deltaRot.setFromAxisAngle(_forward, ROLL_SPEED * dt * 60);
        camera.quaternion.premultiply(_deltaRot);
      }
      if (keys.has("e")) {
        _forward.copy(camera.getWorldDirection(_forward));
        _deltaRot.setFromAxisAngle(_forward, -ROLL_SPEED * dt * 60);
        camera.quaternion.premultiply(_deltaRot);
      }

      // Crosshair planet detection (only when pointer-locked so aim matters)
      if (isPointerLockedRef.current) {
        camera.getWorldDirection(_cameraDir);
        let crosshairId: string | null = null;
        let bestDot = CROSSHAIR_AIM_THRESHOLD;

        for (const planet of PLANETS) {
          const pos = getPlanetPositionAtTime(planet, elapsed);
          _toPlanet.set(pos.x, pos.y, pos.z).sub(camera.position).normalize();
          const dot = _cameraDir.dot(_toPlanet);
          if (dot > bestDot) {
            bestDot = dot;
            crosshairId = planet.id;
          }
        }
        // Check Sun too
        _toPlanet.set(0, 0, 0).sub(camera.position).normalize();
        const sunDot = _cameraDir.dot(_toPlanet);
        if (sunDot > bestDot) {
          crosshairId = "about";
        }

        if (crosshairId !== crosshairPlanetRef.current) {
          crosshairPlanetRef.current = crosshairId;
          onCrosshairPlanetChange?.(crosshairId);
        }
      } else if (crosshairPlanetRef.current !== null) {
        crosshairPlanetRef.current = null;
        onCrosshairPlanetChange?.(null);
      }
    }

    // --- Idle auto-rotate (solar system free-flight only, no pointer lock) ---
    if (
      isIdle &&
      !activePlanetId &&
      !flyToPlanetId &&
      !isFlyingHome &&
      !isEntering &&
      flightActiveRef.current &&
      !isPointerLockedRef.current
    ) {
      // Slowly orbit around origin
      const angle = 0.0008;
      const cx = camera.position.x;
      const cz = camera.position.z;
      camera.position.x = cx * Math.cos(angle) - cz * Math.sin(angle);
      camera.position.z = cx * Math.sin(angle) + cz * Math.cos(angle);
      camera.lookAt(0, 0, 0);
    }

    // --- Proximity detection (SOLAR_SYSTEM state only) ---
    if (!flyToPlanetId && !isFlyingHome && !activePlanetId && !isEntering) {
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

      // Also check the Sun at origin
      _toPlanet.set(0, 0, 0).sub(camera.position);
      const sunDistance = _toPlanet.length();
      const sunThreshold =
        4 * (nearestRef.current === "about" ? HYSTERESIS_MULTIPLIER : 1);
      if (sunDistance <= sunThreshold) {
        const dot = _cameraDir.dot(_toPlanet.normalize());
        if (dot >= AIM_THRESHOLD) {
          const score = sunDistance * (1 - dot);
          if (score < closestScore) {
            closestId = "about";
          }
        }
      }

      if (closestId !== nearestRef.current) {
        nearestRef.current = closestId;
        onNearestPlanetChange?.(closestId);
      }
    }
  });

  // No JSX needed - this is a pure logic component
  return null;
}
