import { useEffect, useState, type ReactNode } from "react";
import { CockpitFrame } from "./CockpitFrame";
import "./cockpit.css";

type CockpitLayoutProps = {
  canvas: ReactNode;
  screens: {
    nav: ReactNode;
    data: ReactNode;
    companion: ReactNode;
    status: ReactNode;
  };
  audioEnabled: boolean;
  onToggleAudio: () => void;
};

export function CockpitLayout({
  canvas,
  screens,
  audioEnabled,
  onToggleAudio,
}: CockpitLayoutProps) {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => setBooted(true));
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className={`cockpit-layout ${booted ? "is-booted" : ""}`}>
      <div className="cockpit-layout__canvas">{canvas}</div>

      <CockpitFrame
        audioEnabled={audioEnabled}
        booted={booted}
        onToggleAudio={onToggleAudio}
      />

      <div className="cockpit-layout__panel cockpit-layout__nav">
        {screens.nav}
      </div>
      <div className="cockpit-layout__panel cockpit-layout__data">
        {screens.data}
      </div>
      <div className="cockpit-layout__panel cockpit-layout__companion">
        {screens.companion}
      </div>
      <div className="cockpit-layout__panel cockpit-layout__status">
        {screens.status}
      </div>
    </div>
  );
}
