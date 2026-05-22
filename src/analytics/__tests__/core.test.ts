/**
 * Unit tests for the capture core (design §14.8): the batching / flush state
 * machine (the four flush triggers — size, idle, `visibilitychange`,
 * `pagehide`), the {@link Batch} envelope builder, and the ~28 KB byte-budget
 * split [review #1].
 *
 * The core owns module-level singleton state for one app load, so every test
 * arms fake timers up front, pins the clock, and tears the singleton down with
 * {@link shutdown} afterwards — keeping each case independent.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  IDLE_FLUSH_MS,
  MAX_BATCH_EVENTS,
  MAX_BREADCRUMBS,
  WIRE_VERSION,
  addBreadcrumb,
  flush,
  init,
  shutdown,
  track,
} from "../core";
import type { AnalyticsEvent, Batch, Sink, ViewName } from "../types";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** A {@link Sink} that keeps every batch it is handed for later inspection. */
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

/** An `interaction` event, optionally carrying a large `detail` payload. */
function interaction(detail?: string): AnalyticsEvent {
  return detail === undefined
    ? { type: "interaction", action: "click", target: "cta" }
    : { type: "interaction", action: "click", target: "cta", detail };
}

/** A bare `view` event — `from` / `dwellMs` are stitched on by the core. */
function viewEvent(name: ViewName): AnalyticsEvent {
  return { type: "view", name, from: null, dwellMs: null };
}

/** Override `document.visibilityState` for the current test. */
function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-22T00:00:00Z"));
});

afterEach(() => {
  shutdown();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "visibilityState");
});

/* -------------------------------------------------------------------------- */
/* Tunables                                                                   */
/* -------------------------------------------------------------------------- */

describe("tunables", () => {
  it("expose the documented wire version and flush thresholds", () => {
    expect(WIRE_VERSION).toBe(1);
    expect(MAX_BATCH_EVENTS).toBe(25);
    expect(MAX_BREADCRUMBS).toBe(15);
    expect(IDLE_FLUSH_MS).toBe(15_000);
  });
});

/* -------------------------------------------------------------------------- */
/* track — stamping & pre-init buffering                                      */
/* -------------------------------------------------------------------------- */

describe("track — stamping & pre-init buffering", () => {
  it("buffers events fired before init() and delivers them afterwards", () => {
    track(interaction());
    track(interaction());

    const sink = recordingSink();
    expect(sink.sent).toHaveLength(0); // nothing ships without a sink

    init({ sink });
    flush("manual");

    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0].events).toHaveLength(2);
  });

  it("stamps events with a per-load monotonic seq starting at 0", () => {
    const sink = recordingSink();
    init({ sink });
    track(interaction());
    track(interaction());
    track(interaction());
    flush("manual");

    expect(sink.sent[0].events.map((e) => e.seq)).toEqual([0, 1, 2]);
  });

  it("stamps each event with the capture timestamp", () => {
    const sink = recordingSink();
    init({ sink });
    track(interaction());
    flush("manual");

    expect(sink.sent[0].events[0].ts).toBe(Date.now());
  });

  it("records the active view on each stamped event", () => {
    const sink = recordingSink();
    init({ sink });
    track(interaction()); // before any view
    track(viewEvent("terminal"));
    track(interaction()); // inside the terminal view
    flush("manual");

    expect(sink.sent[0].events.map((e) => e.view)).toEqual([
      null,
      "terminal",
      "terminal",
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* Flush state machine — size trigger                                         */
/* -------------------------------------------------------------------------- */

describe("flush state machine — size trigger", () => {
  it("flushes once the queue reaches MAX_BATCH_EVENTS", () => {
    const sink = recordingSink();
    init({ sink });
    for (let i = 0; i < MAX_BATCH_EVENTS; i++) track(interaction());

    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0].reason).toBe("size");
    expect(sink.sent[0].events).toHaveLength(MAX_BATCH_EVENTS);
  });

  it("does not flush while the queue is below MAX_BATCH_EVENTS", () => {
    const sink = recordingSink();
    init({ sink });
    for (let i = 0; i < MAX_BATCH_EVENTS - 1; i++) track(interaction());

    expect(sink.sent).toHaveLength(0);
  });

  it("services a pre-init buffer already full when init() runs", () => {
    for (let i = 0; i < MAX_BATCH_EVENTS; i++) track(interaction());

    const sink = recordingSink();
    init({ sink });

    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0].reason).toBe("size");
  });
});

/* -------------------------------------------------------------------------- */
/* Flush state machine — idle trigger                                         */
/* -------------------------------------------------------------------------- */

describe("flush state machine — idle trigger", () => {
  it("flushes after IDLE_FLUSH_MS of inactivity with reason interval", () => {
    const sink = recordingSink();
    init({ sink });
    track(interaction());

    expect(sink.sent).toHaveLength(0);
    vi.advanceTimersByTime(IDLE_FLUSH_MS);

    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0].reason).toBe("interval");
  });

  it("reschedules the idle timer on every new event (debounce)", () => {
    const sink = recordingSink();
    init({ sink });

    track(interaction());
    vi.advanceTimersByTime(IDLE_FLUSH_MS - 1_000);
    track(interaction()); // resets the idle window

    vi.advanceTimersByTime(IDLE_FLUSH_MS - 1_000);
    expect(sink.sent).toHaveLength(0); // not idle long enough yet

    vi.advanceTimersByTime(1_000);
    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0].events).toHaveLength(2);
  });
});

/* -------------------------------------------------------------------------- */
/* Flush state machine — visibilitychange & pagehide                          */
/* -------------------------------------------------------------------------- */

describe("flush state machine — visibilitychange & pagehide", () => {
  it("flushes when the document becomes hidden", () => {
    const sink = recordingSink();
    init({ sink });
    track(interaction());

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0].reason).toBe("visibilitychange");
  });

  it("does not flush while the document is still visible", () => {
    const sink = recordingSink();
    init({ sink });
    track(interaction());

    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(sink.sent).toHaveLength(0);
  });

  it("flushes on pagehide", () => {
    const sink = recordingSink();
    init({ sink });
    track(interaction());

    window.dispatchEvent(new Event("pagehide"));

    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0].reason).toBe("pagehide");
  });
});

/* -------------------------------------------------------------------------- */
/* flush()                                                                    */
/* -------------------------------------------------------------------------- */

describe("flush", () => {
  it("is a no-op when there are no pending events", () => {
    const sink = recordingSink();
    init({ sink });
    flush("manual");

    expect(sink.sent).toHaveLength(0);
  });

  it("is a no-op before init() and keeps events buffered", () => {
    track(interaction());
    flush("manual"); // no sink yet — must not drop the event

    const sink = recordingSink();
    init({ sink });
    flush("manual");

    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0].events).toHaveLength(1);
  });

  it("drains the queue — a second flush ships nothing", () => {
    const sink = recordingSink();
    init({ sink });
    track(interaction());

    flush("manual");
    flush("manual");

    expect(sink.sent).toHaveLength(1);
  });

  it("never throws when the sink throws", () => {
    const throwingSink: Sink = {
      name: "throwing",
      send: () => {
        throw new Error("sink boom");
      },
    };
    init({ sink: throwingSink });
    track(interaction());

    expect(() => flush("manual")).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* Envelope builder                                                           */
/* -------------------------------------------------------------------------- */

describe("envelope builder", () => {
  it("assembles a well-formed Batch envelope", () => {
    const sink = recordingSink();
    init({ sink });
    track(interaction());
    flush("manual");

    const batch = sink.sent[0];
    expect(batch.v).toBe(WIRE_VERSION);
    expect(typeof batch.session.id).toBe("string");
    expect(typeof batch.session.loadId).toBe("string");
    expect(batch.sentAt).toBe(Date.now());
    expect(Array.isArray(batch.events)).toBe(true);
    expect(Array.isArray(batch.breadcrumbs)).toBe(true);
  });

  it("stamps each batch with the trigger that produced it", () => {
    const sink = recordingSink();
    init({ sink });

    track(interaction());
    flush("error");
    expect(sink.sent[0].reason).toBe("error");

    track(interaction());
    window.dispatchEvent(new Event("pagehide"));
    expect(sink.sent[1].reason).toBe("pagehide");
  });
});

/* -------------------------------------------------------------------------- */
/* Byte-budget split [review #1]                                              */
/* -------------------------------------------------------------------------- */

describe("byte-budget split [review #1]", () => {
  it("sheds breadcrumbs from an over-budget batch before sending", () => {
    const sink = recordingSink();
    init({ sink });
    // Breadcrumbs alone push the batch well past the ~28 KB budget.
    for (let i = 0; i < MAX_BREADCRUMBS; i++) {
      addBreadcrumb({ category: "ui", message: "x".repeat(3_000) });
    }
    track(interaction()); // one small event
    flush("manual");

    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0].breadcrumbs).toEqual([]);
    expect(sink.sent[0].events).toHaveLength(1);
  });

  it("splits an over-budget event list, delivering each event exactly once", () => {
    const sink = recordingSink();
    init({ sink });
    // 12 fat events far over the ~28 KB budget, no breadcrumbs.
    const total = 12;
    for (let i = 0; i < total; i++) track(interaction("q".repeat(4_000)));
    flush("manual");

    expect(sink.sent.length).toBeGreaterThan(1);

    const delivered = sink.sent.flatMap((b) => b.events);
    expect(delivered).toHaveLength(total);
    expect(delivered.map((e) => e.seq).sort((a, b) => a - b)).toEqual(
      Array.from({ length: total }, (_, i) => i),
    );
  });

  it("ships a single over-budget event as-is when it cannot be split", () => {
    const sink = recordingSink();
    init({ sink });
    track(interaction("z".repeat(30_000))); // one event over the budget alone
    flush("manual");

    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0].events).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Breadcrumb ring buffer [design D10]                                        */
/* -------------------------------------------------------------------------- */

describe("breadcrumb ring buffer [design D10]", () => {
  it("caps the buffer at MAX_BREADCRUMBS, keeping the newest entries", () => {
    const sink = recordingSink();
    init({ sink });
    for (let i = 0; i < MAX_BREADCRUMBS + 5; i++) {
      addBreadcrumb({ category: "ui", message: String(i) });
    }
    track(interaction());
    flush("manual");

    const crumbs = sink.sent[0].breadcrumbs;
    expect(crumbs).toHaveLength(MAX_BREADCRUMBS);
    // The five oldest (0..4) were evicted; 5..19 remain in order.
    expect(crumbs[0].message).toBe("5");
    expect(crumbs[crumbs.length - 1].message).toBe(String(MAX_BREADCRUMBS + 4));
  });

  it("stamps a timestamp and carries category, message and data", () => {
    const sink = recordingSink();
    init({ sink });
    addBreadcrumb({ category: "network", message: "fetch", data: { ok: 1 } });
    track(interaction());
    flush("manual");

    const crumb = sink.sent[0].breadcrumbs[0];
    expect(crumb.ts).toBe(Date.now());
    expect(crumb.category).toBe("network");
    expect(crumb.message).toBe("fetch");
    expect(crumb.data).toEqual({ ok: 1 });
  });

  it("is a sliding window — not drained by a flush", () => {
    const sink = recordingSink();
    init({ sink });
    addBreadcrumb({ category: "ui", message: "a" });

    track(interaction());
    flush("manual");
    track(interaction());
    flush("manual");

    // Both batches carry the breadcrumb; the flush never drains the buffer.
    expect(sink.sent[0].breadcrumbs).toHaveLength(1);
    expect(sink.sent[1].breadcrumbs).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/* View stitching                                                             */
/* -------------------------------------------------------------------------- */

describe("view stitching", () => {
  it("stitches `from` and `dwellMs` across navigations", () => {
    const sink = recordingSink();
    init({ sink });

    track(viewEvent("terminal"));
    vi.advanceTimersByTime(5_000);
    track(viewEvent("solar_system"));
    flush("manual");

    const [first, second] = sink.sent[0].events;
    // First view of the load: nothing preceded it.
    expect(first.event).toMatchObject({ from: null, dwellMs: null });
    // Second view: stitched with the prior view and the dwell on it.
    expect(second.event).toMatchObject({ from: "terminal", dwellMs: 5_000 });
  });
});

/* -------------------------------------------------------------------------- */
/* Lifecycle — init & shutdown                                                */
/* -------------------------------------------------------------------------- */

describe("lifecycle — init & shutdown", () => {
  it("init is idempotent — a second call neither rebinds nor swaps the sink", () => {
    const first = recordingSink();
    const second = recordingSink();
    init({ sink: first });
    init({ sink: second }); // ignored

    track(interaction());
    window.dispatchEvent(new Event("pagehide"));

    expect(first.sent).toHaveLength(1); // single listener, original sink
    expect(second.sent).toHaveLength(0);
  });

  it("shutdown detaches every flush trigger", () => {
    const sink = recordingSink();
    init({ sink });
    track(interaction());
    shutdown();

    // Triggers from the first init must no longer be attached.
    window.dispatchEvent(new Event("pagehide"));
    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(IDLE_FLUSH_MS);

    expect(sink.sent).toHaveLength(0);
  });

  it("shutdown discards pending events and resets the seq counter", () => {
    const sink = recordingSink();
    init({ sink });
    track(interaction());
    shutdown();

    init({ sink });
    track(interaction());
    flush("manual");

    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0].events).toHaveLength(1);
    expect(sink.sent[0].events[0].seq).toBe(0); // counter reset by shutdown
  });
});
