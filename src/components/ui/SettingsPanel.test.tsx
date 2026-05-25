import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsPanel } from "./SettingsPanel";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("SettingsPanel", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <SettingsPanel isOpen={false} onClose={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the analytics toggle when open", () => {
    render(<SettingsPanel isOpen={true} onClose={() => {}} />);
    expect(screen.getByText("SETTINGS")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
  });

  it("reflects the persisted preference: opt-out toggle reads OFF", () => {
    localStorage.setItem("pf.analytics.opt_out", "1");
    render(<SettingsPanel isOpen={true} onClose={() => {}} />);
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("OFF")).toBeInTheDocument();
  });

  it("persists the new preference when the toggle is clicked", () => {
    render(<SettingsPanel isOpen={true} onClose={() => {}} />);
    const toggle = screen.getByRole("switch");
    // Default: opted in (analytics ON, preference key absent).
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem("pf.analytics.opt_out")).toBeNull();

    fireEvent.click(toggle);
    expect(localStorage.getItem("pf.analytics.opt_out")).toBe("1");
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);
    expect(localStorage.getItem("pf.analytics.opt_out")).toBeNull();
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("invokes onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<SettingsPanel isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close settings"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
