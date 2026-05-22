/**
 * Capture-layer vocabulary and wire-format contracts for analytics.
 *
 * This module is intentionally **pure types** — no runtime code, no imports.
 * It defines the shared shapes used by every other file in `src/analytics`:
 * the events callers emit ({@link AnalyticsEvent}), the stamped form the
 * buffer stores ({@link StampedEvent}), the {@link Batch} envelope a
 * {@link Sink} ships, and the supporting vocabulary ({@link ViewName},
 * {@link Json}, {@link Breadcrumb}, {@link FlushReason}).
 *
 * Design reference: §5.1–5.4.
 */

/* -------------------------------------------------------------------------- */
/* §5.1 — Core vocabulary                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Logical view the user can be looking at. These mirror the app's top-level
 * view state machine (see `AppView` in `src/state/AppState.tsx`) in a
 * normalized, snake_case form suitable for a wire format.
 *
 * Kept as a string-literal union (not a TS `enum`) so the type erases
 * completely and adds zero runtime weight.
 */
export type ViewName =
  | "terminal"
  | "solar_system"
  | "flying_to_planet"
  | "planet_detail"
  | "mission"
  | "flying_home";

/**
 * Any value that survives a `JSON.stringify` / `JSON.parse` round-trip.
 * Used for free-form, caller-supplied payloads (e.g. {@link Breadcrumb.data}
 * and {@link InteractionEvent.detail}). The capture layer never inspects the
 * inner shape — it only guarantees serializability.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

/* -------------------------------------------------------------------------- */
/* §5.2 — AnalyticsEvent discriminated union                                  */
/* -------------------------------------------------------------------------- */

/**
 * The set of discriminant tags for {@link AnalyticsEvent}. Each value
 * corresponds to exactly one member interface of the union.
 */
export type EventType =
  | "view"
  | "interaction"
  | "link"
  | "error"
  | "web_vital"
  | "frame_health"
  | "api_call";

/** A navigation into a {@link ViewName}. */
export interface ViewEvent {
  type: "view";
  /** The view being entered. */
  name: ViewName;
  /** The view navigated away from; `null` on the first view of a load. */
  from: ViewName | null;
  /**
   * Wall-clock ms the user spent on `from` before this navigation.
   * `null` for the first view of a load (nothing preceded it).
   */
  dwellMs: number | null;
}

/** A discrete UI interaction — a click, hover, key press, submit, etc. */
export interface InteractionEvent {
  type: "interaction";
  /** Verb describing what happened, e.g. `"click"`, `"hover"`, `"submit"`. */
  action: string;
  /** Stable identifier of the element or control acted upon. */
  target: string;
  /** Optional structured detail (coordinates, form values, …). */
  detail?: Json;
}

/** A link activation, whether it stays on-origin or leaves it. */
export interface LinkEvent {
  type: "link";
  /** Destination URL. */
  href: string;
  /** `true` when the link navigates away from the current origin. */
  external: boolean;
  /** Human-facing label / accessible name of the link, when known. */
  label?: string;
}

/** A captured error or unhandled rejection. */
export interface ErrorEvent {
  type: "error";
  /** Error message — already scrubbed of PII by the capture layer. */
  message: string;
  /** Stack trace, when one is available. */
  stack?: string;
  /** Where the error surfaced. */
  source: "window" | "promise" | "react" | "manual";
  /** `true` when the error broke the experience for the user. */
  fatal: boolean;
}

/** A Core Web Vital (or related load metric) measurement. */
export interface WebVitalEvent {
  type: "web_vital";
  /** Metric name, per the `web-vitals` vocabulary. */
  metric: "CLS" | "FCP" | "INP" | "LCP" | "TTFB";
  /** Value in the metric's native unit (ms; unitless for `CLS`). */
  value: number;
  /** Bucketed quality rating per standard web-vitals thresholds. */
  rating: "good" | "needs-improvement" | "poor";
}

/**
 * A periodic sample of rendering performance. Relevant for this WebGL /
 * Three.js app, where frame pacing matters more than page load alone.
 */
export interface FrameHealthEvent {
  type: "frame_health";
  /** Mean frames-per-second over the sampling window. */
  fps: number;
  /** Longest single frame time (ms) in the window — the jank peak. */
  longestFrameMs: number;
  /** Number of frames in the window that exceeded the jank budget. */
  jankFrames: number;
  /** Length of the sampling window, in ms. */
  sampleMs: number;
}

/** The outcome of an outbound API / network request. */
export interface ApiCallEvent {
  type: "api_call";
  /** Request endpoint path, with any query string stripped. */
  endpoint: string;
  /** HTTP method, uppercased (`"GET"`, `"POST"`, …). */
  method: string;
  /** HTTP status code; `0` when the request never completed. */
  status: number;
  /** Round-trip duration, in ms. */
  durationMs: number;
  /** `true` for a 2xx response. */
  ok: boolean;
}

/**
 * A single thing worth recording, as emitted by a caller. This is the
 * "raw" payload: it carries no timestamp or session context — that
 * metadata is attached later by the buffer (see {@link StampedEvent}).
 *
 * Discriminated on `type`; narrow with a `switch (event.type)`.
 */
export type AnalyticsEvent =
  | ViewEvent
  | InteractionEvent
  | LinkEvent
  | ErrorEvent
  | WebVitalEvent
  | FrameHealthEvent
  | ApiCallEvent;

/* -------------------------------------------------------------------------- */
/* §5.3 — Breadcrumb & StampedEvent                                           */
/* -------------------------------------------------------------------------- */

/**
 * A lightweight trail entry recorded alongside events to give later
 * analysis context (the actions leading up to an error, for instance).
 * Breadcrumbs are cheap and high-volume; they are not {@link AnalyticsEvent}s.
 */
export interface Breadcrumb {
  /** Epoch ms when the breadcrumb was recorded. */
  ts: number;
  /** Coarse grouping, e.g. `"navigation"`, `"ui"`, `"network"`, `"console"`. */
  category: string;
  /** Short, human-readable description. */
  message: string;
  /** Optional structured payload. */
  data?: Json;
}

/**
 * An {@link AnalyticsEvent} after the buffer has stamped it with capture-time
 * metadata. This is the unit stored in the buffer and shipped inside a
 * {@link Batch}.
 */
export interface StampedEvent {
  /**
   * Monotonically increasing sequence number, unique within a single load.
   * Lets a collector order events even when timestamps collide or the
   * client clock is unreliable.
   */
  seq: number;
  /** Epoch ms at capture time. */
  ts: number;
  /** The active view when the event was captured; `null` before the first. */
  view: ViewName | null;
  /** The raw event payload. */
  event: AnalyticsEvent;
}

/* -------------------------------------------------------------------------- */
/* §5.4 — Batch envelope, FlushReason & Sink                                  */
/* -------------------------------------------------------------------------- */

/**
 * Producer identity attached to every {@link Batch}.
 *
 * The two ids form a **hierarchy** — `id` sits above `loadId` [review #10]:
 *
 * - {@link SessionRef.id} is the long-lived **session** identifier. It
 *   persists across page reloads and in-app navigations within one browsing
 *   session (e.g. backed by `sessionStorage`). One `id` therefore spans many
 *   `loadId`s.
 * - {@link SessionRef.loadId} is the per-**load** identifier. A fresh
 *   `loadId` is minted on every page / app load, so each `loadId` belongs to
 *   exactly one `id`, and a single `id` fans out to one-or-more `loadId`s.
 *
 * Group events by `loadId` to reason about a single page lifetime; group by
 * `id` to stitch a whole visit together across reloads.
 */
export interface SessionRef {
  /**
   * Stable session id — the **top** of the identity hierarchy. Survives
   * reloads; spans many {@link SessionRef.loadId} values.
   */
  id: string;
  /**
   * Per-load id — sits **below** {@link SessionRef.id}. Unique to one page /
   * app load; belongs to exactly one `id`.
   */
  loadId: string;
}

/**
 * Why a {@link Batch} was flushed. Useful for collectors to distinguish
 * routine delivery from end-of-session "last chance" sends.
 */
export type FlushReason =
  /** A periodic flush timer fired. */
  | "interval"
  /** The buffer reached its maximum batch size. */
  | "size"
  /** The document became hidden (`visibilitychange`). */
  | "visibilitychange"
  /** The page is being unloaded (`pagehide`). */
  | "pagehide"
  /** An explicit `flush()` call. */
  | "manual"
  /** Flushed eagerly to ship an error without waiting for the interval. */
  | "error";

/**
 * The on-the-wire envelope: a group of {@link StampedEvent}s plus the
 * context a collector needs to attribute and order them.
 */
export interface Batch {
  /**
   * Wire-format version.
   *
   * Consumers MUST treat `v` as a **forward-compatible range**, not a value
   * to match for strict equality [review #8]: accept any `v` within the
   * range they understand and ignore unknown fields, rather than rejecting a
   * batch whose `v` differs from a single expected number. This lets
   * producers add fields and bump `v` without breaking older collectors.
   */
  v: number;
  /** Identity of the producing client. See {@link SessionRef}. */
  session: SessionRef;
  /** Why this batch was flushed. */
  reason: FlushReason;
  /** Epoch ms when the batch left the client. */
  sentAt: number;
  /** The captured events, in capture order. */
  events: StampedEvent[];
  /** Recent breadcrumb trail providing context for `events`. */
  breadcrumbs: Breadcrumb[];
}

/**
 * A destination a {@link Batch} can be delivered to (HTTP endpoint, the
 * `navigator.sendBeacon` transport, the console for local dev, …).
 *
 * Implementations should be resilient: `send` must never throw into the host
 * application — transport failures are observed/swallowed internally so that
 * analytics can never crash the page it is measuring.
 */
export interface Sink {
  /** Stable name for diagnostics / logging, e.g. `"beacon"`, `"console"`. */
  readonly name: string;
  /**
   * Deliver a batch to this sink. May be synchronous or asynchronous; a
   * returned promise resolves once delivery is attempted (it does not
   * reject on transport failure).
   */
  send(batch: Batch): void | Promise<void>;
}
