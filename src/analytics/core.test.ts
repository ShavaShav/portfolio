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
} from "./core";
import type { AnalyticsEvent, Batch, Sink, ViewName } from "./types";

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

/** A bare `view` event — `from` / `dwellMs` are stitched on by the core. */
function viewEvent(name: ViewName): AnalyticsEvent {
  return { type: "view", name, from: null, dwellMs: null };
}

/** An `interaction` event, optionally carrying a large `detail` payload. */
function interaction(detail?: string): AnalyticsEvent {
  return detail === undefined
    ? { type: "interaction", action: "click", target: "btn" }
    : { type: "interaction", action: "click", target: "btn", detail };
}

/** Override `document.visibilityState` for the current test. */
function stubVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
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
  it("expose the documented flush thresholds", () => {
    expect(WIRE_VERSION).toBe(1);
    expect(MAX_BATCH_EVENTS).toBe(25);
    expect(MAX_BREADCRUMBS).toBe(15);
    expect(IDLE_FLUSH_MS).toBe(15_000);
  });
});

/* -------------------------------------------------------------------------- */
/* track() — buffering & stamping                                             */
/* -------------------------------------------------------------------------- */

describe("track", () => {
  it("buffers events fired before init() and delivers them after", () => {
    track(interaction());
    track(interaction());

    const sink = recordingSink();
    expect(sink.sent).toHaveLength(0); // nothing ships before init

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

  it("stamps each event with a capture timestamp", () => {
    const sink = recordingSink();
    init({ sink });
    track(interaction());
    flush("manual");

    expect(sink.sent[0].events[0].ts).toBe(Date.now());
  });
});

/* -------------------------------------------------------------------------- */
/* Flush trigger — size                                                       */
/* -------------------------------------------------------------------------- */

describe("size trigger", () => {
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

  it("services a pre-init buffer that is already full at init()", () => {
    for (let i = 0; i < MAX_BATCH_EVENTS; i++) track(interaction());

    const sink = recordingSink();
    init({ sink });

    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0].reason).toBe("size");
  });
});

/* -------------------------------------------------------------------------- */
/* Flush trigger — idle timer                                                 */
/* -------------------------------------------------------------------------- */

describe("idle trigger", () => {
  it("flushes after IDLE_FLUSH_MS of inactivity", () => {
    const sink = recordingSink();
    init({ sink });
    track(interaction());

    expect(sink.sent).toHaveLength(0);
    vi.advanceTimersByTime(IDLE_FLUSH_MS);

    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0].reason).toBe("interval");
  });

  it("reschedules the timer on each new event (debounce)", () => {
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
/* Flush trigger — visibilitychange & pagehide                                */
/* -------------------------------------------------------------------------- */

describe("visibilitychange trigger", () => {
  it("flushes when the document becomes hidden", () => {
    const sink = recordingSink();
    init({ sink });
    track(interaction());

    stubVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0].reason).toBe("visibilitychange");
  });

  it("does not flush when the document is still visible", () => {
    const sink = recordingSink();
    init({ sink });
    track(interaction());

    stubVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(sink.sent).toHaveLength(0);
  });
});

describe("pagehide trigger", () => {
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
/* Breadcrumbs                                                                */
/* -------------------------------------------------------------------------- */

describe("addBreadcrumb", () => {
  it("caps the ring buffer at MAX_BREADCRUMBS, keeping the newest", () => {
    const sink = recordingSink();
    init({ sink });
    for (let i = 0; i < MAX_BREADCRUMBS + 5; i++) {
      addBreadcrumb({ category: "ui", message: String(i) });
    }
    track(interaction());
    flush("manual");

    const crumbs = sink.sent[0].breadcrumbs;
    expect(crumbs).toHaveLength(MAX_BREADCRUMBS);
    // The five oldest (0..4) were evicted; 5..19 remain.
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

  it("keeps breadcrumbs as a sliding window across flushes", () => {
    const sink = recordingSink();
    init({ sink });
    addBreadcrumb({ category: "ui", message: "a" });

    track(interaction());
    flush("manual");
    track(interaction());
    flush("manual");

    // The ring buffer is not drained by a flush — both batches carry it.
    expect(sink.sent[0].breadcrumbs).toHaveLength(1);
    expect(sink.sent[1].breadcrumbs).toHaveLength(1);
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

  it("is a no-op before init() and leaves events buffered", () => {
    track(interaction());
    flush("manual"); // no sink yet — must not lose the event

    const sink = recordingSink();
    init({ sink });
    flush("manual");

    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0].events).toHaveLength(1);
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

  it("builds a well-formed batch envelope", () => {
    const sink = recordingSink();
    init({ sink });
    track(interaction());
    flush("manual");

    const batch = sink.sent[0];
    expect(batch.v).toBe(WIRE_VERSION);
    expect(typeof batch.session.id).toBe("string");
    expect(typeof batch.session.loadId).toBe("string");
    expect(batch.sentAt).toBe(Date.now());
    expect(batch.reason).toBe("manual");
    expect(Array.isArray(batch.events)).toBe(true);
    expect(Array.isArray(batch.breadcrumbs)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Byte-budget guard [review #1]                                              */
/* -------------------------------------------------------------------------- */

describe("byte-budget guard [review #1]", () => {
  it("sheds breadcrumbs from an over-budget batch before sending", () => {
    const sink = recordingSink();
    init({ sink });
    // Breadcrumbs alone push the batch past the ~28 KB budget.
    for (let i = 0; i < MAX_BREADCRUMBS; i++) {
      addBreadcrumb({ category: "ui", message: "x".repeat(3_000) });
    }
    track(interaction()); // one small event
    flush("manual");

    expect(sink.sent).toHaveLength(1);
    expect(sink.sent[0].breadcrumbs).toEqual([]);
    expect(sink.sent[0].events).toHaveLength(1);
  });

  it("splits an over-budget batch whose events alone overflow", () => {
    const sink = recordingSink();
    init({ sink });
    // 14 fat events well over the ~28 KB budget, no breadcrumbs.
    const total = 14;
    for (let i = 0; i < total; i++) track(interaction("y".repeat(3_000)));
    flush("manual");

    expect(sink.sent.length).toBeGreaterThan(1);

    const delivered = sink.sent.flatMap((b) => b.events);
    expect(delivered).toHaveLength(total);
    expect(delivered.map((e) => e.seq).sort((a, b) => a - b)).toEqual(
      Array.from({ length: total }, (_, i) => i),
    );
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
    expect(first.event).toMatchObject({ from: null, dwellMs: null });
    expect(second.event).toMatchObject({
      from: "terminal",
      dwellMs: 5_000,
    });
  });

  it("records the active view on each StampedEvent", () => {
    const sink = recordingSink();
    init({ sink });

    track(interaction()); // before any view
    track(viewEvent("terminal"));
    track(interaction()); // inside the terminal view
    flush("manual");

    const views = sink.sent[0].events.map((e) => e.view);
    expect(views).toEqual([null, "terminal", "terminal"]);
  });
});

/* -------------------------------------------------------------------------- */
/* Lifecycle — init & shutdown                                                */
/* -------------------------------------------------------------------------- */

describe("init", () => {
  it("is idempotent — a second call neither rebinds nor swaps the sink", () => {
    const first = recordingSink();
    const second = recordingSink();
    init({ sink: first });
    init({ sink: second }); // ignored

    track(interaction());
    window.dispatchEvent(new Event("pagehide"));

    expect(first.sent).toHaveLength(1); // single listener, original sink
    expect(second.sent).toHaveLength(0);
  });
});

describe("shutdown", () => {
  it("detaches the flush triggers", () => {
    const sink = recordingSink();
    init({ sink });
    shutdown();

    init({ sink: recordingSink() }); // re-init so a later track() is armed
    // The triggers from the first init must no longer be attached.
    window.dispatchEvent(new Event("pagehide"));
    stubVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(sink.sent).toHaveLength(0);
  });

  it("discards pending events and resets the seq counter", () => {
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
