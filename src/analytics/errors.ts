/**
 * Error capture & the React error boundary.
 *
 * This module is the "signal 3" half of the capture layer (design D6). It has
 * two jobs:
 *
 * - {@link installErrorHandlers} — attach `window` `error` and
 *   `unhandledrejection` listeners that turn an uncaught exception or a
 *   rejected promise into an `error` {@link AnalyticsEvent} and ship it
 *   eagerly via the capture core.
 * - {@link AnalyticsBoundary} — a hand-rolled class {@link Component} error
 *   boundary (no `react-error-boundary` dependency, design D14). It catches
 *   render-phase exceptions, reports them as `error` events, and renders a
 *   minimal plain-text fallback.
 *
 * Why eager delivery: an error is the signal most likely to fire right as the
 * page is about to break or be abandoned, so every report is `track()`ed and
 * then `flush("error")`ed immediately rather than waiting for the idle timer.
 * Each flushed batch carries the breadcrumb ring buffer (design D10), so an
 * error always travels with the trail of what the user did before it — the
 * substitute for symbolicated stacks under the `sourcemap: false` build (C7).
 *
 * Fallback-UI contract [review #11]: when the boundary trips, it renders a
 * plain-text message plus a reload button — and deliberately does **not**
 * attempt to re-render the 3D scene, whose crash put us here in the first
 * place. A blank WebGL canvas is worse than an honest, actionable message.
 *
 * Resilience contract: nothing here may throw into the host app. A failure in
 * the reporting path is swallowed — analytics must never crash the page it
 * measures.
 *
 * Design reference: §5.2, decisions D6 / D10, review #11.
 */

import { Component, createElement } from "react";
import type { CSSProperties, ReactNode } from "react";

import { flush, track } from "./core";
import type { AnalyticsEvent } from "./types";

/* -------------------------------------------------------------------------- */
/* Error reporting                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Where a captured error surfaced. A subset of {@link ErrorEvent.source} — the
 * `"manual"` source is reserved for callers outside this module.
 */
type ErrorSource = "window" | "promise" | "react";

/** The fields {@link report} needs to assemble an `error` event. */
interface ErrorDetail {
  /** Human-readable error message. */
  message: string;
  /** Stack trace, when one could be recovered. */
  stack?: string;
  /** Where the error was caught. */
  source: ErrorSource;
  /** `true` when the error visibly broke the experience for the user. */
  fatal: boolean;
}

/**
 * Reduce an arbitrary thrown value to a `message` (and a `stack` when there is
 * one). JavaScript lets any value be thrown or used to reject a promise — an
 * {@link Error}, a string, a number, a plain object, `undefined` — so this
 * normalizes all of them without ever throwing itself.
 */
function describeError(value: unknown): { message: string; stack?: string } {
  if (value instanceof Error) {
    return { message: value.message, stack: value.stack };
  }
  if (typeof value === "string") {
    return { message: value };
  }
  try {
    return { message: String(value) };
  } catch {
    // A value whose `toString` itself throws — give up gracefully.
    return { message: "Unknown error" };
  }
}

/**
 * Build an `error` {@link AnalyticsEvent} from a {@link ErrorDetail}, enqueue
 * it, and flush eagerly so it ships without waiting for the idle timer.
 *
 * The whole body is wrapped: a fault in the capture core must not propagate
 * out of an error handler and compound the original failure.
 */
function report(detail: ErrorDetail): void {
  try {
    const event: AnalyticsEvent = {
      type: "error",
      message: detail.message,
      stack: detail.stack,
      source: detail.source,
      fatal: detail.fatal,
    };
    track(event);
    // Ship now — the flushed batch carries the breadcrumb trail (D10).
    flush("error");
  } catch {
    // Analytics must never crash the host app it measures.
  }
}

/* -------------------------------------------------------------------------- */
/* Global error listeners                                                     */
/* -------------------------------------------------------------------------- */

/** Installed `error` listener, retained so it can be detached. */
let windowErrorHandler: ((event: ErrorEvent) => void) | null = null;

/** Installed `unhandledrejection` listener, retained so it can be detached. */
let rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

/**
 * Handle an uncaught exception that bubbled to `window`. Prefers the structured
 * `error` object; falls back to the event's `message` string for the rare
 * event (e.g. a cross-origin script) that carries no `error`.
 *
 * Marked non-`fatal`: the exception escaped to the global handler, but the page
 * itself is still standing — unlike a render crash, which trips the boundary.
 */
function onWindowError(event: ErrorEvent): void {
  const described =
    event.error != null
      ? describeError(event.error)
      : { message: event.message || "Uncaught error" };
  report({ ...described, source: "window", fatal: false });
}

/**
 * Handle a promise that rejected with no `.catch`. The rejection reason is an
 * arbitrary value, so it is run through {@link describeError}. Non-`fatal`: an
 * unhandled rejection rarely tears down the visible UI.
 */
function onUnhandledRejection(event: PromiseRejectionEvent): void {
  report({ ...describeError(event.reason), source: "promise", fatal: false });
}

/**
 * Attach the global `error` and `unhandledrejection` listeners (design D6).
 * Idempotent — a second call is ignored, so the listeners are never
 * double-bound and one fault is never reported twice.
 */
export function installErrorHandlers(): void {
  if (windowErrorHandler !== null) return; // already installed

  windowErrorHandler = onWindowError;
  rejectionHandler = onUnhandledRejection;
  window.addEventListener("error", windowErrorHandler);
  window.addEventListener("unhandledrejection", rejectionHandler);
}

/**
 * Detach the global error listeners. Intended for tests and module
 * hot-reload — a normal page load keeps them for its whole lifetime.
 */
export function uninstallErrorHandlers(): void {
  if (windowErrorHandler !== null) {
    window.removeEventListener("error", windowErrorHandler);
    windowErrorHandler = null;
  }
  if (rejectionHandler !== null) {
    window.removeEventListener("unhandledrejection", rejectionHandler);
    rejectionHandler = null;
  }
}

/* -------------------------------------------------------------------------- */
/* <AnalyticsBoundary> — React error boundary                                 */
/* -------------------------------------------------------------------------- */

/** Copy shown in the boundary's fallback UI. */
const FALLBACK_MESSAGE =
  "Something went wrong while rendering this page.";

/** Layout for the fallback container — a simple centered, full-height panel. */
const containerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.25rem",
  minHeight: "100vh",
  padding: "2rem",
  background: "#05060a",
  color: "#c8d0e0",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  textAlign: "center",
};

/** Text style for the fallback message line. */
const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.95rem",
  lineHeight: 1.5,
};

/** Style for the reload button. */
const buttonStyle: CSSProperties = {
  padding: "0.5rem 1.25rem",
  border: "1px solid #3a4256",
  borderRadius: "4px",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
};

/** Reload the page — the only recovery the fallback offers. */
function handleReload(): void {
  window.location.reload();
}

/**
 * The boundary's fallback view: a plain-text message and a reload button, and
 * nothing else [review #11]. It pointedly does not try to re-mount the 3D
 * scene — the scene crashing is what brought us here.
 */
function ErrorFallback(): ReactNode {
  return createElement(
    "div",
    { role: "alert", style: containerStyle },
    createElement("p", { style: messageStyle }, FALLBACK_MESSAGE),
    createElement(
      "button",
      { type: "button", style: buttonStyle, onClick: handleReload },
      "Reload",
    ),
  );
}

/** Props for {@link AnalyticsBoundary}. */
interface AnalyticsBoundaryProps {
  /** The subtree the boundary protects. */
  children: ReactNode;
}

/** State for {@link AnalyticsBoundary}. */
interface AnalyticsBoundaryState {
  /** `true` once a descendant has thrown during render. */
  hasError: boolean;
}

/**
 * A hand-rolled React error boundary (design D6, D14 — no
 * `react-error-boundary` dependency).
 *
 * It catches exceptions thrown while rendering its subtree, reports each one
 * as a `react`-sourced, `fatal` `error` event (the render tree was replaced —
 * the experience visibly broke), and swaps in {@link ErrorFallback}.
 *
 * Placement: wrap the whole `<App>` so a crash anywhere lands on the plain
 * fallback rather than a blank WebGL canvas (design item 11, review #11).
 */
export class AnalyticsBoundary extends Component<
  AnalyticsBoundaryProps,
  AnalyticsBoundaryState
> {
  constructor(props: AnalyticsBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  /** Flip into the error state so the next render shows the fallback. */
  static getDerivedStateFromError(): AnalyticsBoundaryState {
    return { hasError: true };
  }

  /** Report the caught render error to the capture layer. */
  componentDidCatch(error: Error): void {
    report({ ...describeError(error), source: "react", fatal: true });
  }

  render(): ReactNode {
    return this.state.hasError
      ? createElement(ErrorFallback)
      : this.props.children;
  }
}
