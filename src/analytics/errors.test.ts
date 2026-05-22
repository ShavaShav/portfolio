import { createElement } from "react";
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AnalyticsBoundary,
  installErrorHandlers,
  uninstallErrorHandlers,
} from "./errors";
import { addBreadcrumb, flush, init, shutdown } from "./core";
import type { Batch, ErrorEvent, Sink, StampedEvent } from "./types";

/* -------------------------------------------------------------------------- */
/* Test helpers                                                               */
/* -------------------------------------------------------------------------- */

/** A {@link Sink} that records every batch it is handed. */
interface RecordingSink extends Sink {
  readonly sent: Batch[];
}

/** Build a fresh recording sink. */
function recordingSink(): RecordingSink {
  const sent: Batch[] = [];
  return {
    name: "recording",
    send: (batch) => {
      sent.push(batch);
    },
    sent,
  };
}

/** Every captured `error` event across all batches a sink received. */
function errorEvents(sink: RecordingSink): ErrorEvent[] {
  return sink.sent
    .flatMap((b: Batch) => b.events)
    .map((s: StampedEvent) => s.event)
    .filter((e): e is ErrorEvent => e.type === "error");
}

/** Dispatch a `window` `error` event, optionally with a structured `error`. */
function dispatchWindowError(error: unknown, message = "boom"): void {
  window.dispatchEvent(new ErrorEvent("error", { error, message }));
}

/** Dispatch an `unhandledrejection` event carrying `reason`. */
function dispatchRejection(reason: unknown): void {
  const event = new Event("unhandledrejection");
  Object.defineProperty(event, "reason", { value: reason, configurable: true });
  window.dispatchEvent(event);
}

/** A component that always throws while rendering — trips the boundary. */
function Boom(): ReactNode {
  throw new Error("render crash");
}

beforeEach(() => {
  uninstallErrorHandlers();
  shutdown();
});

afterEach(() => {
  cleanup();
  uninstallErrorHandlers();
  shutdown();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* window 'error' listener                                                    */
/* -------------------------------------------------------------------------- */

describe("window error listener", () => {
  it("captures an uncaught error as a window-sourced error event", () => {
    const sink = recordingSink();
    init({ sink });
    installErrorHandlers();

    dispatchWindowError(new Error("kaboom"));

    const errors = errorEvents(sink);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "kaboom",
      source: "window",
      fatal: false,
    });
    expect(errors[0].stack).toBeDefined();
  });

  it("falls back to the event message when no error object is present", () => {
    const sink = recordingSink();
    init({ sink });
    installErrorHandlers();

    dispatchWindowError(null, "Script error.");

    const errors = errorEvents(sink);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("Script error.");
    expect(errors[0].source).toBe("window");
  });
});

/* -------------------------------------------------------------------------- */
/* unhandledrejection listener                                                */
/* -------------------------------------------------------------------------- */

describe("unhandledrejection listener", () => {
  it("captures a rejected promise as a promise-sourced error event", () => {
    const sink = recordingSink();
    init({ sink });
    installErrorHandlers();

    dispatchRejection(new Error("rejected"));

    const errors = errorEvents(sink);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "rejected",
      source: "promise",
      fatal: false,
    });
  });

  it("normalizes a non-Error rejection reason to a message string", () => {
    const sink = recordingSink();
    init({ sink });
    installErrorHandlers();

    dispatchRejection("plain string reason");

    expect(errorEvents(sink)[0].message).toBe("plain string reason");
  });
});

/* -------------------------------------------------------------------------- */
/* Eager delivery & breadcrumb trail                                          */
/* -------------------------------------------------------------------------- */

describe("error delivery", () => {
  it("flushes the error eagerly with reason 'error'", () => {
    const sink = recordingSink();
    init({ sink });
    installErrorHandlers();

    dispatchWindowError(new Error("boom"));

    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0].reason).toBe("error");
  });

  it("ships the breadcrumb trail alongside the error (D10)", () => {
    const sink = recordingSink();
    init({ sink });
    installErrorHandlers();

    addBreadcrumb({ category: "ui", message: "clicked launch" });
    dispatchWindowError(new Error("boom"));

    const crumbs = sink.sent[0].breadcrumbs;
    expect(crumbs.map((c) => c.message)).toContain("clicked launch");
  });

  it("buffers an error captured before init() and delivers it after", () => {
    installErrorHandlers();
    dispatchWindowError(new Error("early boom")); // no sink yet

    const sink = recordingSink();
    init({ sink });
    flush("manual");

    expect(errorEvents(sink).map((e) => e.message)).toEqual(["early boom"]);
  });

  it("never throws when the sink throws", () => {
    const throwingSink: Sink = {
      name: "throwing",
      send: () => {
        throw new Error("sink boom");
      },
    };
    init({ sink: throwingSink });
    installErrorHandlers();

    expect(() => dispatchWindowError(new Error("boom"))).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* install / uninstall lifecycle                                              */
/* -------------------------------------------------------------------------- */

describe("installErrorHandlers", () => {
  it("is idempotent — a second install does not double-report", () => {
    const sink = recordingSink();
    init({ sink });
    installErrorHandlers();
    installErrorHandlers(); // ignored — listeners already bound

    dispatchWindowError(new Error("boom"));

    expect(errorEvents(sink)).toHaveLength(1);
  });

  it("stops capturing once uninstalled", () => {
    const sink = recordingSink();
    init({ sink });
    installErrorHandlers();
    uninstallErrorHandlers();

    dispatchWindowError(new Error("boom"));
    dispatchRejection(new Error("rejected"));

    expect(errorEvents(sink)).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* <AnalyticsBoundary>                                                        */
/* -------------------------------------------------------------------------- */

describe("AnalyticsBoundary", () => {
  it("renders its children while the subtree is healthy", () => {
    render(
      createElement(
        AnalyticsBoundary,
        null,
        createElement("span", null, "healthy subtree"),
      ),
    );

    expect(screen.getByText("healthy subtree")).toBeInTheDocument();
  });

  it("renders a plain-text fallback with a reload button on a render error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(createElement(AnalyticsBoundary, null, createElement(Boom)));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reload/i }),
    ).toBeInTheDocument();
    // The crashed subtree must not be rendered — no blank 3D scene [review #11].
    expect(screen.queryByText("render crash")).not.toBeInTheDocument();
  });

  it("reports a caught render error as a fatal, react-sourced event", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sink = recordingSink();
    init({ sink });

    render(createElement(AnalyticsBoundary, null, createElement(Boom)));

    const errors = errorEvents(sink);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      message: "render crash",
      source: "react",
      fatal: true,
    });
  });
});
