import { Fragment, useEffect, useState, type ReactNode } from "react";
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
    flight?: ReactNode;
  };
  panelTitles?: Partial<Record<PanelId, string>>;
  panelPowered?: Partial<Record<PanelId, boolean>>;
  panelPopouts?: Partial<Record<PanelId, ReactNode>>;
  audioEnabled: boolean;
  onToggleAudio: () => void;
};

const DEFAULT_PANEL_TITLES: Record<PanelId, string> = {
  nav: "NAV SYSTEM",
  data: "DATA",
  companion: "COMPANION COMMS",
  status: "STATUS",
  flight: "FLIGHT CONTROLS",
};

export function CockpitLayout({
  canvas,
  screens,
  panelTitles,
  panelPowered,
  panelPopouts,
  audioEnabled,
  onToggleAudio,
}: CockpitLayoutProps) {
  const [booted, setBooted] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const { layouts, updatePanel, resetLayout, toggleMinimize } =
    usePanelLayout();

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => setBooted(true));
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const renderPanel = (panelId: PanelId, content: ReactNode) => {
    if (!content) {
      return null;
    }

    return (
      <PanelWindow
        panelId={panelId}
        zIndex={activePanel === panelId ? 5 : 4}
        onActivate={() => setActivePanel(panelId)}
        title={panelTitles?.[panelId] ?? DEFAULT_PANEL_TITLES[panelId]}
        powered={panelPowered?.[panelId] ?? true}
        popout={panelPopouts?.[panelId]}
        x={layouts[panelId].x}
        y={layouts[panelId].y}
        width={layouts[panelId].width}
        height={layouts[panelId].height}
        isMinimized={layouts[panelId].minimized}
        onMinimize={() => {
          setActivePanel(panelId);
          toggleMinimize(panelId);
        }}
        onDragStop={(x, y) => updatePanel(panelId, { x, y })}
        onResizeStop={(width, height, x, y) =>
          updatePanel(panelId, { width, height, x, y })
        }
      >
        {content}
      </PanelWindow>
    );
  };

  return (
    <div className={`cockpit-layout ${booted ? "is-booted" : ""}`}>
      <div className="cockpit-layout__canvas">{canvas}</div>

      <CockpitFrame
        audioEnabled={audioEnabled}
        booted={booted}
        onToggleAudio={onToggleAudio}
        onResetLayout={resetLayout}
      />

      {(Object.keys(layouts) as PanelId[])
        .filter((id) => !layouts[id].minimized)
        .map((id) => (
          <Fragment key={id}>{renderPanel(id, screens[id])}</Fragment>
        ))}
      <div className="cockpit-layout__dock" aria-label="Minimized panels">
        {(Object.keys(layouts) as PanelId[])
          .filter((id) => layouts[id].minimized)
          .map((id) => (
            <div key={id}>{renderPanel(id, screens[id])}</div>
          ))}
      </div>
    </div>
  );
}
