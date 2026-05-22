/**
 * Capture core — the module-level analytics singleton.
 *
 * Everything in `src/analytics` funnels through here. This module owns the
 * mutable capture state for one page/app load and exposes the small surface the
 * rest of the app drives it with:
 *
 * - {@link track} — stamp an {@link AnalyticsEvent} and enqueue it. Safe to
 *   call before {@link init}: events fired pre-init are buffered and delivered
 *   once a {@link Sink} is installed.
 * - {@link addBreadcrumb} — append to the breadcrumb ring buffer (design D10),
 *   a sliding window of the most recent ~15 entries kept as context for events.
 * - {@link init} — install the {@link Sink} and arm the flush triggers.
 * - {@link flush} — build the {@link Batch} envelope and deliver it.
 * - {@link shutdown} — detach the triggers and drop pending state (used by
 *   tests and module hot-reload).
 *
 * The flush scheduler (design D9) fires on four triggers: the queue reaching
 * {@link MAX_BATCH_EVENTS}, an idle gap of {@link IDLE_FLUSH_MS} with no new
 * event, the document becoming hidden (`visibilitychange`), and `pagehide`. In
 * the flush path the pending batch is serialized and measured against the
 * ~28 KB soft budget; an over-budget batch first sheds its breadcrumbs and, if
 * still too large, is split into smaller batches before any {@link Sink.send}
 * call [review #1].
 *
 * Resilience contract: nothing here may throw into the host app. A sink that
 * breaks its no-throw promise is caught — analytics must never crash the page
 * it measures.
 *
 * Design reference: §5, decisions D9 / D10, review #1.
 */

import { getSessionRef } from "./identity";
import { checkBatchSize } from "./sink";
import type {
  AnalyticsEvent,
  Batch,
  Breadcrumb,
  FlushReason,
  Sink,
  StampedEvent,
  ViewEvent,
  ViewName,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Tunables                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Wire-format version stamped onto every {@link Batch}. Bumped only when the
 * envelope shape changes; collectors treat it as a forward-compatible range
 * (see `Batch.v` in `./types` and the server contract, review #8).
 */
export const WIRE_VERSION = 1;

/**
 * Size trigger: once the event queue holds this many {@link StampedEvent}s a
 * flush is issued with reason `"size"`. Kept well under the collector's
 * 100-event ceiling so a routine batch never approaches it.
 */
export const MAX_BATCH_EVENTS = 25;

/**
 * Capacity of the breadcrumb ring buffer (design D10). The buffer is a sliding
 * window: once full, the oldest entry is evicted as a new one arrives.
 */
export const MAX_BREADCRUMBS = 15;

/**
 * Idle trigger: a flush is scheduled this many ms after the most recent
 * {@link track} call. Each new event reschedules the timer, so a burst of
 * activity ships as one batch once it settles rather than dribbling out.
 */
export const IDLE_FLUSH_MS = 15_000;

/* -------------------------------------------------------------------------- */
/* Public surface types                                                       */
/* -------------------------------------------------------------------------- */

/** Configuration handed to {@link init}. */
export interface AnalyticsConfig {
  /** Destination every flushed {@link Batch} is delivered to. */
  sink: Sink;
}

/**
 * A breadcrumb as supplied by a caller — every field of {@link Breadcrumb}
 * except `ts`, which {@link addBreadcrumb} stamps at record time.
 */
export type BreadcrumbInput = Omit<Breadcrumb, "ts">;

/* -------------------------------------------------------------------------- */
/* Singleton state                                                            */
/* -------------------------------------------------------------------------- */

/** Installed transport, or `null` until {@link init} runs. */
let sink: Sink | null = null;

/** `true` between {@link init} and {@link shutdown}. */
let initialized = false;

/** The pending event queue. Drained whole on each {@link flush}. */
let events: StampedEvent[] = [];

/** Breadcrumb ring buffer — a sliding window, never drained by a flush. */
let breadcrumbs: Breadcrumb[] = [];

/** Next value for {@link StampedEvent.seq} — monotonic across this load. */
let nextSeq = 0;

/** The view the user is currently in; `null` before the first `view` event. */
let currentView: ViewName | null = null;

/** Epoch ms the current view was entered — the basis for `dwellMs`. */
let lastViewEnteredAt: number | null = null;

/** Handle of the pending idle-flush timer, or `null` when none is armed. */
let idleTimer: ReturnType<typeof setTimeout> | null = null;

/** Installed `visibilitychange` listener, retained so it can be detached. */
let visibilityHandler: (() => void) | null = null;

/** Installed `pagehide` listener, retained so it can be detached. */
let pagehideHandler: (() => void) | null = null;

/* -------------------------------------------------------------------------- */
/* Idle-flush timer                                                           */
/* -------------------------------------------------------------------------- */

/** Cancel the pending idle-flush timer, if one is armed. */
function clearIdleTimer(): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

/**
 * (Re)arm the idle-flush timer. Called after every tracked event, so a steady
 * stream of activity keeps pushing the flush out until things go quiet for
 * {@link IDLE_FLUSH_MS}.
 */
function scheduleIdleFlush(): void {
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    idleTimer = null;
    flush("interval");
  }, IDLE_FLUSH_MS);
}

/* -------------------------------------------------------------------------- */
/* track / addBreadcrumb                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Stitch the cross-event context onto a `view` event: `from` (the view being
 * left) and `dwellMs` (time spent there). The action→event mapper emits these
 * as `null` placeholders because it sees one action in isolation — joining
 * them up needs the capture core's running state. Also advances
 * {@link currentView} / {@link lastViewEnteredAt} to the entered view.
 */
function stitchViewEvent(event: ViewEvent, now: number): ViewEvent {
  const stitched: ViewEvent = {
    ...event,
    from: currentView,
    dwellMs: lastViewEnteredAt === null ? null : now - lastViewEnteredAt,
  };
  currentView = event.name;
  lastViewEnteredAt = now;
  return stitched;
}

/**
 * Record an {@link AnalyticsEvent}. The event is stamped with a sequence
 * number, a timestamp and the active view, then enqueued.
 *
 * Safe to call before {@link init}: pre-init events are simply buffered — the
 * flush triggers come online at `init()`, which then services anything queued.
 * After init, this drives the size and idle flush triggers.
 */
export function track(event: AnalyticsEvent): void {
  const now = Date.now();
  const payload: AnalyticsEvent =
    event.type === "view" ? stitchViewEvent(event, now) : event;

  events.push({ seq: nextSeq++, ts: now, view: currentView, event: payload });

  if (!initialized) return; // buffered — triggers are armed by init()

  if (events.length >= MAX_BATCH_EVENTS) {
    flush("size");
    return;
  }
  scheduleIdleFlush();
}

/**
 * Append a breadcrumb to the ring buffer (design D10), stamping it with the
 * current time. When the buffer is full the oldest entry is evicted, so it
 * always holds the most recent {@link MAX_BREADCRUMBS} entries.
 *
 * Breadcrumbs are debug context, not reporting data; they need no sink and may
 * be recorded before {@link init}.
 */
export function addBreadcrumb(crumb: BreadcrumbInput): void {
  breadcrumbs.push({ ts: Date.now(), ...crumb });
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
}

/* -------------------------------------------------------------------------- */
/* Flush path                                                                 */
/* -------------------------------------------------------------------------- */

/** Assemble a {@link Batch} envelope around a set of events and breadcrumbs. */
function buildBatch(
  batchEvents: StampedEvent[],
  batchBreadcrumbs: Breadcrumb[],
  reason: FlushReason,
): Batch {
  return {
    v: WIRE_VERSION,
    session: getSessionRef(),
    reason,
    sentAt: Date.now(),
    events: batchEvents,
    breadcrumbs: batchBreadcrumbs,
  };
}

/**
 * Deliver a batch, keeping it under the ~28 KB soft byte budget [review #1].
 *
 * The batch is serialized and measured. If it fits — or cannot be measured at
 * all — it goes straight to the sink. If it is over budget, breadcrumbs (cheap,
 * debug-only context) are shed first; if the events alone still overflow, the
 * event list is split in half and each part emitted as its own batch. A lone
 * event that cannot be split is shipped as-is.
 *
 * Recursion terminates: every step either drops the breadcrumbs (once) or
 * halves the event count, bottoming out at a single event.
 */
function emitBatch(
  batchEvents: StampedEvent[],
  batchBreadcrumbs: Breadcrumb[],
  reason: FlushReason,
  dest: Sink,
): void {
  const batch = buildBatch(batchEvents, batchBreadcrumbs, reason);

  let serialized: string | null;
  try {
    serialized = JSON.stringify(batch);
  } catch {
    serialized = null; // unserializable — let the sink make the same call
  }

  if (serialized === null || !checkBatchSize(serialized).overBudget) {
    dest.send(batch);
    return;
  }

  // Over the soft budget. Breadcrumbs are the cheapest payload to lose, so
  // shed them before splitting the events themselves.
  if (batchBreadcrumbs.length > 0) {
    emitBatch(batchEvents, [], reason, dest);
    return;
  }

  // Breadcrumbs already gone and the events alone still overflow.
  if (batchEvents.length <= 1) {
    dest.send(batch); // a single event cannot be split — ship it anyway
    return;
  }
  const mid = Math.ceil(batchEvents.length / 2);
  emitBatch(batchEvents.slice(0, mid), [], reason, dest);
  emitBatch(batchEvents.slice(mid), [], reason, dest);
}

/**
 * Flush the pending events as a {@link Batch}.
 *
 * A no-op when there is nothing to deliver: before {@link init} (no sink yet —
 * events stay buffered) or when the queue is empty. The event queue is drained;
 * the breadcrumb ring buffer is *not* — it is a sliding window snapshotted into
 * each batch as context.
 *
 * Never throws: a misbehaving sink is caught here so analytics cannot crash the
 * host app.
 */
export function flush(reason: FlushReason = "manual"): void {
  clearIdleTimer();

  if (!initialized || sink === null) return; // pre-init — keep events buffered
  if (events.length === 0) return; // nothing worth a batch

  const pending = events;
  events = [];
  try {
    emitBatch(pending, breadcrumbs.slice(), reason, sink);
  } catch {
    // A sink that throws despite the no-throw contract must not take the host
    // app down with it — swallow and carry on.
  }
}

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Initialize the capture core: install the {@link Sink} and arm the flush
 * triggers (design D9). Idempotent — a second call is ignored, so the triggers
 * are never double-bound.
 *
 * Any events tracked before this call were buffered; `init()` services them
 * immediately, flushing on the spot if the queue is already full and otherwise
 * arming the idle timer.
 */
export function init(config: AnalyticsConfig): void {
  if (initialized) return;

  sink = config.sink;
  initialized = true;

  visibilityHandler = () => {
    if (document.visibilityState === "hidden") flush("visibilitychange");
  };
  pagehideHandler = () => {
    flush("pagehide");
  };
  document.addEventListener("visibilitychange", visibilityHandler);
  window.addEventListener("pagehide", pagehideHandler);

  // Service anything buffered before init.
  if (events.length >= MAX_BATCH_EVENTS) flush("size");
  else if (events.length > 0) scheduleIdleFlush();
}

/**
 * Detach every flush trigger and discard all pending state *without* delivering
 * it. Intended for tests and module hot-reload — a normal page load owns the
 * singleton for its whole lifetime and never needs this. Call {@link flush}
 * first if buffered events should still be sent.
 */
export function shutdown(): void {
  clearIdleTimer();

  if (visibilityHandler !== null) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = null;
  }
  if (pagehideHandler !== null) {
    window.removeEventListener("pagehide", pagehideHandler);
    pagehideHandler = null;
  }

  events = [];
  breadcrumbs = [];
  nextSeq = 0;
  currentView = null;
  lastViewEnteredAt = null;
  sink = null;
  initialized = false;
}
