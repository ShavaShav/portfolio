import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clampPanelLayout,
  resolveDefaultLayouts,
  usePanelLayout,
} from "./usePanelLayout";

beforeEach(() => {
  localStorage.clear();
});

describe("observatory panel layouts", () => {
  it.each([
    [1440, 900],
    [1280, 720],
    [1024, 768],
    [800, 600],
  ])("keeps default panels in bounds at %ix%i", (width, height) => {
    const panels = Object.values(resolveDefaultLayouts(width, height));
    for (const panel of panels) {
      expect(panel.x).toBeGreaterThanOrEqual(0);
      expect(panel.y).toBeGreaterThanOrEqual(96);
      expect(panel.x + panel.width).toBeLessThanOrEqual(width);
      expect(panel.y + panel.height).toBeLessThanOrEqual(height);
    }
    const visible = panels.filter((panel) => !panel.minimized);
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i];
        const b = visible[j];
        const overlap =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        expect(overlap).toBe(false);
      }
    }
  });
  it("clamps restored panels after a smaller viewport", () => {
    const panel = clampPanelLayout(
      { x: 1500, y: 900, width: 600, height: 900, minimized: false },
      1024,
      768,
    );
    expect(panel.x + panel.width).toBeLessThanOrEqual(1024);
    expect(panel.y + panel.height).toBeLessThanOrEqual(768);
    expect(panel.y).toBeGreaterThanOrEqual(96);
  });
  it("ignores malformed storage and invalid panel coordinates", () => {
    localStorage.setItem(
      "cockpit-panel-layout",
      JSON.stringify({
        nav: { x: "oops", y: 5, width: -2, height: null },
        data: null,
      }),
    );
    const { result } = renderHook(usePanelLayout);
    expect(result.current.layouts.nav.width).toBeGreaterThanOrEqual(200);
    expect(result.current.layouts.nav.y).toBe(104);
  });
  it("preserves and persists custom positions and minimized panels", () => {
    const { result, unmount } = renderHook(usePanelLayout);
    act(() => result.current.updatePanel("nav", { x: 70, y: 130, width: 230 }));
    act(() => result.current.toggleMinimize("nav"));
    unmount();
    const restored = renderHook(usePanelLayout);
    expect(restored.result.current.layouts.nav).toMatchObject({
      x: 70,
      y: 130,
      width: 230,
      minimized: true,
    });
  });
  it("restores the new defaults on reset", () => {
    const { result } = renderHook(usePanelLayout);
    act(() =>
      result.current.updatePanel("data", { x: 20, y: 120, width: 210 }),
    );
    act(() => result.current.resetLayout());
    expect(result.current.layouts.data).toEqual(
      resolveDefaultLayouts(window.innerWidth, window.innerHeight).data,
    );
  });
});
