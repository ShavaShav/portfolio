import { Canvas } from "@react-three/fiber";
import { useCallback } from "react";
import { Stars } from "@react-three/drei";
import { CAMERA_ENTRANCE } from "../data/cameraPositions";
import { PLANETS } from "../data/planets";
import { AmbientParticles } from "./three/AmbientParticles";
import { CameraController } from "./three/CameraController";
import { CometSystem } from "./three/CometSystem";
import { CompanionOrb } from "./three/CompanionOrb";
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
  onLeaveOrbit?: () => void;
  onEntranceComplete?: () => void;
  onNearestPlanetChange?: (planetId: string | null) => void;
  showHint?: boolean;
  showFlightHUD?: boolean;
  companionActive?: boolean;
  companionResponding?: boolean;
  reducedQuality?: boolean;
  particleCount?: number;
  visitedPlanets?: Set<string>;
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
  onLeaveOrbit,
  onEntranceComplete,
  onNearestPlanetChange,
  showHint = true,
  showFlightHUD = false,
  companionActive = false,
  companionResponding = false,
  reducedQuality = false,
  particleCount = 200,
  visitedPlanets,
}: SolarSystemProps) {
  const isFreeFlight = showFlightHUD && !activePlanetId && !flyToPlanetId && !isFlyingHome && !isEntering;

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
            visited={visitedPlanets?.has(planet.id) ?? false}
          />
        ))}

        <CompanionOrb
          active={companionActive}
          isResponding={companionResponding}
        />

        <CometSystem />
        <AmbientParticles count={particleCount} />

        <CameraController
          activePlanetId={activePlanetId}
          flyToPlanetId={flyToPlanetId}
          isEntering={isEntering}
          isFlyingHome={isFlyingHome}
          onArriveHome={onArriveHome}
          onArrivePlanet={onArrivePlanet}
          onLeaveOrbit={onLeaveOrbit}
          onEntranceComplete={onEntranceComplete}
          onNearestPlanetChange={onNearestPlanetChange}
        />
        <PostProcessing reducedQuality={reducedQuality} />
      </Canvas>

      {showHint ? (
        <div className="solar-system__hint">
          Click a planet to initiate fly-to.
        </div>
      ) : null}

      {/* Crosshair: shown in free-flight mode */}
      {isFreeFlight ? (
        <div className="solar-system__crosshair" aria-hidden="true">
          <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="5" stroke="#00ff88" strokeWidth="1" />
            <line x1="14" y1="0" x2="14" y2="8" stroke="#00ff88" strokeWidth="1" />
            <line x1="14" y1="20" x2="14" y2="28" stroke="#00ff88" strokeWidth="1" />
            <line x1="0" y1="14" x2="8" y2="14" stroke="#00ff88" strokeWidth="1" />
            <line x1="20" y1="14" x2="28" y2="14" stroke="#00ff88" strokeWidth="1" />
          </svg>
        </div>
      ) : null}

      {/* Pointer-lock hint: shown in free-flight before user clicks */}
      {isFreeFlight ? (
        <div className="solar-system__lock-hint" aria-hidden="true">
          F = MOUSE AIM · W/S = THRUST · A/D = ROLL · CLICK = FLY TO PLANET
        </div>
      ) : null}
    </div>
  );
}
