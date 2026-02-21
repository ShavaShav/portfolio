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
  const isOortActive = activePlanetId === "open-source";

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

        {PLANETS.map((planet) => (
          <circle
            className="mini-system-map__orbit"
            cx={MAP_CENTER}
            cy={MAP_CENTER}
            key={`orbit-${planet.id}`}
            r={planet.orbitRadius * ORBIT_SCALE}
          />
        ))}

        <circle
          className="mini-system-map__orbit"
          cx={MAP_CENTER}
          cy={MAP_CENTER}
          r={OORT_CLOUD.baseOrbitRadius * ORBIT_SCALE}
          strokeDasharray="4 3"
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
                r={isActive ? 10 : 7}
                stroke={isActive ? "#e8fff3" : "transparent"}
                strokeWidth={isActive ? 2 : 0}
              />
              {visited ? (
                <circle
                  className="mini-system-map__visited"
                  cx={x}
                  cy={y}
                  r={2.2}
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

        <g onClick={() => onSelectPlanet("open-source")} style={{ cursor: "pointer" }}>
          {[0, 0.4, 0.8, 1.2, 1.6].map((offset, i) => {
            const angle = 5.5 + offset * 0.3;
            const r = OORT_CLOUD.baseOrbitRadius * ORBIT_SCALE;
            const dotX = MAP_CENTER + Math.cos(angle) * r;
            const dotY = MAP_CENTER + Math.sin(angle) * r;
            return (
              <circle
                key={`oort-${i}`}
                cx={dotX}
                cy={dotY}
                fill={OORT_CLOUD.color}
                opacity={isOortActive ? 1 : 0.6}
                r={i === 2 ? (isOortActive ? 8 : 5) : 3}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
