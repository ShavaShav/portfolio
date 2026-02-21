import { useState, type ReactNode } from "react";
import { audioManager } from "../../audio/AudioManager";
import { AudioToggle } from "../ui/AudioToggle";
import { OverlaySheet } from "../ui/OverlaySheet";
import "./visor.css";

type VisorHUDProps = {
  canvas: ReactNode;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  statusText: string;
  mapContent: ReactNode;
  dataContent: ReactNode;
  dataTitle: string;
  companionContent: ReactNode;
};

export function VisorHUD({
  canvas,
  audioEnabled,
  onToggleAudio,
  statusText,
  mapContent,
  dataContent,
  dataTitle,
  companionContent,
}: VisorHUDProps) {
  const [openSheet, setOpenSheet] = useState<"map" | "data" | "ai" | null>(
    null,
  );

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

  return (
    <div className="visor-hud">
      {/* Top bar */}
      <header className="visor-hud__top">
        <div className="visor-hud__monogram">ZS</div>
        <span className="visor-hud__status">{statusText}</span>
        <AudioToggle enabled={audioEnabled} onToggle={onToggleAudio} />
      </header>

      {/* Full-viewport canvas */}
      <div className="visor-hud__canvas">{canvas}</div>

      {/* Bottom bar */}
      <footer className="visor-hud__bottom">
        <span className="visor-hud__telemetry">ORBIT STABLE</span>
        <div className="visor-hud__buttons">
          <button
            className={`visor-hud__btn ${openSheet === "map" ? "is-active" : ""}`}
            onClick={openMap}
            type="button"
          >
            MAP
          </button>
          <button
            className={`visor-hud__btn ${openSheet === "data" ? "is-active" : ""}`}
            onClick={openData}
            type="button"
          >
            DATA
          </button>
          <button
            className={`visor-hud__btn ${openSheet === "ai" ? "is-active" : ""}`}
            onClick={openAI}
            type="button"
          >
            AI
          </button>
        </div>
      </footer>

      {/* Overlay sheets */}
      <OverlaySheet
        height="60%"
        isOpen={openSheet === "map"}
        onClose={closeSheet}
        title="NAV SYSTEM"
      >
        {mapContent}
      </OverlaySheet>

      <OverlaySheet
        height="100%"
        isOpen={openSheet === "data"}
        onClose={closeSheet}
        title={dataTitle.toUpperCase()}
      >
        {dataContent}
      </OverlaySheet>

      <OverlaySheet
        height="70%"
        isOpen={openSheet === "ai"}
        onClose={closeSheet}
        title="SHIP AI"
      >
        {companionContent}
      </OverlaySheet>
    </div>
  );
}
