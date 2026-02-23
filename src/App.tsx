import { useEffect, useRef, useState } from "react";
import "./App.css";
import { audioManager } from "./audio/AudioManager";
import { Crosshair } from "./components/Crosshair";
import { FlightHintOverlay } from "./components/FlightHintOverlay";
import { Mission } from "./components/Mission";
import { PlanetDetail } from "./components/PlanetDetail";
import { SolarSystem } from "./components/SolarSystem";
import { Terminal } from "./components/Terminal";
import { CompanionScreen } from "./components/cockpit/CompanionScreen";
import { CockpitLayout } from "./components/cockpit/CockpitLayout";
import { DataScreen } from "./components/cockpit/DataScreen";
import { MiniSystemMap } from "./components/cockpit/MiniSystemMap";
import { NavScreen } from "./components/cockpit/NavScreen";
import { StatusBar } from "./components/cockpit/StatusBar";
import { TalkingHead } from "./components/ui/TalkingHead";
import { TransmissionOverlay } from "./components/ui/TransmissionOverlay";
import { VisorHUD } from "./components/visor/VisorHUD";
import { getMissionForPlanet } from "./data/missions";
import { OORT_CLOUD } from "./data/oortCloud";
import { getPlanetContent } from "./data/planetContent";
import { PLANETS, getPlanetById } from "./data/planets";
import { useDeviceCapability } from "./hooks/useDeviceCapability";
import { usePerformanceTier } from "./hooks/usePerformanceTier";
import { AppProvider, useAppContext } from "./state/AppState";

function renderDataContent(
  state: ReturnType<typeof useAppContext>["state"],
  dispatch: ReturnType<typeof useAppContext>["dispatch"],
) {
  switch (state.view.type) {
    case "SOLAR_SYSTEM": {
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
              <li key="open-source">
                <button
                  onClick={() =>
                    dispatch({ type: "FLY_TO_PLANET", planetId: "open-source" })
                  }
                  type="button"
                >
                  {OORT_CLOUD.label} - {OORT_CLOUD.subtitle}
                </button>
              </li>
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
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [crosshairPlanetId, setCrosshairPlanetId] = useState<string | null>(
    null,
  );
  const [showTransmission, setShowTransmission] = useState(false);
  const [headVisible, setHeadVisible] = useState(false);
  const headOpenedRef = useRef(false);
  const { isMobile, qualityTier } = useDeviceCapability();
  const performanceTier = usePerformanceTier(qualityTier);
  const isLowQuality = performanceTier === "low";

  useEffect(() => {
    if (
      state.view.type === "FLYING_TO_PLANET" ||
      state.view.type === "FLYING_HOME"
    ) {
      audioManager.playTransition();
    }
  }, [state.view.type]);

  useEffect(() => {
    if (state.view.type === "MISSION") {
      audioManager.playMissionStart();
    }
  }, [state.view.type]);

  const activePlanetId =
    state.view.type === "PLANET_DETAIL" || state.view.type === "MISSION"
      ? state.view.planetId
      : undefined;

  const flyingToPlanetId =
    state.view.type === "FLYING_TO_PLANET" ? state.view.planetId : undefined;

  const highlightedPlanetId =
    flyingToPlanetId ?? activePlanetId ?? state.nearestPlanetId ?? undefined;

  const dataScreen = renderDataContent(state, dispatch);
  const companionMode =
    state.view.type === "MISSION"
      ? "copilot"
      : state.view.type === "PLANET_DETAIL"
        ? "active"
        : "standby";
  const transmissionShownRef = useRef<Set<string>>(new Set());
  const prevCompanionModeRef = useRef(companionMode);

  useEffect(() => {
    const previousMode = prevCompanionModeRef.current;
    prevCompanionModeRef.current = companionMode;

    if (
      previousMode === "standby" &&
      companionMode !== "standby" &&
      activePlanetId
    ) {
      if (!transmissionShownRef.current.has(activePlanetId)) {
        transmissionShownRef.current.add(activePlanetId);
        setShowTransmission(true);
      } else {
        audioManager.playCommBeep();
      }
    }
  }, [activePlanetId, companionMode]);

  // Auto-open talking head when companion first becomes active
  useEffect(() => {
    if (companionMode !== "standby" && !headOpenedRef.current) {
      headOpenedRef.current = true;
      setHeadVisible(true);
    }
  }, [companionMode]);

  const toggleAudio = () => {
    dispatch({ type: "TOGGLE_AUDIO" });
    audioManager.setEnabled(!state.audioEnabled);
  };

  const handlePlanetSelect = (planetId: string) => {
    if (isEntering) return;
    if (
      state.view.type === "FLYING_TO_PLANET" ||
      state.view.type === "FLYING_HOME"
    )
      return;
    if (activePlanetId === planetId) return;

    setShowTransmission(false);
    if (!isMobile) document.exitPointerLock();
    audioManager.playClick();
    dispatch({ type: "FLY_TO_PLANET", planetId });
  };

  const handleDisengagePlanet = () => {
    if (state.view.type === "PLANET_DETAIL" || state.view.type === "MISSION") {
      dispatch({ type: "DISENGAGE_PLANET" });
    }
  };

  const lockedPlanetLabel = activePlanetId
    ? (getPlanetById(activePlanetId)?.label ?? activePlanetId)
    : undefined;

  const crosshairPlanetLabel = crosshairPlanetId
    ? (getPlanetById(crosshairPlanetId)?.label ??
      (crosshairPlanetId === "about" ? "About Me" : crosshairPlanetId))
    : undefined;

  const showFlightHints =
    !isMobile &&
    !isEntering &&
    (state.view.type === "SOLAR_SYSTEM" || state.view.type === "PLANET_DETAIL");

  const canvas = (
    <SolarSystem
      activePlanetId={activePlanetId}
      flyToPlanetId={flyingToPlanetId}
      isEntering={isEntering}
      isFlyingHome={state.view.type === "FLYING_HOME"}
      onArriveHome={() => dispatch({ type: "ARRIVE_HOME" })}
      onArrivePlanet={(planetId) => {
        audioManager.playArrivalChime();
        dispatch({ type: "ARRIVE_AT_PLANET", planetId });
      }}
      onDisengagePlanet={handleDisengagePlanet}
      onEntranceComplete={() => setIsEntering(false)}
      onNearestPlanetChange={(planetId) =>
        dispatch({ type: "SET_NEAREST_PLANET", planetId })
      }
      onPlanetSelect={handlePlanetSelect}
      onCrosshairPlanetChange={setCrosshairPlanetId}
      onPointerLockChange={setIsPointerLocked}
      showHint={false}
      showOrbitLines={!isMobile && state.view.type === "SOLAR_SYSTEM"}
      visitedPlanets={state.visitedPlanets}
      starCount={isLowQuality ? 500 : isMobile ? 1500 : 5000}
      reducedQuality={isLowQuality}
      particleCount={isLowQuality ? 0 : isMobile ? 50 : 200}
      isMobile={isMobile}
      qualityTier={performanceTier}
    />
  );

  const flightOverlays =
    !isMobile && !isEntering ? (
      <>
        {isPointerLocked ? (
          <Crosshair targetPlanetLabel={crosshairPlanetLabel} />
        ) : null}
        {showFlightHints ? (
          <FlightHintOverlay
            lockedOn={!!activePlanetId}
            planetLabel={lockedPlanetLabel}
          />
        ) : null}
      </>
    ) : null;

  const companionMissionId =
    state.view.type === "MISSION" ? state.view.missionId : undefined;

  if (isMobile) {
    const mobileStatusText = activePlanetId
      ? activePlanetId.toUpperCase()
      : flyingToPlanetId
        ? `-> ${flyingToPlanetId.toUpperCase()}`
        : "DIGITAL COSMOS";

    return (
      <VisorHUD
        audioEnabled={state.audioEnabled}
        canvas={canvas}
        companionContent={
          <CompanionScreen
            mode={companionMode}
            missionId={companionMissionId}
            planetId={activePlanetId}
          />
        }
        companionTalking={state.companion.isTyping}
        dataContent={dataScreen.content}
        dataTitle={dataScreen.title}
        mapContent={
          <MiniSystemMap
            activePlanetId={highlightedPlanetId}
            onSelectPlanet={(planetId) => {
              audioManager.playClick();
              dispatch({ type: "FLY_TO_PLANET", planetId });
            }}
            visitedPlanets={state.visitedPlanets}
          />
        }
        onToggleAudio={toggleAudio}
        statusText={mobileStatusText}
      />
    );
  }

  return (
    <>
      <CockpitLayout
        audioEnabled={state.audioEnabled}
        canvas={canvas}
        onToggleAudio={toggleAudio}
        panelTitles={{
          data: dataScreen.title,
          companion: companionMode === "copilot" ? "COPILOT MODE" : "COMPANION COMMS",
        }}
        panelPowered={{
          companion: companionMode !== "standby",
        }}
        panelPopouts={{
          companion: headVisible ? (
            <TalkingHead
              active={companionMode !== "standby"}
              isTalking={state.companion.isTyping}
              position="side"
              onClose={() => setHeadVisible(false)}
            />
          ) : undefined,
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
            >
              {dataScreen.content}
            </DataScreen>
          ),
          companion: (
            <CompanionScreen
              mode={companionMode}
              missionId={companionMissionId}
              planetId={activePlanetId}
            />
          ),
          status: (
            <StatusBar
              totalPlanets={PLANETS.length + 2}
              view={state.view}
              visitedCount={state.visitedPlanets.size}
            />
          ),
        }}
      />
      {flightOverlays}
      <TransmissionOverlay
        active={showTransmission}
        onComplete={() => setShowTransmission(false)}
      />
    </>
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
