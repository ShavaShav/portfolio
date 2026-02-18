import { Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";
import { CAMERA_DEFAULT } from "../data/cameraPositions";
import { PLANETS, getPlanetPositionAtTime } from "../data/planets";
import { CameraController } from "./three/CameraController";
import { CompanionOrb } from "./three/CompanionOrb";
import { OrbitLine } from "./three/OrbitLine";
import { Planet } from "./three/Planet";
import { PostProcessing } from "./three/PostProcessing";
import { Sun } from "./three/Sun";
import "./SolarSystem.css";

type SolarSystemProps = {
  activePlanetId?: string;
  onPlanetSelect?: (planetId: string) => void;
  showOrbitLines?: boolean;
  starCount?: number;
  flyToPlanetId?: string;
  isFlyingHome?: boolean;
  onArrivePlanet?: (planetId: string) => void;
  onArriveHome?: () => void;
  showHint?: boolean;
  companionActive?: boolean;
  companionPulsing?: boolean;
  isEntering?: boolean;
  onEntranceComplete?: () => void;
  onNearestPlanetChange?: (planetId: string | null) => void;
};

type NearestPlanetTrackerProps = {
  enabled: boolean;
  onNearestPlanetChange?: (planetId: string | null) => void;
};

function NearestPlanetTracker({
  enabled,
  onNearestPlanetChange,
}: NearestPlanetTrackerProps) {
  const { camera, clock } = useThree();
  const cooldownRef = useRef(0);
  const previousNearestRef = useRef<string | null>(null);

  useFrame((_, delta) => {
    if (!enabled || !onNearestPlanetChange) {
      return;
    }

    cooldownRef.current += delta;
    if (cooldownRef.current < 0.25) {
      return;
    }

    cooldownRef.current = 0;

    const elapsed = clock.getElapsedTime();
    let nearestId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const planet of PLANETS) {
      const position = getPlanetPositionAtTime(planet, elapsed);
      const dx = camera.position.x - position.x;
      const dy = camera.position.y - position.y;
      const dz = camera.position.z - position.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = planet.id;
      }
    }

    if (previousNearestRef.current !== nearestId) {
      previousNearestRef.current = nearestId;
      onNearestPlanetChange(nearestId);
    }
  });

  return null;
}

export function SolarSystem({
  activePlanetId,
  onPlanetSelect,
  showOrbitLines = true,
  starCount = 5000,
  flyToPlanetId,
  isFlyingHome = false,
  onArrivePlanet,
  onArriveHome,
  showHint = true,
  companionActive = false,
  companionPulsing = false,
  isEntering = false,
  onEntranceComplete,
  onNearestPlanetChange,
}: SolarSystemProps) {
  const handlePlanetSelect = useCallback(
    (planetId: string) => {
      if (onPlanetSelect) {
        onPlanetSelect(planetId);
        return;
      }

      console.info(`[SolarSystem] planet selected: ${planetId}`);
    },
    [onPlanetSelect],
  );

  useEffect(() => {
    if (!isEntering || !onEntranceComplete) {
      return;
    }

    const timerId = window.setTimeout(onEntranceComplete, 1400);
    return () => window.clearTimeout(timerId);
  }, [isEntering, onEntranceComplete]);

  return (
    <div className="solar-system">
      <Canvas
        camera={{
          fov: CAMERA_DEFAULT.fov,
          position: CAMERA_DEFAULT.position,
        }}
      >
        <color args={["#04060d"]} attach="background" />
        <ambientLight intensity={0.25} />
        <pointLight color="#ffd28a" intensity={2.2} position={[0, 0, 0]} />
        <Stars
          count={starCount}
          depth={90}
          factor={5}
          fade
          radius={180}
          saturation={0}
          speed={0.45}
        />

        <Sun />

        {showOrbitLines
          ? PLANETS.map((planet) => (
              <OrbitLine
                inclination={planet.orbitInclination}
                key={`orbit-${planet.id}`}
                radius={planet.orbitRadius}
              />
            ))
          : null}

        {PLANETS.map((planet) => (
          <Planet
            key={planet.id}
            onSelect={handlePlanetSelect}
            planet={planet}
          />
        ))}

        <CompanionOrb active={companionActive} pulsing={companionPulsing} />

        <NearestPlanetTracker
          enabled={!activePlanetId}
          onNearestPlanetChange={onNearestPlanetChange}
        />

        <CameraController
          flyToPlanetId={flyToPlanetId}
          isFlyingHome={isFlyingHome}
          onArriveHome={onArriveHome}
          onArrivePlanet={onArrivePlanet}
        />
        <PostProcessing />
      </Canvas>

      {showHint ? (
        <div className="solar-system__hint">
          Click a planet to initiate fly-to.
        </div>
      ) : null}
    </div>
  );
}
