import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useCallback } from "react";
import { PLANETS } from "../data/planets";
import { OrbitLine } from "./three/OrbitLine";
import { Planet } from "./three/Planet";
import { PostProcessing } from "./three/PostProcessing";
import { Sun } from "./three/Sun";
import "./SolarSystem.css";

type SolarSystemProps = {
  onPlanetSelect?: (planetId: string) => void;
  showOrbitLines?: boolean;
  starCount?: number;
};

export function SolarSystem({
  onPlanetSelect,
  showOrbitLines = true,
  starCount = 5000,
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
      <Canvas camera={{ fov: 60, position: [0, 8, 22] }}>
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

        <OrbitControls
          dampingFactor={0.05}
          enableDamping
          maxDistance={34}
          minDistance={10}
        />
        <PostProcessing />
      </Canvas>

      <div className="solar-system__hint">
        Click a planet to initiate fly-to.
      </div>
    </div>
  );
}
