import { useEffect, useState, type CSSProperties } from "react";
import { audioManager } from "../../audio/AudioManager";
import { OORT_PROJECTS } from "../../data/oortCloud";
import { PLANETS } from "../../data/planets";
import type { AppView } from "../../state/AppState";
import { CockpitScreen } from "./CockpitScreen";
import { MiniSystemMap } from "./MiniSystemMap";

type NavScreenProps = {
  viewType: AppView["type"];
  activePlanetId?: string;
  onSelectPlanet: (planetId: string) => void;
  onFlyHome?: () => void;
  visitedPlanets: Set<string>;
};

export function NavScreen({
  viewType,
  activePlanetId,
  onSelectPlanet,
  onFlyHome,
  visitedPlanets,
}: NavScreenProps) {
  const corePlanets = PLANETS.filter(
    (planet) => planet.showOrbitLine !== false,
  );
  const hasOpenSourceActive = OORT_PROJECTS.some(
    (project) => project.id === activePlanetId,
  );
  const openSourceVisitedCount = OORT_PROJECTS.reduce(
    (count, project) => count + (visitedPlanets.has(project.id) ? 1 : 0),
    0,
  );
  const [openSourceExpanded, setOpenSourceExpanded] =
    useState(hasOpenSourceActive);

  useEffect(() => {
    if (hasOpenSourceActive) {
      setOpenSourceExpanded(true);
    }
  }, [hasOpenSourceActive]);

  return (
    <CockpitScreen className="nav-screen" powered>
      <div className="nav-screen__heading">
        <span>CHOOSE A DESTINATION</span>
        <small>01 — 05</small>
      </div>
      <MiniSystemMap
        activePlanetId={activePlanetId}
        onSelectPlanet={onSelectPlanet}
        visitedPlanets={visitedPlanets}
      />

      <div className="nav-screen__list">
        <button
          className={`nav-screen__planet nav-screen__planet--sun ${activePlanetId === "about" ? "is-active" : ""}`}
          onClick={() => {
            audioManager.playClick();
            onSelectPlanet("about");
          }}
          type="button"
        >
          <span className="nav-screen__destination">
            <i style={{ background: "#e9bc7b" }} />
            <span>
              About Me<small>The person behind the work</small>
            </span>
          </span>
          {visitedPlanets.has("about") ? <small>visited</small> : null}
        </button>
        {corePlanets.map((planet) => (
          <button
            className={`nav-screen__planet ${planet.id === activePlanetId ? "is-active" : ""}`}
            key={planet.id}
            style={{ "--destination-color": planet.color } as CSSProperties}
            aria-pressed={planet.id === activePlanetId}
            onClick={() => {
              audioManager.playClick();
              onSelectPlanet(planet.id);
            }}
            type="button"
          >
            <span className="nav-screen__destination">
              <i style={{ background: planet.color }} />
              <span>
                {planet.label}
                <small>{planet.subtitle}</small>
              </span>
            </span>
            {visitedPlanets.has(planet.id) ? <small>visited</small> : null}
          </button>
        ))}
        <details
          className={`nav-screen__group ${openSourceExpanded ? "is-expanded" : ""}`}
          open={openSourceExpanded}
        >
          <summary
            className={`nav-screen__group-toggle ${hasOpenSourceActive ? "is-active" : ""}`}
            onClick={(event) => {
              event.preventDefault();
              audioManager.playClick();
              setOpenSourceExpanded((expanded) => !expanded);
            }}
          >
            <span>Oort Cloud - Open Source</span>
            <small>
              {openSourceVisitedCount}/{OORT_PROJECTS.length} visited
            </small>
          </summary>
          <div className="nav-screen__group-items">
            {OORT_PROJECTS.map((project) => (
              <button
                className={`nav-screen__planet nav-screen__planet--sub ${project.id === activePlanetId ? "is-active" : ""}`}
                key={project.id}
                onClick={() => {
                  audioManager.playClick();
                  onSelectPlanet(project.id);
                }}
                type="button"
              >
                <span>{project.label}</span>
                {visitedPlanets.has(project.id) ? <small>visited</small> : null}
              </button>
            ))}
          </div>
        </details>
      </div>

      {viewType !== "SOLAR_SYSTEM" && onFlyHome ? (
        <button
          className="nav-screen__return"
          onClick={() => {
            audioManager.playClick();
            onFlyHome();
          }}
          type="button"
        >
          {"<- Return To Overview"}
        </button>
      ) : null}
    </CockpitScreen>
  );
}
