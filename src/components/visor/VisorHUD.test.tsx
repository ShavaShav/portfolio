import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppView } from "../../state/AppState";
import { VisorHUD } from "./VisorHUD";

vi.mock("gsap", () => ({
  default: { fromTo: vi.fn(), to: vi.fn(), killTweensOf: vi.fn() },
}));
vi.mock("../../audio/AudioManager", () => ({
  audioManager: { playClick: vi.fn() },
}));
vi.mock("../ui/TalkingHead", () => ({ TalkingHead: () => null }));

function ChatDraft() {
  const [draft, setDraft] = useState("");
  return (
    <input
      aria-label="Chat draft"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
    />
  );
}

function setup(view: AppView = { type: "SOLAR_SYSTEM" }) {
  const onReturnToSystem = vi.fn();
  const onExitMission = vi.fn();
  const props = {
    audioEnabled: false,
    onToggleAudio: vi.fn(),
    onReturnToSystem,
    onExitMission,
    destinationLabel: "Obviant",
    canvas: <div>3D scene</div>,
    mapContent: <button>Choose a world</button>,
    dataContent: <p>Obviant career details</p>,
    dataTitle: "PLANET DATA",
    companionContent: () => <ChatDraft />,
    companionTalking: false,
  };
  const result = render(<VisorHUD {...props} view={view} />);
  return {
    onReturnToSystem,
    onExitMission,
    navigate: (nextView: AppView) =>
      result.rerender(<VisorHUD {...props} view={nextView} />),
    rerender: () =>
      result.rerender(<VisorHUD {...props} view={view} companionTalking />),
  };
}

describe("mobile destination flow", () => {
  it("closes the map during approach and automatically opens details on arrival", () => {
    const { navigate } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    expect(screen.getByRole("dialog", { name: "NAV SYSTEM" })).toBeVisible();
    navigate({ type: "FLYING_TO_PLANET", planetId: "obviant" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("APPROACHING Obviant");
    navigate({ type: "PLANET_DETAIL", planetId: "obviant" });
    const panel = screen.getByRole("dialog", { name: "Obviant" });
    expect(within(panel).getByText("Obviant career details")).toBeVisible();
    expect(
      within(panel).getByRole("button", { name: "Chat with Zach" }),
    ).toBeVisible();
  });

  it("preserves chat state across panel switches, closing, and map navigation", () => {
    setup({ type: "PLANET_DETAIL", planetId: "obviant" });
    fireEvent.click(screen.getByRole("button", { name: "Chat with Zach" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Chat draft" }), {
      target: { value: "Tell me about your work" },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Details",
      }),
    );
    expect(
      screen.queryByRole("textbox", { name: "Chat draft" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close Obviant" }));
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    fireEvent.click(screen.getByRole("button", { name: "Close NAV SYSTEM" }));
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    expect(screen.getByRole("textbox", { name: "Chat draft" })).toHaveValue(
      "Tell me about your work",
    );
  });

  it("provides a return control in the arrival panel and in the scene header", () => {
    const { onReturnToSystem } = setup({
      type: "PLANET_DETAIL",
      planetId: "obviant",
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /Back to system/,
      }),
    );
    expect(onReturnToSystem).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to system" }));
    expect(onReturnToSystem).toHaveBeenCalledTimes(2);
  });

  it("does not reopen dismissed panels when companion state changes", () => {
    const { rerender } = setup({ type: "PLANET_DETAIL", planetId: "obviant" });
    fireEvent.click(screen.getByRole("button", { name: "Close Obviant" }));
    rerender();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens mission content and provides exits to both the planet and system", () => {
    const { navigate, onExitMission, onReturnToSystem } = setup();
    navigate({
      type: "MISSION",
      planetId: "obviant",
      missionId: "obviant-mission",
    });
    const panel = screen.getByRole("dialog", { name: "Obviant" });
    expect(
      within(panel).getByRole("button", { name: "Mission" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(
      within(panel).getByRole("button", { name: "Back to planet" }),
    );
    expect(onExitMission).toHaveBeenCalledOnce();
    fireEvent.click(
      within(panel).getByRole("button", { name: /Back to system/ }),
    );
    expect(onReturnToSystem).toHaveBeenCalledOnce();
  });

  it("offers cancellation during approach and clears the panel on return", () => {
    const { navigate, onReturnToSystem } = setup({
      type: "FLYING_TO_PLANET",
      planetId: "obviant",
    });
    fireEvent.click(screen.getByRole("button", { name: "Back to system" }));
    expect(onReturnToSystem).toHaveBeenCalledOnce();
    navigate({ type: "FLYING_HOME" });
    expect(screen.getByRole("status")).toHaveTextContent("RETURNING TO SYSTEM");
    navigate({ type: "SOLAR_SYSTEM" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Back to system" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Tap a planet or open Map to explore"),
    ).toBeVisible();
  });
});
