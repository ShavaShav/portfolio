import { useEffect, useState, type ReactNode } from "react";
import { audioManager } from "../../audio/AudioManager";
import type { AppView } from "../../state/AppState";
import { AudioToggle } from "../ui/AudioToggle";
import { OverlaySheet } from "../ui/OverlaySheet";
import { TalkingHead } from "../ui/TalkingHead";
import "./visor.css";

type VisorHUDProps = {
  canvas: ReactNode;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  view: AppView;
  destinationLabel?: string;
  onReturnToSystem: () => void;
  onExitMission: () => void;
  mapContent: ReactNode;
  dataContent: ReactNode;
  dataTitle: string;
  companionContent: (isVisible: boolean) => ReactNode;
  companionTalking: boolean;
};

export function VisorHUD({
  canvas,
  audioEnabled,
  onToggleAudio,
  view,
  destinationLabel,
  onReturnToSystem,
  onExitMission,
  mapContent,
  dataContent,
  dataTitle,
  companionContent,
  companionTalking,
}: VisorHUDProps) {
  const [openSheet, setOpenSheet] = useState<"map" | "data" | "ai" | null>(
    null,
  );
  const destinationId = "planetId" in view ? view.planetId : undefined;
  const isAtPlanet = view.type === "PLANET_DETAIL" || view.type === "MISSION";
  const isApproaching = view.type === "FLYING_TO_PLANET";
  const isReturning = view.type === "FLYING_HOME";
  const canReturn = isAtPlanet || isApproaching;
  const destination = destinationLabel ?? destinationId ?? "this world";
  const statusText = isAtPlanet
    ? `EXPLORING ${destination}`
    : isApproaching
      ? `APPROACHING ${destination}`
      : isReturning
        ? "RETURNING TO SYSTEM"
        : "DIGITAL COSMOS";

  // Follow navigation, not chat rerenders. Closing a panel stays respected
  // until another destination or mission is entered.
  useEffect(() => {
    setOpenSheet(
      view.type === "PLANET_DETAIL" || view.type === "MISSION" ? "data" : null,
    );
  }, [view.type, destinationId]);

  const closeSheet = () => setOpenSheet(null);

  const openMap = () => {
    audioManager.playClick();
    setOpenSheet("map");
  };

  const openData = () => {
    audioManager.playClick();
    setOpenSheet("data");
  };

  const openAI = () => {
    audioManager.playClick();
    setOpenSheet("ai");
  };

  const returnToSystem = () => {
    closeSheet();
    audioManager.playClick();
    onReturnToSystem();
  };

  const panelTitle = isAtPlanet
    ? destination
    : openSheet === "ai"
      ? "CHAT WITH ZACH"
      : dataTitle.toUpperCase();

  return (
    <div className="visor-hud">
      <header className="visor-hud__top">
        {canReturn ? (
          <button
            className="visor-hud__back"
            aria-label="Back to system"
            onClick={returnToSystem}
            type="button"
          >
            <span aria-hidden="true">←</span> SYSTEM
          </button>
        ) : (
          <div className="visor-hud__monogram">ZS</div>
        )}
        <span className="visor-hud__status" role="status">
          {statusText}
        </span>
        <AudioToggle enabled={audioEnabled} onToggle={onToggleAudio} />
      </header>

      <div className="visor-hud__canvas">
        {canvas}
        <div className="visor-hud__tap-hint">
          {isAtPlanet
            ? "Open Details or Chat below · System to leave orbit"
            : isApproaching
              ? `Approaching ${destination}…`
              : isReturning
                ? "Returning to the system overview…"
                : "Tap a planet or open Map to explore"}
        </div>
      </div>

      <footer className="visor-hud__bottom">
        <span className="visor-hud__telemetry">
          {isAtPlanet
            ? "IN ORBIT"
            : isApproaching || isReturning
              ? "IN TRANSIT"
              : "ORBIT STABLE"}
        </span>
        <div className="visor-hud__buttons">
          <button
            className={`visor-hud__btn ${openSheet === "map" ? "is-active" : ""}`}
            aria-pressed={openSheet === "map"}
            onClick={openMap}
            type="button"
          >
            Map
          </button>
          <button
            className={`visor-hud__btn ${openSheet === "data" ? "is-active" : ""}`}
            aria-pressed={openSheet === "data"}
            onClick={openData}
            type="button"
          >
            Details
          </button>
          <button
            className={`visor-hud__btn ${openSheet === "ai" ? "is-active" : ""}`}
            aria-pressed={openSheet === "ai"}
            onClick={openAI}
            type="button"
          >
            Chat{" "}
            {isAtPlanet ? (
              <span className="visor-hud__chat-ready" aria-hidden="true" />
            ) : null}
          </button>
        </div>
      </footer>

      <OverlaySheet
        height="60%"
        isOpen={openSheet === "map"}
        onClose={closeSheet}
        title="NAV SYSTEM"
      >
        {mapContent}
      </OverlaySheet>

      <OverlaySheet
        height={view.type === "MISSION" ? "100%" : "85%"}
        isOpen={openSheet === "data" || openSheet === "ai"}
        keepMounted
        onClose={closeSheet}
        title={panelTitle}
      >
        <div className="visor-hud__destination">
          <div
            className="visor-hud__panel-switcher"
            role="group"
            aria-label="Destination panels"
          >
            <button
              className={openSheet === "data" ? "is-active" : ""}
              aria-pressed={openSheet === "data"}
              onClick={openData}
              type="button"
            >
              {view.type === "MISSION" ? "Mission" : "Details"}
            </button>
            <button
              className={openSheet === "ai" ? "is-active" : ""}
              aria-pressed={openSheet === "ai"}
              onClick={openAI}
              type="button"
            >
              Chat with Zach
              {isAtPlanet ? (
                <span className="visor-hud__chat-ready" aria-hidden="true" />
              ) : null}
            </button>
          </div>
          <div
            className="visor-hud__sheet-pane visor-hud__sheet-pane--data"
            hidden={openSheet !== "data"}
          >
            {dataContent}
          </div>
          <div
            className="visor-hud__sheet-pane visor-hud__sheet-pane--chat"
            hidden={openSheet !== "ai"}
          >
            <TalkingHead
              active={openSheet === "ai"}
              isTalking={companionTalking}
              mobile
            />
            {companionContent(openSheet === "ai")}
          </div>
          {canReturn ? (
            <div className="visor-hud__sheet-actions">
              {view.type === "MISSION" ? (
                <button onClick={onExitMission} type="button">
                  Back to planet
                </button>
              ) : null}
              <button onClick={returnToSystem} type="button">
                ← Back to system
              </button>
            </div>
          ) : null}
        </div>
      </OverlaySheet>
    </div>
  );
}
