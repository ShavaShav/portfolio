import "./App.css";
import { Mission } from "./components/Mission";
import { PlanetDetail } from "./components/PlanetDetail";
import { SolarSystem } from "./components/SolarSystem";
import { Terminal } from "./components/Terminal";
import { CockpitLayout } from "./components/cockpit/CockpitLayout";
import { AppProvider, useAppContext } from "./state/AppState";

function ViewRenderer() {
  const { state, dispatch } = useAppContext();

  switch (state.view.type) {
    case "TERMINAL": {
      return <Terminal onLaunch={() => dispatch({ type: "LAUNCH" })} />;
    }
    case "SOLAR_SYSTEM": {
      return <SolarSystem />;
    }
    case "FLYING_TO_PLANET": {
      return (
        <CockpitLayout
          canvas={<SolarSystem />}
          screens={{
            nav: <div>NavScreen</div>,
            data: <div>Flying to {state.view.planetId}</div>,
            companion: <div>CompanionScreen</div>,
            status: <div>StatusBar</div>,
          }}
        />
      );
    }
    case "PLANET_DETAIL": {
      const planetId = state.view.planetId;
      return (
        <CockpitLayout
          canvas={<SolarSystem />}
          screens={{
            nav: <div>NavScreen</div>,
            data: (
              <PlanetDetail
                planetId={planetId}
                onStartMission={() =>
                  dispatch({
                    type: "ENTER_MISSION",
                    planetId,
                    missionId: "default-mission",
                  })
                }
              />
            ),
            companion: <div>CompanionScreen</div>,
            status: <div>StatusBar</div>,
          }}
        />
      );
    }
    case "MISSION": {
      const planetId = state.view.planetId;
      const missionId = state.view.missionId;
      return (
        <CockpitLayout
          canvas={<SolarSystem />}
          screens={{
            nav: <div>NavScreen</div>,
            data: (
              <Mission
                planetId={planetId}
                missionId={missionId}
                onExit={() => dispatch({ type: "EXIT_MISSION" })}
              />
            ),
            companion: <div>CompanionScreen</div>,
            status: <div>StatusBar</div>,
          }}
        />
      );
    }
    case "FLYING_HOME": {
      return (
        <CockpitLayout
          canvas={<SolarSystem />}
          screens={{
            nav: <div>NavScreen</div>,
            data: <div>Returning to system overview</div>,
            companion: <div>CompanionScreen</div>,
            status: <div>StatusBar</div>,
          }}
        />
      );
    }
    default: {
      return null;
    }
  }
}

function DebugControls() {
  const { state, dispatch } = useAppContext();

  const activePlanetId =
    state.view.type === "FLYING_TO_PLANET" ||
    state.view.type === "PLANET_DETAIL" ||
    state.view.type === "MISSION"
      ? state.view.planetId
      : "obviant";

  return (
    <div className="debug-controls">
      <div className="debug-controls__row">
        <button type="button" onClick={() => dispatch({ type: "LAUNCH" })}>
          Launch
        </button>
        <button
          type="button"
          onClick={() =>
            dispatch({ type: "FLY_TO_PLANET", planetId: "obviant" })
          }
        >
          Fly To Obviant
        </button>
        <button
          type="button"
          onClick={() =>
            dispatch({ type: "ARRIVE_AT_PLANET", planetId: activePlanetId })
          }
        >
          Arrive Planet
        </button>
      </div>
      <div className="debug-controls__row">
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: "ENTER_MISSION",
              planetId: activePlanetId,
              missionId: "default-mission",
            })
          }
        >
          Enter Mission
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "EXIT_MISSION" })}
        >
          Exit Mission
        </button>
        <button type="button" onClick={() => dispatch({ type: "FLY_HOME" })}>
          Fly Home
        </button>
        <button type="button" onClick={() => dispatch({ type: "ARRIVE_HOME" })}>
          Arrive Home
        </button>
      </div>
      <p className="debug-controls__state">
        View: <strong>{state.view.type}</strong>
      </p>
    </div>
  );
}

function AppShell() {
  return (
    <main className="app-shell">
      <DebugControls />
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
