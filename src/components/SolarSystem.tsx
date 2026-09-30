import { Canvas } from "@react-three/fiber";
import { useCallback, type ReactNode } from "react";
import { Stars } from "@react-three/drei";
import { CAMERA_ENTRANCE } from "../data/cameraPositions";
import { PLANETS } from "../data/planets";
import { RENDER_QUALITY } from "../data/renderQuality";
import type { QualityTier } from "../hooks/useDeviceCapability";
import { usePageVisibility } from "../hooks/usePageVisibility";
import { AmbientParticles } from "./three/AmbientParticles";
import { CameraController } from "./three/CameraController";
import { EncounterSystem } from "./three/EncounterSystem";
import { OrbitLine } from "./three/OrbitLine";
import { OortCloud } from "./three/OortCloud";
import { Planet } from "./three/Planet";
import { PostProcessing } from "./three/PostProcessing";
import { Sun } from "./three/Sun";
import { ScenePerformance } from "./three/ScenePerformance";
import "./SolarSystem.css";

type SolarSystemProps = {
  children?: ReactNode;
  onPlanetSelect?: (planetId: string) => void;
  onDisengagePlanet?: () => void;
  onCrosshairPlanetChange?: (planetId: string | null) => void;
  crosshairPlanetId?: string | null;
  onCrosshairEncounterChange?: (targetLabel: string | null) => void;
  onPointerLockChange?: (locked: boolean) => void;
  showOrbitLines?: boolean;
  encounterEnabled?: boolean;
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
  onPerformanceSample?: (fps: number) => void;
};

export function SolarSystem({
  children,
  onPlanetSelect,
  onDisengagePlanet,
  onCrosshairPlanetChange,
  crosshairPlanetId = null,
  onCrosshairEncounterChange,
  onPointerLockChange,
  showOrbitLines = true,
  encounterEnabled = true,
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
  onPerformanceSample,
}: SolarSystemProps) {
  const visible = usePageVisibility();
  const budget = RENDER_QUALITY[qualityTier];
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
        dpr={[1, budget.maxDpr]}
        frameloop={visible ? "always" : "never"}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        camera={{
          fov: 60,
          near: 0.05,
          far: 500,
          position: CAMERA_ENTRANCE.position,
        }}
        onPointerMissed={handlePointerMissed}
      >
        <color args={["#04060d"]} attach="background" />
        <ambientLight intensity={0.3} />
        <pointLight
          color="#ffe1b0"
          intensity={65}
          decay={1.3}
          position={[0, 0, 0]}
        />
        <Stars
          count={Math.min(starCount, budget.stars)}
          depth={90}
          factor={2.3}
          fade
          radius={180}
          saturation={0}
          speed={0.12}
        />

        <Sun
          isMobile={isMobile}
          qualityTier={qualityTier}
          showLabel={!activePlanetId}
          onSelect={() => handlePlanetSelect("about")}
        />

        {showOrbitLines
          ? PLANETS.filter((planet) => planet.showOrbitLine !== false).map(
              (planet) => (
                <OrbitLine
                  inclination={planet.orbitInclination}
                  key={`orbit-${planet.id}`}
                  radius={planet.orbitRadius}
                />
              ),
            )
          : null}

        {PLANETS.map((planet) => (
          <Planet
            isMobile={isMobile}
            key={planet.id}
            onSelect={handlePlanetSelect}
            planet={planet}
            qualityTier={qualityTier}
            showLabel={!activePlanetId}
            visited={visitedPlanets?.has(planet.id) ?? false}
          />
        ))}

        <OortCloud qualityTier={qualityTier} />

        <EncounterSystem
          enabled={encounterEnabled}
          hasPlanetTarget={crosshairPlanetId !== null}
          isMobile={isMobile}
          onCrosshairTargetChange={onCrosshairEncounterChange}
        />
        {Math.min(particleCount, budget.particles) > 0 ? (
          <AmbientParticles count={Math.min(particleCount, budget.particles)} />
        ) : null}
        <ScenePerformance onSample={onPerformanceSample} />

        <CameraController
          activePlanetId={activePlanetId}
          flyToPlanetId={flyToPlanetId}
          isEntering={isEntering}
          isFlyingHome={isFlyingHome}
          isMobile={isMobile}
          onArriveHome={onArriveHome}
          onArrivePlanet={onArrivePlanet}
          onDisengagePlanet={onDisengagePlanet}
          onEntranceComplete={onEntranceComplete}
          onNearestPlanetChange={onNearestPlanetChange}
          onSelectPlanet={onPlanetSelect}
          onCrosshairPlanetChange={onCrosshairPlanetChange}
          onPointerLockChange={onPointerLockChange}
        />
        <PostProcessing
          reducedQuality={reducedQuality || !budget.bloom}
          qualityTier={qualityTier}
        />
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
