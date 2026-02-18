import { Canvas } from "@react-three/fiber";
import { useCallback } from "react";
import { Stars } from "@react-three/drei";
import { CAMERA_ENTRANCE } from "../data/cameraPositions";
import { PLANETS } from "../data/planets";
import { CameraController } from "./three/CameraController";
import { OrbitLine } from "./three/OrbitLine";
import { Planet } from "./three/Planet";
import { PostProcessing } from "./three/PostProcessing";
import { Sun } from "./three/Sun";
import "./SolarSystem.css";

type SolarSystemProps = {
  onPlanetSelect?: (planetId: string) => void;
  showOrbitLines?: boolean;
  starCount?: number;
  flyToPlanetId?: string;
  isFlyingHome?: boolean;
  isEntering?: boolean;
  activePlanetId?: string;
  onArrivePlanet?: (planetId: string) => void;
  onArriveHome?: () => void;
  onEntranceComplete?: () => void;
  onNearestPlanetChange?: (planetId: string | null) => void;
  showHint?: boolean;
};

export function SolarSystem({
  onPlanetSelect,
  showOrbitLines = true,
  starCount = 5000,
  flyToPlanetId,
  isFlyingHome = false,
  isEntering = false,
  activePlanetId,
  onArrivePlanet,
  onArriveHome,
  onEntranceComplete,
  onNearestPlanetChange,
  showHint = true,
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

  return (
    <div className="solar-system">
      <Canvas
        camera={{
          fov: 60,
          position: CAMERA_ENTRANCE.position,
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

        <Sun onSelect={() => handlePlanetSelect("about")} />

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

        <CameraController
          activePlanetId={activePlanetId}
          flyToPlanetId={flyToPlanetId}
          isEntering={isEntering}
          isFlyingHome={isFlyingHome}
          onArriveHome={onArriveHome}
          onArrivePlanet={onArrivePlanet}
          onEntranceComplete={onEntranceComplete}
          onNearestPlanetChange={onNearestPlanetChange}
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
