import { audioManager } from "../../audio/AudioManager";
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
  return (
    <CockpitScreen title="NAV SYSTEM" powered>
      <MiniSystemMap
        activePlanetId={activePlanetId}
        onSelectPlanet={onSelectPlanet}
        visitedPlanets={visitedPlanets}
      />

      <div className="nav-screen__list">
        <button
          className={`nav-screen__planet nav-screen__planet--sun ${activePlanetId === "about" ? "is-active" : ""}`}
          onClick={() => { audioManager.playClick(); onSelectPlanet("about"); }}
          type="button"
        >
          <span>About Me</span>
          {visitedPlanets.has("about") ? <small>visited</small> : null}
        </button>
        {PLANETS.map((planet) => (
          <button
            className={`nav-screen__planet ${planet.id === activePlanetId ? "is-active" : ""}`}
            key={planet.id}
            onClick={() => { audioManager.playClick(); onSelectPlanet(planet.id); }}
            type="button"
          >
            <span>{planet.label}</span>
            {visitedPlanets.has(planet.id) ? <small>visited</small> : null}
          </button>
        ))}
      </div>

      {viewType !== "SOLAR_SYSTEM" && onFlyHome ? (
        <button
          className="nav-screen__return"
          onClick={() => { audioManager.playClick(); onFlyHome(); }}
          type="button"
        >
          {"<- Return To Overview"}
        </button>
      ) : null}
    </CockpitScreen>
  );
}
