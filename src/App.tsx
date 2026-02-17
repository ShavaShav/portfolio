import "./App.css";
import { Mission } from "./components/Mission";
import { PlanetDetail } from "./components/PlanetDetail";
import { SolarSystem } from "./components/SolarSystem";
import { Terminal } from "./components/Terminal";
import { CompanionScreen } from "./components/cockpit/CompanionScreen";
import { CockpitLayout } from "./components/cockpit/CockpitLayout";
import { DataScreen } from "./components/cockpit/DataScreen";
import { NavScreen } from "./components/cockpit/NavScreen";
import { StatusBar } from "./components/cockpit/StatusBar";
import { PLANETS } from "./data/planets";
import { AppProvider, useAppContext } from "./state/AppState";

function renderDataContent(
  state: ReturnType<typeof useAppContext>["state"],
  dispatch: ReturnType<typeof useAppContext>["dispatch"],
) {
  switch (state.view.type) {
    case "SOLAR_SYSTEM": {
      return {
        title: "SYSTEM OVERVIEW",
        content: (
          <div className="system-overview">
            <p>
              Select a destination from the viewport or navigation map to
              inspect chapter details.
            </p>
            <ul>
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
      return {
        title: "PLANET DATA",
        content: (
          <PlanetDetail
            onStartMission={() =>
              dispatch({
                type: "ENTER_MISSION",
                missionId: `${planetId}-mission`,
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

  const activePlanetId =
    state.view.type === "FLYING_TO_PLANET" ||
    state.view.type === "PLANET_DETAIL" ||
    state.view.type === "MISSION"
      ? state.view.planetId
      : undefined;

  const dataScreen = renderDataContent(state, dispatch);

  return (
    <CockpitLayout
      audioEnabled={state.audioEnabled}
      canvas={
        <SolarSystem
          flyToPlanetId={
            state.view.type === "FLYING_TO_PLANET"
              ? state.view.planetId
              : undefined
          }
          isFlyingHome={state.view.type === "FLYING_HOME"}
          onArriveHome={() => dispatch({ type: "ARRIVE_HOME" })}
          onArrivePlanet={(planetId) =>
            dispatch({ type: "ARRIVE_AT_PLANET", planetId })
          }
          onPlanetSelect={(planetId) => {
            if (
              state.view.type === "FLYING_TO_PLANET" ||
              state.view.type === "FLYING_HOME"
            ) {
              return;
            }

            dispatch({ type: "FLY_TO_PLANET", planetId });
          }}
          showHint={false}
          showOrbitLines={state.view.type === "SOLAR_SYSTEM"}
        />
      }
      onToggleAudio={() => dispatch({ type: "TOGGLE_AUDIO" })}
      screens={{
        nav: (
          <NavScreen
            activePlanetId={activePlanetId}
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
            contentKey={`${state.view.type}:${activePlanetId ?? "none"}`}
            onBack={
              state.view.type === "PLANET_DETAIL" ||
              state.view.type === "MISSION"
                ? () => dispatch({ type: "FLY_HOME" })
                : undefined
            }
            title={dataScreen.title}
          >
            {dataScreen.content}
          </DataScreen>
        ),
        companion: <CompanionScreen mode="standby" />,
        status: (
          <StatusBar
            totalPlanets={PLANETS.length}
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
