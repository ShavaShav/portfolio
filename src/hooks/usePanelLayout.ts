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

export function resolveDefaultLayouts(vw: number, vh: number): PanelLayouts {
  const gap = 16;
  const top = 104;
  const leftWidth = vw < 1200 ? 220 : 260;
  const rightWidth = vw < 1200 ? 300 : 350;
  const companionWidth = vw < 1200 ? 320 : 380;
  const companionHeight = Math.min(252, Math.max(180, vh * 0.3));
  const bottom = vh - 20;
  return {
    nav: {
      x: 20,
      y: top,
      width: leftWidth,
      height: Math.max(120, bottom - companionHeight - gap - top),
      minimized: false,
    },
    data: {
      x: vw - rightWidth - 20,
      y: top,
      width: rightWidth,
      height: Math.max(120, bottom - 144 - gap - top),
      minimized: false,
    },
    companion: {
      x: 20,
      y: bottom - companionHeight,
      width: companionWidth,
      height: companionHeight,
      minimized: false,
    },
    status: {
      x: vw - rightWidth - 20,
      y: bottom - 144,
      width: rightWidth,
      height: 144,
      minimized: false,
    },
    flight: {
      x: (companionWidth + vw - rightWidth - 260) / 2,
      y: bottom - 216,
      width: 260,
      height: 216,
      minimized: vw < 1180 || vh < 650,
    },
  };
}

export function clampPanelLayout(
  layout: PanelLayout,
  vw: number,
  vh: number,
): PanelLayout {
  const width = Math.min(Math.max(200, layout.width), Math.max(200, vw - 40));
  const height = Math.min(
    Math.max(120, layout.height),
    Math.max(120, vh - 124),
  );
  return {
    ...layout,
    width,
    height,
    x: Math.min(Math.max(0, layout.x), Math.max(0, vw - width)),
    y: Math.min(Math.max(96, layout.y), Math.max(96, vh - height)),
  };
}

function normalizeLayouts(stored: Partial<PanelLayouts>): PanelLayouts {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const defaults = resolveDefaultLayouts(vw, vh);
  for (const id of Object.keys(defaults) as PanelId[]) {
    const saved = stored?.[id];
    if (
      saved &&
      [saved.x, saved.y, saved.width, saved.height].every(Number.isFinite)
    ) {
      defaults[id] = clampPanelLayout(
        { ...defaults[id], ...saved, minimized: saved.minimized === true },
        vw,
        vh,
      );
    }
  }
  return defaults;
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

    return normalizeLayouts({});
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
    } catch {
      // Ignore storage issues.
    }
  }, [layouts]);

  useEffect(() => {
    const resize = () => setLayouts((current) => normalizeLayouts(current));
    window.addEventListener("resize", resize, { passive: true });
    return () => window.removeEventListener("resize", resize);
  }, []);

  const updatePanel = useCallback(
    (panelId: PanelId, update: Partial<PanelLayout>) => {
      setLayouts((prev) => ({
        ...prev,
        [panelId]: {
          ...clampPanelLayout(
            { ...prev[panelId], ...update },
            window.innerWidth,
            window.innerHeight,
          ),
        },
      }));
    },
    [],
  );

  const resetLayout = useCallback(() => {
    const defaults = normalizeLayouts({});
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
