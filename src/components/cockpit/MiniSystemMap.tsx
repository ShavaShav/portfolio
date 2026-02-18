import { PLANETS } from "../../data/planets";

type MiniSystemMapProps = {
  activePlanetId?: string;
  onSelectPlanet: (planetId: string) => void;
  visitedPlanets: Set<string>;
};

const MAP_SIZE = 220;
const MAP_CENTER = MAP_SIZE / 2;
const ORBIT_SCALE = 4;

export function MiniSystemMap({
  activePlanetId,
  onSelectPlanet,
  visitedPlanets,
}: MiniSystemMapProps) {
  return (
    <div className="mini-system-map">
      <svg viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}>
        <circle
          className="mini-system-map__sun"
          cx={MAP_CENTER}
          cy={MAP_CENTER}
          onClick={() => onSelectPlanet("about")}
          r={5}
          style={{ cursor: "pointer" }}
        />

        {PLANETS.map((planet) => (
          <circle
            className="mini-system-map__orbit"
            cx={MAP_CENTER}
            cy={MAP_CENTER}
            key={`orbit-${planet.id}`}
            r={planet.orbitRadius * ORBIT_SCALE}
          />
        ))}

        {PLANETS.map((planet) => {
          const x =
            MAP_CENTER +
            Math.cos(planet.orbitPhase) * planet.orbitRadius * ORBIT_SCALE;
          const y =
            MAP_CENTER +
            Math.sin(planet.orbitPhase) * planet.orbitRadius * ORBIT_SCALE;
          const isActive = planet.id === activePlanetId;
          const visited = visitedPlanets.has(planet.id);

          return (
            <g key={planet.id}>
              <circle
                className="mini-system-map__planet"
                cx={x}
                cy={y}
                fill={planet.color}
                onClick={() => onSelectPlanet(planet.id)}
                r={isActive ? 6 : 4}
                stroke={isActive ? "#e8fff3" : "transparent"}
                strokeWidth={isActive ? 2 : 0}
              />
              {visited ? (
                <circle
                  className="mini-system-map__visited"
                  cx={x}
                  cy={y}
                  r={1.6}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
