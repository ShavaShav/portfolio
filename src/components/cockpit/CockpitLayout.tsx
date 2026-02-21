import { useEffect, useState, type ReactNode } from "react";
import type { PanelId } from "../../hooks/usePanelLayout";
import { usePanelLayout } from "../../hooks/usePanelLayout";
import { PanelWindow } from "../ui/PanelWindow";
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

const PANEL_TITLES: Record<PanelId, string> = {
  nav: "NAV SYSTEM",
  data: "DATA",
  companion: "COMPANION COMMS",
  status: "STATUS",
};

export function CockpitLayout({
  canvas,
  screens,
  audioEnabled,
  onToggleAudio,
}: CockpitLayoutProps) {
  const [booted, setBooted] = useState(false);
  const { layouts, updatePanel, resetLayout, toggleMinimize } = usePanelLayout();

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => setBooted(true));
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const renderPanel = (panelId: PanelId, content: ReactNode) => (
    <PanelWindow
      title={PANEL_TITLES[panelId]}
      x={layouts[panelId].x}
      y={layouts[panelId].y}
      width={layouts[panelId].width}
      height={layouts[panelId].height}
      isMinimized={layouts[panelId].minimized}
      onMinimize={() => toggleMinimize(panelId)}
      onDragStop={(x, y) => updatePanel(panelId, { x, y })}
      onResizeStop={(width, height, x, y) =>
        updatePanel(panelId, { width, height, x, y })
      }
    >
      {content}
    </PanelWindow>
  );

  return (
    <div className={`cockpit-layout ${booted ? "is-booted" : ""}`}>
      <div className="cockpit-layout__canvas">{canvas}</div>

      <CockpitFrame
        audioEnabled={audioEnabled}
        booted={booted}
        onToggleAudio={onToggleAudio}
        onResetLayout={resetLayout}
      />

      {renderPanel("nav", screens.nav)}
      {renderPanel("data", screens.data)}
      {renderPanel("companion", screens.companion)}
      {renderPanel("status", screens.status)}
    </div>
  );
}
