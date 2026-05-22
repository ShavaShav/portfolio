/**
 * Performance & frame-health capture.
 *
 * The "signal 4" half of the capture layer: it measures how the page *performs*
 * rather than what the user does. Two independent jobs:
 *
 * - {@link installPerformanceMonitoring} — subscribe to the Core Web Vitals
 *   through the `web-vitals` library (LCP, INP, CLS, TTFB, FCP) and read the
 *   one-shot Navigation Timing entry. Each web vital is observed with
 *   `web-vitals`' **default** behaviour (`reportAllChanges: false`): the
 *   callback fires exactly once, when the metric has settled on its final
 *   value. Opting into the per-change stream (`reportAllChanges: true`) would
 *   ship a flurry of interim, soon-to-be-superseded values — deliberately
 *   avoided [review #3].
 * - {@link useFrameHealth} — a React hook for the `@react-three/fiber` render
 *   loop. It folds every `useFrame` delta into a fixed-size ring buffer and, on
 *   a ~30 s cadence, emits a `frame_health` event summarising the most recent
 *   window. The per-frame path is O(1) and allocation-free [review #4]: the only
 *   work each frame is one typed-array write and a handful of counter updates —
 *   the ring buffer is allocated once, never per frame.
 *
 * Resilience contract: nothing here may throw into the host app. A fault in a
 * `web-vitals` callback or in the render-loop sampler is swallowed — analytics
 * must never crash the page (nor stall the render loop) it measures.
 *
 * Design reference: §5.2 (`web_vital` / `frame_health` events), reviews #3, #4.
 */

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";
import type { Metric } from "web-vitals";

import { addBreadcrumb, track } from "./core";

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Round to one decimal place — enough precision for ms / fps reporting. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/* -------------------------------------------------------------------------- */
/* Core Web Vitals                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Forward one settled web-vital measurement into the capture core as a
 * `web_vital` event. `web-vitals` already buckets the value into a
 * `good` / `needs-improvement` / `poor` rating against the standard thresholds,
 * so the metric maps straight onto {@link WebVitalEvent}.
 *
 * The body is wrapped: a fault in the capture core must not escape into a
 * `web-vitals` callback and from there into the host app.
 */
function reportWebVital(metric: Metric): void {
  try {
    track({
      type: "web_vital",
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
    });
  } catch {
    // Analytics must never crash the host app it measures.
  }
}

/* -------------------------------------------------------------------------- */
/* Navigation Timing                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Read the Navigation Timing entry for this load and record it as a
 * `navigation` breadcrumb. There is no dedicated event for the load waterfall,
 * so the phase breakdown rides along as breadcrumb context (design D10) —
 * available next to whatever event prompts a flush.
 *
 * Never throws: Navigation Timing can be absent or partial, and a fault here
 * must not propagate into a `load` listener.
 */
function captureNavigationTiming(): void {
  try {
    const entries = performance.getEntriesByType("navigation");
    if (entries.length === 0) return;
    const entry = entries[0] as PerformanceNavigationTiming;

    addBreadcrumb({
      category: "navigation",
      message: "navigation-timing",
      data: {
        navigationType: entry.type,
        dnsMs: round1(entry.domainLookupEnd - entry.domainLookupStart),
        connectMs: round1(entry.connectEnd - entry.connectStart),
        ttfbMs: round1(entry.responseStart - entry.requestStart),
        responseMs: round1(entry.responseEnd - entry.responseStart),
        domInteractiveMs: round1(entry.domInteractive),
        domContentLoadedMs: round1(entry.domContentLoadedEventEnd),
        loadEventMs: round1(entry.loadEventEnd),
      },
    });
  } catch {
    // Navigation Timing may be unavailable — never throw into the host app.
  }
}

/**
 * Read the Navigation Timing entry once it is complete. Several of its fields
 * (`loadEventEnd`, `domContentLoadedEventEnd`) are only populated after the
 * `load` event, so the read is deferred until then when the document is still
 * loading.
 */
function recordNavigationTiming(): void {
  if (document.readyState === "complete") {
    captureNavigationTiming();
  } else {
    window.addEventListener("load", captureNavigationTiming, { once: true });
  }
}

/* -------------------------------------------------------------------------- */
/* Install                                                                    */
/* -------------------------------------------------------------------------- */

/** `true` once {@link installPerformanceMonitoring} has wired its listeners. */
let monitoringInstalled = false;

/**
 * Subscribe to the Core Web Vitals and read Navigation Timing. Idempotent — a
 * second call is ignored, so `web-vitals` is never subscribed twice and a
 * metric is never reported twice.
 *
 * `web-vitals` is used with its default `reportAllChanges: false`: every metric
 * fires a single callback carrying its final value. `reportAllChanges: true`
 * is deliberately *not* passed [review #3].
 */
export function installPerformanceMonitoring(): void {
  if (monitoringInstalled) return;
  monitoringInstalled = true;

  // Default behaviour (`reportAllChanges` omitted ⇒ `false`): each metric is
  // delivered once, with its final value. Passing `true` would stream every
  // interim change — avoided on purpose [review #3].
  onLCP(reportWebVital);
  onINP(reportWebVital);
  onCLS(reportWebVital);
  onTTFB(reportWebVital);
  onFCP(reportWebVital);

  recordNavigationTiming();
}

/* -------------------------------------------------------------------------- */
/* Frame health — useFrameHealth()                                            */
/* -------------------------------------------------------------------------- */

/**
 * Capacity of the frame-delta ring buffer: ~300 frames ≈ 5 s at 60 fps. The
 * buffer is a sliding window — once full, the oldest delta is overwritten — so
 * each emitted sample describes the most recent ~5 s of rendering.
 */
const FRAME_RING_CAPACITY = 300;

/** Cadence at which a `frame_health` event is emitted, in ms (~30 s). */
const FRAME_EMIT_INTERVAL_MS = 30_000;

/**
 * Jank threshold, in ms. A frame longer than this overran two 60 fps vsync
 * budgets (2 × 16.67 ms ≈ 33.3 ms) — i.e. the renderer dropped at least one
 * frame. Counted into {@link FrameHealthEvent.jankFrames}.
 */
const JANK_FRAME_MS = 1000 / 30;

/**
 * Mutable per-hook accumulator for the frame sampler. Everything it needs lives
 * here so the per-frame path neither allocates nor closes over fresh objects:
 * the ring buffer is a single pre-sized {@link Float64Array}, and each frame
 * only writes one slot and bumps a few scalars.
 */
interface FrameAccumulator {
  /** Ring buffer of the most recent frame deltas, in ms. */
  readonly deltas: Float64Array;
  /** Index the next delta is written to; wraps at {@link FRAME_RING_CAPACITY}. */
  head: number;
  /** Number of slots filled so far, capped at {@link FRAME_RING_CAPACITY}. */
  count: number;
  /** Frame time accumulated toward the next ~30 s emit, in ms. */
  sinceEmitMs: number;
}

/** Allocate a fresh, empty {@link FrameAccumulator} (called once per hook). */
function createFrameAccumulator(): FrameAccumulator {
  return {
    deltas: new Float64Array(FRAME_RING_CAPACITY),
    head: 0,
    count: 0,
    sinceEmitMs: 0,
  };
}

/**
 * Compute the window statistics from the ring buffer and emit a `frame_health`
 * event. A no-op when no frames have been recorded.
 *
 * The scan is O(N) over the ≤300-slot buffer and runs only on the ~30 s emit
 * cadence (and once on teardown) — never per frame. The first `count` slots are
 * always the valid ones: deltas are written sequentially from index 0, so even
 * a partially-filled buffer is correctly summarised by iterating `0 … count`.
 */
function emitFrameHealth(acc: FrameAccumulator): void {
  if (acc.count === 0) return;

  let sumMs = 0;
  let longestMs = 0;
  let jankFrames = 0;
  for (let i = 0; i < acc.count; i += 1) {
    const delta = acc.deltas[i];
    sumMs += delta;
    if (delta > longestMs) longestMs = delta;
    if (delta > JANK_FRAME_MS) jankFrames += 1;
  }
  const fps = sumMs > 0 ? (acc.count * 1000) / sumMs : 0;

  track({
    type: "frame_health",
    fps: round1(fps),
    longestFrameMs: round1(longestMs),
    jankFrames,
    sampleMs: round1(sumMs),
  });
}

/**
 * Fold one frame delta into the accumulator and emit a `frame_health` event
 * once the ~30 s window has elapsed. O(1) and allocation-free [review #4].
 */
function recordFrameDelta(acc: FrameAccumulator, deltaMs: number): void {
  acc.deltas[acc.head] = deltaMs;
  acc.head = (acc.head + 1) % FRAME_RING_CAPACITY;
  if (acc.count < FRAME_RING_CAPACITY) acc.count += 1;

  acc.sinceEmitMs += deltaMs;
  if (acc.sinceEmitMs >= FRAME_EMIT_INTERVAL_MS) {
    emitFrameHealth(acc);
    acc.sinceEmitMs = 0;
  }
}

/**
 * React hook that samples `@react-three/fiber` render-loop health.
 *
 * Call it from a component mounted inside the `<Canvas>` tree. Every `useFrame`
 * delta is folded into a fixed-size ring buffer (~5 s of frames); roughly every
 * 30 s a `frame_health` event with the window's fps, worst frame and jank count
 * is emitted via the capture core. The per-frame cost is a single typed-array
 * write plus counter updates — O(1), no allocation [review #4].
 *
 * On teardown the final, partial window is flushed so a session that ends
 * mid-cadence still reports its tail.
 */
export function useFrameHealth(): void {
  // Lazily allocated once and held for the hook's lifetime, so the ring buffer
  // is never re-created across renders.
  const accRef = useRef<FrameAccumulator | null>(null);
  if (accRef.current === null) accRef.current = createFrameAccumulator();
  const acc = accRef.current;

  useFrame((_state, delta) => {
    try {
      // `@react-three/fiber` reports `delta` in seconds; the ring stores ms.
      recordFrameDelta(acc, delta * 1000);
    } catch {
      // A sampler fault must never stall the render loop.
    }
  });

  useEffect(() => {
    // Flush whatever is left in the window when the render loop tears down.
    return () => {
      try {
        emitFrameHealth(acc);
      } catch {
        // Analytics must never crash the host app it measures.
      }
    };
  }, [acc]);
}
