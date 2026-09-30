import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OverlaySheet } from "./OverlaySheet";

vi.mock("gsap", () => ({
  default: { fromTo: vi.fn(), to: vi.fn(), killTweensOf: vi.fn() },
}));

describe("mobile sheets", () => {
  it("has a named dialog and an accessible close button", () => {
    const onClose = vi.fn();
    render(
      <OverlaySheet isOpen onClose={onClose} height="60%" title="Navigation">
        <button>Destination</button>
      </OverlaySheet>,
    );
    expect(screen.getByRole("dialog", { name: "Navigation" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Close Navigation" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("closes on Escape without triggering flight shortcuts", () => {
    const onClose = vi.fn();
    render(
      <OverlaySheet isOpen onClose={onClose} height="60%" title="Navigation">
        <button>Destination</button>
      </OverlaySheet>,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("keeps keyboard focus inside the open sheet", () => {
    render(
      <OverlaySheet isOpen onClose={() => {}} height="60%" title="Navigation">
        <button>Destination</button>
      </OverlaySheet>,
    );
    const last = screen.getByRole("button", { name: "Destination" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(
      screen.getByRole("button", { name: "Close Navigation" }),
    ).toHaveFocus();
  });
});
