import { useCallback, useEffect, useState } from "react";

export type PanelLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
};

export type PanelId = "nav" | "data" | "companion" | "status" | "flight";

export type PanelLayouts = Record<PanelId, PanelLayout>;

const STORAGE_KEY = "cockpit-panel-layout";

function resolveDefaults(): PanelLayouts {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  return {
    nav: { x: 14, y: 92, width: 250, height: vh - 280, minimized: false },
    data: {
      x: vw - 390 - 14,
      y: 92,
      width: 390,
      height: vh - 280,
      minimized: false,
    },
    companion: {
      x: 14,
      y: vh - 220 - 14,
      width: 390,
      height: 220,
      minimized: false,
    },
    status: {
      x: vw - 390 - 14,
      y: vh - 165 - 14,
      width: 390,
      height: 165,
      minimized: false,
    },
    flight: {
      x: vw - 260 - 14,
      y: vh - 280 - 14,
      width: 260,
      height: 220,
      minimized: false,
    },
  };
}

function normalizeLayouts(stored: Partial<PanelLayouts>): PanelLayouts {
  const defaults = resolveDefaults();

  return {
    nav: { ...defaults.nav, ...stored.nav },
    data: { ...defaults.data, ...stored.data },
    companion: { ...defaults.companion, ...stored.companion },
    status: { ...defaults.status, ...stored.status },
    flight: { ...defaults.flight, ...stored.flight },
  };
}

export function usePanelLayout() {
  const [layouts, setLayouts] = useState<PanelLayouts>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return normalizeLayouts(JSON.parse(stored) as Partial<PanelLayouts>);
      }
    } catch {
      // Ignore parse issues.
    }

    return resolveDefaults();
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
    } catch {
      // Ignore storage issues.
    }
  }, [layouts]);

  const updatePanel = useCallback(
    (panelId: PanelId, update: Partial<PanelLayout>) => {
      setLayouts((prev) => ({
        ...prev,
        [panelId]: {
          ...prev[panelId],
          ...update,
        },
      }));
    },
    [],
  );

  const resetLayout = useCallback(() => {
    const defaults = resolveDefaults();
    setLayouts(defaults);

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore cleanup issues.
    }
  }, []);

  const toggleMinimize = useCallback((panelId: PanelId) => {
    setLayouts((prev) => ({
      ...prev,
      [panelId]: {
        ...prev[panelId],
        minimized: !prev[panelId].minimized,
      },
    }));
  }, []);

  return {
    layouts,
    updatePanel,
    resetLayout,
    toggleMinimize,
  };
}
