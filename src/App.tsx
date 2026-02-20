import { useEffect, useState } from "react";
import "./App.css";
import { audioManager } from "./audio/AudioManager";
import { Mission } from "./components/Mission";
import { PlanetDetail } from "./components/PlanetDetail";
import { SolarSystem } from "./components/SolarSystem";
import { Terminal } from "./components/Terminal";
import { CompanionScreen } from "./components/cockpit/CompanionScreen";
import { CockpitLayout } from "./components/cockpit/CockpitLayout";
import { DataScreen } from "./components/cockpit/DataScreen";
import { NavScreen } from "./components/cockpit/NavScreen";
import { StatusBar } from "./components/cockpit/StatusBar";
import { getMissionForPlanet } from "./data/missions";
import { getPlanetContent } from "./data/planetContent";
import { PLANETS, getPlanetById } from "./data/planets";
import { AppProvider, useAppContext } from "./state/AppState";

function renderDataContent(
  state: ReturnType<typeof useAppContext>["state"],
  dispatch: ReturnType<typeof useAppContext>["dispatch"],
) {
  switch (state.view.type) {
    case "SOLAR_SYSTEM": {
      // If proximity detection found a nearby planet, show preview
      if (state.nearestPlanetId) {
        const nearestPlanet = getPlanetById(state.nearestPlanetId);
        const nearestContent = getPlanetContent(state.nearestPlanetId);
        return {
          title: `SCANNING: ${nearestPlanet?.label.toUpperCase() ?? "UNKNOWN"}`,
          content: (
            <div className="system-overview proximity-preview">
              <p>{nearestContent?.summary ?? "Approaching target..."}</p>
              <button
                onClick={() =>
                  dispatch({
                    type: "FLY_TO_PLANET",
                    planetId: state.nearestPlanetId!,
                  })
                }
                type="button"
              >
                Engage approach vector
              </button>
            </div>
          ),
        };
      }

      return {
        title: "SYSTEM OVERVIEW",
        content: (
          <div className="system-overview">
            <p>
              Select a destination from the viewport or navigation map to
              inspect chapter details.
            </p>
            <ul>
              <li key="about">
                <button
                  onClick={() =>
                    dispatch({ type: "FLY_TO_PLANET", planetId: "about" })
                  }
                  type="button"
                >
                  About Me - The Sun
                </button>
              </li>
              {PLANETS.map((planet) => (
                <li key={planet.id}>
                  <button
                    onClick={() =>
                      dispatch({ type: "FLY_TO_PLANET", planetId: planet.id })
                    }
                    type="button"
                  >
                    {planet.label} - {planet.subtitle}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ),
      };
    }
    case "FLYING_TO_PLANET": {
      return {
        title: "APPROACH",
        content: <p>Approaching {state.view.planetId}...</p>,
      };
    }
    case "PLANET_DETAIL": {
      const planetId = state.view.planetId;
      const mission = getMissionForPlanet(planetId);
      return {
        title: "PLANET DATA",
        content: (
          <PlanetDetail
            onStartMission={() =>
              dispatch({
                type: "ENTER_MISSION",
                missionId: mission?.id ?? `${planetId}-mission`,
                planetId,
              })
            }
            planetId={planetId}
          />
        ),
      };
    }
    case "MISSION": {
      return {
        title: "MISSION CONTROL",
        content: (
          <Mission
            missionId={state.view.missionId}
            onExit={() => dispatch({ type: "EXIT_MISSION" })}
            planetId={state.view.planetId}
          />
        ),
      };
    }
    case "FLYING_HOME": {
      return {
        title: "RETURN VECTOR",
        content: <p>Returning to system overview...</p>,
      };
    }
    default: {
      return {
        title: "DATA",
        content: null,
      };
    }
  }
}

function CockpitExperience() {
  const { state, dispatch } = useAppContext();
  const [isEntering, setIsEntering] = useState(true);

  // Play whoosh when a fly-to starts
  useEffect(() => {
    if (state.view.type === "FLYING_TO_PLANET" || state.view.type === "FLYING_HOME") {
      audioManager.playTransition();
    }
  }, [state.view.type]);

  const activePlanetId =
    state.view.type === "PLANET_DETAIL" || state.view.type === "MISSION"
      ? state.view.planetId
      : undefined;

  const flyingToPlanetId =
    state.view.type === "FLYING_TO_PLANET"
      ? state.view.planetId
      : undefined;

  // For NavScreen highlighting: show active planet, or nearest detected planet
  const highlightedPlanetId =
    flyingToPlanetId ?? activePlanetId ?? state.nearestPlanetId ?? undefined;

  const dataScreen = renderDataContent(state, dispatch);
  const companionMode =
    state.view.type === "MISSION"
      ? "copilot"
      : state.view.type === "PLANET_DETAIL"
        ? "active"
        : "standby";

  return (
    <CockpitLayout
      audioEnabled={state.audioEnabled}
      canvas={
        <SolarSystem
          activePlanetId={activePlanetId}
          flyToPlanetId={flyingToPlanetId}
          isEntering={isEntering}
          isFlyingHome={state.view.type === "FLYING_HOME"}
          onArriveHome={() => dispatch({ type: "ARRIVE_HOME" })}
          onArrivePlanet={(planetId) =>
            dispatch({ type: "ARRIVE_AT_PLANET", planetId })
          }
          onEntranceComplete={() => setIsEntering(false)}
          onNearestPlanetChange={(planetId) =>
            dispatch({ type: "SET_NEAREST_PLANET", planetId })
          }
          onPlanetSelect={(planetId) => {
            if (isEntering) {
              return;
            }
            if (
              state.view.type === "FLYING_TO_PLANET" ||
              state.view.type === "FLYING_HOME"
            ) {
              return;
            }

            audioManager.playClick();
            dispatch({ type: "FLY_TO_PLANET", planetId });
          }}
          companionActive={companionMode !== "standby"}
          showHint={false}
          showOrbitLines={state.view.type === "SOLAR_SYSTEM"}
        />
      }
      onToggleAudio={() => {
          dispatch({ type: "TOGGLE_AUDIO" });
          audioManager.setEnabled(!state.audioEnabled);
        }}
      screens={{
        nav: (
          <NavScreen
            activePlanetId={highlightedPlanetId}
            onFlyHome={
              state.view.type === "PLANET_DETAIL" ||
              state.view.type === "MISSION"
                ? () => dispatch({ type: "FLY_HOME" })
                : undefined
            }
            onSelectPlanet={(planetId) =>
              dispatch({ type: "FLY_TO_PLANET", planetId })
            }
            viewType={state.view.type}
            visitedPlanets={state.visitedPlanets}
          />
        ),
        data: (
          <DataScreen
            contentKey={`${state.view.type}:${activePlanetId ?? state.nearestPlanetId ?? "none"}`}
            onBack={
              state.view.type === "MISSION"
                ? () => dispatch({ type: "EXIT_MISSION" })
                : state.view.type === "PLANET_DETAIL"
                  ? () => dispatch({ type: "FLY_HOME" })
                  : undefined
            }
            title={dataScreen.title}
          >
            {dataScreen.content}
          </DataScreen>
        ),
        companion: (
          <CompanionScreen
            mode={companionMode}
            missionId={
              state.view.type === "MISSION"
                ? state.view.missionId
                : undefined
            }
            planetId={activePlanetId}
          />
        ),
        status: (
          <StatusBar
            totalPlanets={PLANETS.length + 1}
            view={state.view}
            visitedCount={state.visitedPlanets.size}
          />
        ),
      }}
    />
  );
}

function ViewRenderer() {
  const { state, dispatch } = useAppContext();

  if (state.view.type === "TERMINAL") {
    return <Terminal onLaunch={() => dispatch({ type: "LAUNCH" })} />;
  }

  return <CockpitExperience />;
}

function AppShell() {
  return (
    <main className="app-shell">
      <ViewRenderer />
    </main>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
