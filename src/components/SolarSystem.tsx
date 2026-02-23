import { Canvas } from "@react-three/fiber";
import { useCallback, type ReactNode } from "react";
import { Stars } from "@react-three/drei";
import { CAMERA_ENTRANCE } from "../data/cameraPositions";
import { PLANETS } from "../data/planets";
import { OORT_CLOUD } from "../data/oortCloud";
import type { QualityTier } from "../hooks/useDeviceCapability";
import { AmbientParticles } from "./three/AmbientParticles";
import { CameraController } from "./three/CameraController";
import { CometSystem } from "./three/CometSystem";
import { OrbitLine } from "./three/OrbitLine";
import { OortCloud } from "./three/OortCloud";
import { Planet } from "./three/Planet";
import { PostProcessing } from "./three/PostProcessing";
import { Sun } from "./three/Sun";
import "./SolarSystem.css";

type SolarSystemProps = {
  children?: ReactNode;
  onPlanetSelect?: (planetId: string) => void;
  onDisengagePlanet?: () => void;
  onCrosshairPlanetChange?: (planetId: string | null) => void;
  onPointerLockChange?: (locked: boolean) => void;
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
  reducedQuality?: boolean;
  particleCount?: number;
  visitedPlanets?: Set<string>;
  isMobile?: boolean;
  qualityTier?: QualityTier;
};

export function SolarSystem({
  children,
  onPlanetSelect,
  onDisengagePlanet,
  onCrosshairPlanetChange,
  onPointerLockChange,
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
  reducedQuality = false,
  particleCount = 200,
  visitedPlanets,
  isMobile = false,
  qualityTier = "high",
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

  // Clicking on empty space while locked onto a planet disengages it
  const handlePointerMissed = useCallback(() => {
    if (activePlanetId && onDisengagePlanet) {
      onDisengagePlanet();
    }
  }, [activePlanetId, onDisengagePlanet]);

  return (
    <div className="solar-system">
      <Canvas
        camera={{
          fov: 60,
          position: CAMERA_ENTRANCE.position,
        }}
        onPointerMissed={handlePointerMissed}
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

        <Sun isMobile={isMobile} onSelect={() => handlePlanetSelect("about")} />

        {showOrbitLines
          ? PLANETS.map((planet) => (
              <OrbitLine
                inclination={planet.orbitInclination}
                key={`orbit-${planet.id}`}
                radius={planet.orbitRadius}
              />
            ))
          : null}
        {showOrbitLines ? (
          <OrbitLine inclination={-0.1} radius={OORT_CLOUD.baseOrbitRadius} />
        ) : null}

        {PLANETS.map((planet) => (
          <Planet
            isMobile={isMobile}
            key={planet.id}
            onSelect={handlePlanetSelect}
            planet={planet}
            qualityTier={qualityTier}
            visited={visitedPlanets?.has(planet.id) ?? false}
          />
        ))}

        <OortCloud
          isMobile={isMobile}
          onSelect={handlePlanetSelect}
          visited={visitedPlanets?.has("open-source") ?? false}
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
          onDisengagePlanet={onDisengagePlanet}
          onEntranceComplete={onEntranceComplete}
          onNearestPlanetChange={onNearestPlanetChange}
          onSelectPlanet={onPlanetSelect}
          onCrosshairPlanetChange={onCrosshairPlanetChange}
          onPointerLockChange={onPointerLockChange}
        />
        <PostProcessing reducedQuality={reducedQuality} />
      </Canvas>

      {showHint ? (
        <div className="solar-system__hint">
          Click a planet to initiate fly-to.
        </div>
      ) : null}

      {children}
    </div>
  );
}
