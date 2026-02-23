import { OORT_CLOUD } from "../../data/oortCloud";
import { PLANETS } from "../../data/planets";

type MiniSystemMapProps = {
  activePlanetId?: string;
  onSelectPlanet: (planetId: string) => void;
  visitedPlanets: Set<string>;
};

const MAP_SIZE = 260;
const MAP_CENTER = MAP_SIZE / 2;
const ORBIT_SCALE = 3.5;

export function MiniSystemMap({
  activePlanetId,
  onSelectPlanet,
  visitedPlanets,
}: MiniSystemMapProps) {
  const ringMidRadius =
    ((OORT_CLOUD.innerRadius + OORT_CLOUD.outerRadius) / 2) * ORBIT_SCALE;
  const ringWidth =
    (OORT_CLOUD.outerRadius - OORT_CLOUD.innerRadius) * ORBIT_SCALE;

  return (
    <div className="mini-system-map">
      <svg viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}>
        <circle
          cx={MAP_CENTER}
          cy={MAP_CENTER}
          fill="transparent"
          onClick={() => onSelectPlanet("about")}
          r={16}
          style={{ cursor: "pointer" }}
        />
        <circle
          className="mini-system-map__sun"
          cx={MAP_CENTER}
          cy={MAP_CENTER}
          onClick={() => onSelectPlanet("about")}
          r={7}
          style={{ cursor: "pointer" }}
        />

        {PLANETS.filter((planet) => planet.showOrbitLine !== false).map(
          (planet) => (
            <circle
              className="mini-system-map__orbit"
              cx={MAP_CENTER}
              cy={MAP_CENTER}
              key={`orbit-${planet.id}`}
              r={planet.orbitRadius * ORBIT_SCALE}
            />
          ),
        )}

        <circle
          className="mini-system-map__orbit"
          cx={MAP_CENTER}
          cy={MAP_CENTER}
          r={ringMidRadius}
          strokeDasharray="3 3"
          style={{
            opacity: 0.36,
            strokeWidth: Math.max(2.5, ringWidth),
          }}
        />

        {PLANETS.map((planet) => {
          const x =
            MAP_CENTER +
            Math.cos(planet.orbitPhase) * planet.orbitRadius * ORBIT_SCALE;
          const y =
            MAP_CENTER +
            Math.sin(planet.orbitPhase) * planet.orbitRadius * ORBIT_SCALE;
          const isActive = planet.id === activePlanetId;
          const visited = visitedPlanets.has(planet.id);
          const isProject = planet.showOrbitLine === false;
          const bodyRadius = isProject ? (isActive ? 6 : 4) : isActive ? 10 : 7;

          return (
            <g key={planet.id}>
              <circle
                cx={x}
                cy={y}
                fill="transparent"
                onClick={() => onSelectPlanet(planet.id)}
                r={16}
                style={{ cursor: "pointer" }}
              />
              <circle
                className="mini-system-map__planet"
                cx={x}
                cy={y}
                fill={planet.color}
                onClick={() => onSelectPlanet(planet.id)}
                r={bodyRadius}
                stroke={isActive ? "#e8fff3" : "transparent"}
                strokeWidth={isActive ? 2 : 0}
              />
              {visited ? (
                <circle
                  className="mini-system-map__visited"
                  cx={x}
                  cy={y}
                  r={isProject ? 1.7 : 2.2}
                />
              ) : null}
              {planet.moons?.map((moon) => {
                const moonAngle = moon.orbitPhase;
                const moonR = 8;
                const mx = x + Math.cos(moonAngle) * moonR;
                const my = y + Math.sin(moonAngle) * moonR;
                return (
                  <circle
                    key={moon.id}
                    cx={mx}
                    cy={my}
                    r={2}
                    fill={moon.color}
                    opacity={0.6}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
