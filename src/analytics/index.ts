/**
 * Public API for the analytics capture layer.
 *
 * `src/analytics/index.ts` is the **single import surface** the rest of the app
 * uses — every consumer imports from `"@/analytics"` (this barrel) and never
 * reaches into an individual capture-layer module. Two things live here:
 *
 * - {@link init} — the one-call bootstrap. It reads the user's privacy signal
 *   and wires the capture layer accordingly (see below), so a host only ever
 *   calls `init()` once, near app start.
 * - Re-exports of the rest of the public surface: {@link track} /
 *   {@link flush} / {@link addBreadcrumb} (the capture core), the typed event
 *   helpers {@link trackLink} / {@link trackApiCall} / {@link useFrameHealth},
 *   the {@link AnalyticsBoundary} React error boundary, the
 *   {@link actionToEvents} action→event constructor, and the wire-format types.
 *
 * Privacy gate (design D8). {@link init} consults {@link isDoNotTrack} — the
 * legacy Do-Not-Track signal and Global Privacy Control. When the user has
 * opted out it installs a {@link NullSink} (the capture pipeline still runs so
 * stray `track()` calls drain harmlessly, but nothing leaves the device) and
 * registers **no** error or `web-vitals` listeners. Otherwise it installs the
 * production {@link BeaconSink}, attaches the global error handlers, and wires
 * the Core Web Vitals.
 *
 * Design reference: §5, decision D8.
 */

import { init as initCore } from "./core";
import { installErrorHandlers } from "./errors";
import { isDoNotTrack } from "./identity";
import { installPerformanceMonitoring } from "./performance";
import { BeaconSink, NullSink } from "./sink";

/* -------------------------------------------------------------------------- */
/* init()                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Collector endpoint used when {@link AnalyticsInitOptions.url} is not given
 * and `VITE_ANALYTICS_URL` is unset. A same-origin relative path — production
 * builds set `VITE_ANALYTICS_URL` to the absolute collector URL, so this is
 * only a development fallback (see `docs/analytics-server-contract.md` §2).
 */
const DEFAULT_COLLECTOR_URL = "/api/events";

/** Optional overrides for {@link init}. */
export interface AnalyticsInitOptions {
  /**
   * Collector endpoint a {@link BeaconSink} delivers batches to. Defaults to
   * the `VITE_ANALYTICS_URL` build-time env var, then to
   * {@link DEFAULT_COLLECTOR_URL}.
   */
  url?: string;
}

/**
 * Resolve the collector URL: an explicit override wins, then the
 * `VITE_ANALYTICS_URL` env var, then the same-origin {@link DEFAULT_COLLECTOR_URL}.
 */
function resolveCollectorUrl(override: string | undefined): string {
  return (
    override ?? import.meta.env.VITE_ANALYTICS_URL ?? DEFAULT_COLLECTOR_URL
  );
}

/**
 * Bootstrap the analytics capture layer. Call this once, near app start.
 *
 * Privacy gate (design D8): when the user has signalled a tracking opt-out via
 * Do-Not-Track or Global Privacy Control ({@link isDoNotTrack}), a
 * {@link NullSink} is installed — the capture pipeline runs so any `track()`
 * call elsewhere drains without unbounded buffering, but every batch is
 * discarded and **no** error or `web-vitals` listeners are registered.
 *
 * Otherwise the production path: a {@link BeaconSink} pointed at the resolved
 * collector URL, the global error handlers, and the Core Web Vitals.
 *
 * Idempotent — every step it drives ({@link initCore}, {@link installErrorHandlers},
 * {@link installPerformanceMonitoring}) ignores a repeat call, so a second
 * `init()` is a no-op.
 */
export function init(options: AnalyticsInitOptions = {}): void {
  if (isDoNotTrack()) {
    // Opted out (D8): discard everything, register nothing else.
    initCore({ sink: new NullSink() });
    return;
  }

  initCore({ sink: new BeaconSink(resolveCollectorUrl(options.url)) });
  installErrorHandlers();
  installPerformanceMonitoring();
}

/* -------------------------------------------------------------------------- */
/* Re-exports — the public surface                                            */
/* -------------------------------------------------------------------------- */

// Capture core — record an event, append a breadcrumb, flush on demand.
export { addBreadcrumb, flush, track } from "./core";
export type { AnalyticsConfig, BreadcrumbInput } from "./core";

// Typed event constructors — the per-signal helpers that build and record a
// typed AnalyticsEvent, plus the pure action→event mapper (design D4).
export { actionToEvents } from "./actionEvents";
export { trackLink } from "./links";
export { trackApiCall } from "./apiTracking";
export type {
  ApiCallOptions,
  ApiCallOutcome,
  ApiCallResult,
} from "./apiTracking";
export { useFrameHealth } from "./performance";

// React error boundary (design D6 / D14).
export { AnalyticsBoundary } from "./errors";

// Wire-format vocabulary & contracts (§5.1–5.4).
export type {
  AnalyticsEvent,
  ApiCallEvent,
  Batch,
  Breadcrumb,
  ErrorEvent,
  EventType,
  FlushReason,
  FrameHealthEvent,
  InteractionEvent,
  Json,
  LinkEvent,
  SessionRef,
  Sink,
  StampedEvent,
  ViewEvent,
  ViewName,
  WebVitalEvent,
} from "./types";
