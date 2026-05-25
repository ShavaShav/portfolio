import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAnalyticsOptOut, setAnalyticsOptOut } from "./preference";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("getAnalyticsOptOut", () => {
  it("returns false when no preference is set", () => {
    expect(getAnalyticsOptOut()).toBe(false);
  });

  it("returns true when the opt-out value is persisted", () => {
    localStorage.setItem("pf.analytics.opt_out", "1");
    expect(getAnalyticsOptOut()).toBe(true);
  });

  it("returns false for any value other than the opt-out marker", () => {
    localStorage.setItem("pf.analytics.opt_out", "0");
    expect(getAnalyticsOptOut()).toBe(false);
  });

  it("falls back to false when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    expect(getAnalyticsOptOut()).toBe(false);
  });
});

describe("setAnalyticsOptOut", () => {
  it("persists the opt-out marker when set to true", () => {
    setAnalyticsOptOut(true);
    expect(localStorage.getItem("pf.analytics.opt_out")).toBe("1");
    expect(getAnalyticsOptOut()).toBe(true);
  });

  it("removes the key when set to false", () => {
    localStorage.setItem("pf.analytics.opt_out", "1");
    setAnalyticsOptOut(false);
    expect(localStorage.getItem("pf.analytics.opt_out")).toBeNull();
    expect(getAnalyticsOptOut()).toBe(false);
  });

  it("does not throw when localStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    expect(() => setAnalyticsOptOut(true)).not.toThrow();
    expect(() => setAnalyticsOptOut(false)).not.toThrow();
  });
});
