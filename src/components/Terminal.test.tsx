import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Terminal } from "./Terminal";

const { deviceCapability } = vi.hoisted(() => ({
  deviceCapability: vi.fn(),
}));

vi.mock("../hooks/useDeviceCapability", () => ({
  useDeviceCapability: deviceCapability,
}));

vi.mock("../audio/AudioManager", () => ({
  audioManager: {
    playType: vi.fn(),
    playLaunchIgnition: vi.fn(),
    playLaunchCountdown: vi.fn(),
    playLaunchStatusOk: vi.fn(),
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  deviceCapability.mockReturnValue({ isMobile: false, qualityTier: "high" });
});
afterEach(() => vi.useRealTimers());

function setup() {
  const onLaunch = vi.fn();
  const onSetAudioEnabled = vi.fn();
  render(
    <Terminal
      onLaunch={onLaunch}
      audioEnabled={false}
      onSetAudioEnabled={onSetAudioEnabled}
    />,
  );
  return { onLaunch, onSetAudioEnabled };
}
function command(value: string) {
  const input = screen.getByLabelText("Terminal command");
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("terminal-first entry preserves its commands", () => {
  it("keeps desktop entry terminal-only without a splash or launch button", () => {
    setup();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /launch/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Terminal command")).toHaveFocus();
  });
  it("keeps the mobile launch button and starts the existing sequence", () => {
    deviceCapability.mockReturnValue({ isMobile: true, qualityTier: "medium" });
    setup();
    const launchButton = screen.getByRole("button", { name: "LAUNCH" });
    expect(launchButton).toBeVisible();
    fireEvent.click(launchButton);
    expect(
      screen.queryByRole("button", { name: "LAUNCH" }),
    ).not.toBeInTheDocument();
  });
  it("still supports help and static commands", () => {
    setup();
    command("help");
    expect(screen.getByText("> Available commands:")).toBeVisible();
    command("whoami");
    expect(
      screen.getByText("> visitor - but you're about to meet Zach"),
    ).toBeVisible();
  });
  it("still supports sound toggling", () => {
    const { onSetAudioEnabled } = setup();
    command("sound on");
    expect(onSetAudioEnabled).toHaveBeenCalledWith(true);
  });
  it("preserves forced launch without a countdown", () => {
    const { onLaunch } = setup();
    command("launch -f");
    act(() => vi.advanceTimersByTime(200));
    expect(onLaunch).toHaveBeenCalledOnce();
  });
  it("rejects invalid launch flags", () => {
    const { onLaunch } = setup();
    command("launch --invalid");
    expect(screen.getByText("> Usage: launch [-f|--force]")).toBeVisible();
    expect(onLaunch).not.toHaveBeenCalled();
  });
});
