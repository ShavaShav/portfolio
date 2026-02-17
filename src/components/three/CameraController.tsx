import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CAMERA_DEFAULT } from "../../data/cameraPositions";
import { getPlanetById, getPlanetPositionAtTime } from "../../data/planets";

type CameraControllerProps = {
  flyToPlanetId?: string;
  isFlyingHome?: boolean;
  onArrivePlanet?: (planetId: string) => void;
  onArriveHome?: () => void;
};

export function CameraController({
  flyToPlanetId,
  isFlyingHome = false,
  onArrivePlanet,
  onArriveHome,
}: CameraControllerProps) {
  const { camera, clock } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const activeTweenRef = useRef<gsap.core.Tween | null>(null);
  const activeFlightRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      activeTweenRef.current?.kill();
      activeTweenRef.current = null;
    };
  }, []);

  useFrame(() => {
    controlsRef.current?.update();
  });

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    const startAnimation = (
      id: string,
      toPosition: { x: number; y: number; z: number },
      toTarget: { x: number; y: number; z: number },
      onComplete: () => void,
    ) => {
      if (activeFlightRef.current === id) {
        return;
      }

      activeFlightRef.current = id;

      activeTweenRef.current?.kill();
      activeTweenRef.current = null;

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
        x: toPosition.x,
        y: toPosition.y,
        z: toPosition.z,
        tx: toTarget.x,
        ty: toTarget.y,
        tz: toTarget.z,
        onUpdate: () => {
          camera.position.set(cameraState.x, cameraState.y, cameraState.z);
          controls.target.set(cameraState.tx, cameraState.ty, cameraState.tz);
          controls.update();
        },
        onComplete: () => {
          controls.enabled = true;
          activeTweenRef.current = null;
          onComplete();
        },
      });
    };

    if (flyToPlanetId) {
      const targetPlanet = getPlanetById(flyToPlanetId);
      if (!targetPlanet) {
        controls.enabled = true;
        activeFlightRef.current = null;
        return;
      }

      const elapsed = clock.getElapsedTime();
      const planetPosition = getPlanetPositionAtTime(targetPlanet, elapsed);

      const targetDistance = Math.hypot(
        planetPosition.x,
        planetPosition.y,
        planetPosition.z,
      );

      const safeDistance = targetDistance === 0 ? 1 : targetDistance;
      const offsetScale = 2.5 / safeDistance;

      startAnimation(
        `planet:${flyToPlanetId}`,
        {
          x: planetPosition.x + planetPosition.x * offsetScale,
          y: planetPosition.y + planetPosition.y * offsetScale,
          z: planetPosition.z + planetPosition.z * offsetScale,
        },
        {
          x: planetPosition.x,
          y: planetPosition.y,
          z: planetPosition.z,
        },
        () => {
          onArrivePlanet?.(flyToPlanetId);
        },
      );

      return;
    }

    if (isFlyingHome) {
      startAnimation(
        "home",
        {
          x: CAMERA_DEFAULT.position[0],
          y: CAMERA_DEFAULT.position[1],
          z: CAMERA_DEFAULT.position[2],
        },
        {
          x: CAMERA_DEFAULT.target[0],
          y: CAMERA_DEFAULT.target[1],
          z: CAMERA_DEFAULT.target[2],
        },
        () => {
          onArriveHome?.();
        },
      );

      return;
    }

    activeFlightRef.current = null;
    controls.enabled = true;
  }, [
    camera,
    clock,
    flyToPlanetId,
    isFlyingHome,
    onArriveHome,
    onArrivePlanet,
  ]);

  return (
    <OrbitControls
      ref={controlsRef}
      dampingFactor={0.05}
      enableDamping
      enablePan={false}
      maxAzimuthAngle={0.8}
      maxDistance={28}
      maxPolarAngle={2}
      minAzimuthAngle={-0.8}
      minDistance={15}
      minPolarAngle={0.5}
    />
  );
}
