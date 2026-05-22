import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { trackApiCall } from "./apiTracking";
import { flush, init, shutdown } from "./core";
import type { ApiCallEvent, Batch, Sink, StampedEvent } from "./types";

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

/** Every `api_call` event across all batches a sink received. */
function apiCallEvents(sink: RecordingSink): ApiCallEvent[] {
  return sink.sent
    .flatMap((b: Batch) => b.events)
    .map((s: StampedEvent) => s.event)
    .filter((e): e is ApiCallEvent => e.type === "api_call");
}

/** A streaming `Response` that emits `chunks` as body bytes, then closes. */
function streamResponse(chunks: string[], status = 200): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(enc.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status });
}

/**
 * A `Response` whose body yields one chunk and then errors with `error` —
 * a genuine mid-stream failure (the first `read()` succeeds, the next rejects).
 * Driven from `pull` because `controller.error()` resets the queue, so an
 * already-enqueued chunk would otherwise be discarded undelivered.
 */
function erroringStream(firstChunk: string, error: unknown): Response {
  const enc = new TextEncoder();
  let pulls = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      if (pulls === 1) controller.enqueue(enc.encode(firstChunk));
      else controller.error(error);
    },
  });
  return new Response(body, { status: 200 });
}

/** A `fetch` stand-in that resolves to `response`. */
function fetchReturning(response: Response): typeof fetch {
  return (async () => response) as unknown as typeof fetch;
}

/** A `fetch` stand-in that rejects with `err`. */
function fetchRejecting(err: unknown): typeof fetch {
  return (async () => {
    throw err;
  }) as unknown as typeof fetch;
}

/**
 * Replace `performance.now` with a monotonic clock that advances `step` ms on
 * every reading. Strictly increasing, so any two readings are distinct and
 * ordered regardless of how many times `performance.now` is consulted.
 */
function mockClock(step = 10): void {
  let t = 0;
  vi.spyOn(performance, "now").mockImplementation(() => (t += step));
}

beforeEach(() => {
  shutdown();
});

afterEach(() => {
  shutdown();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* Outcome classification (design C11)                                        */
/* -------------------------------------------------------------------------- */

describe("outcome classification", () => {
  it("classifies a drained 2xx stream as 'ok'", async () => {
    const result = await trackApiCall("/api/chat", undefined, {
      fetchImpl: fetchReturning(streamResponse(["hello"])),
    });
    expect(result.outcome).toBe("ok");
    expect(result.status).toBe(200);
  });

  it("classifies a non-2xx response as 'http_error'", async () => {
    const result = await trackApiCall("/api/chat", undefined, {
      fetchImpl: fetchReturning(streamResponse([], 503)),
    });
    expect(result.outcome).toBe("http_error");
    expect(result.status).toBe(503);
  });

  it("classifies a fetch rejection as 'network_error'", async () => {
    const result = await trackApiCall("/api/chat", undefined, {
      fetchImpl: fetchRejecting(new TypeError("Failed to fetch")),
    });
    expect(result.outcome).toBe("network_error");
    expect(result.status).toBe(0);
  });

  it("classifies an AbortError rejection as 'abort'", async () => {
    const result = await trackApiCall("/api/chat", undefined, {
      fetchImpl: fetchRejecting(new DOMException("aborted", "AbortError")),
    });
    expect(result.outcome).toBe("abort");
  });

  it("treats an aborted signal as 'abort' even on a generic rejection", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await trackApiCall(
      "/api/chat",
      { signal: controller.signal },
      { fetchImpl: fetchRejecting(new Error("generic")) },
    );
    expect(result.outcome).toBe("abort");
  });

  it("classifies a mid-stream abort as 'abort'", async () => {
    const result = await trackApiCall("/api/chat", undefined, {
      fetchImpl: fetchReturning(
        erroringStream("partial", new DOMException("aborted", "AbortError")),
      ),
    });
    expect(result.outcome).toBe("abort");
  });

  it("classifies a mid-stream connection drop as 'network_error'", async () => {
    const result = await trackApiCall("/api/chat", undefined, {
      fetchImpl: fetchReturning(
        erroringStream("partial", new TypeError("connection reset")),
      ),
    });
    expect(result.outcome).toBe("network_error");
  });
});

/* -------------------------------------------------------------------------- */
/* ttfbMs vs totalMs                                                          */
/* -------------------------------------------------------------------------- */

describe("ttfbMs vs totalMs", () => {
  it("times ttfb to the first chunk and total to stream close, distinctly", async () => {
    mockClock(10);
    const result = await trackApiCall("/api/chat", undefined, {
      fetchImpl: fetchReturning(streamResponse(["only-chunk"])),
    });
    // ttfb is read at the first chunk, total after the stream closes — so the
    // two are distinct durations, with ttfb strictly the shorter.
    expect(result.ttfbMs).not.toBeNull();
    expect(result.ttfbMs as number).toBeGreaterThan(0);
    expect(result.totalMs).toBeGreaterThan(result.ttfbMs as number);
  });

  it("reports ttfbMs as null for a non-2xx response", async () => {
    const result = await trackApiCall("/api/chat", undefined, {
      fetchImpl: fetchReturning(streamResponse([], 500)),
    });
    expect(result.ttfbMs).toBeNull();
    expect(result.totalMs).toBeGreaterThanOrEqual(0);
  });

  it("reports ttfbMs as null when a 2xx response has no body", async () => {
    const result = await trackApiCall("/api/chat", undefined, {
      fetchImpl: fetchReturning(new Response(null, { status: 200 })),
    });
    expect(result.outcome).toBe("ok");
    expect(result.ttfbMs).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* api_call event emission                                                    */
/* -------------------------------------------------------------------------- */

describe("api_call event", () => {
  it("emits an api_call event with the round trip and a 2xx flag", async () => {
    const sink = recordingSink();
    init({ sink });

    await trackApiCall(
      "https://api.example.com/api/chat?session=abc",
      { method: "post" },
      { fetchImpl: fetchReturning(streamResponse(["hi"])) },
    );
    flush("manual");

    const events = apiCallEvents(sink);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "api_call",
      endpoint: "/api/chat", // origin and query string stripped
      method: "POST", // uppercased
      status: 200,
      ok: true,
    });
    expect(events[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("reports a non-2xx response as a not-ok api_call event", async () => {
    const sink = recordingSink();
    init({ sink });

    await trackApiCall("/api/chat", undefined, {
      fetchImpl: fetchReturning(streamResponse([], 500)),
    });
    flush("manual");

    expect(apiCallEvents(sink)[0]).toMatchObject({ status: 500, ok: false });
  });

  it("records ttfb and the four-way outcome on a network breadcrumb (D10)", async () => {
    const sink = recordingSink();
    init({ sink });

    await trackApiCall("/api/chat", undefined, {
      fetchImpl: fetchReturning(streamResponse(["hi"])),
    });
    flush("manual");

    const crumb = sink.sent[0].breadcrumbs.find(
      (c) => c.category === "network",
    );
    expect(crumb).toBeDefined();
    expect(crumb?.message).toBe("api-call");
    const data = crumb?.data as Record<string, unknown>;
    expect(data.outcome).toBe("ok");
    expect(data).toHaveProperty("ttfbMs");
    expect(data).toHaveProperty("totalMs");
  });
});

/* -------------------------------------------------------------------------- */
/* Streaming                                                                  */
/* -------------------------------------------------------------------------- */

describe("streaming", () => {
  it("hands each body chunk to onChunk in arrival order", async () => {
    const decoder = new TextDecoder();
    const received: string[] = [];

    await trackApiCall("/api/chat", undefined, {
      fetchImpl: fetchReturning(streamResponse(["Hello, ", "world", "!"])),
      onChunk: (chunk) => received.push(decoder.decode(chunk)),
    });

    expect(received.join("")).toBe("Hello, world!");
  });
});

/* -------------------------------------------------------------------------- */
/* Resilience & the no-monkey-patch contract                                  */
/* -------------------------------------------------------------------------- */

describe("resilience", () => {
  it("swallows a fault in the caller's chunk handler", async () => {
    const result = await trackApiCall("/api/chat", undefined, {
      fetchImpl: fetchReturning(streamResponse(["a", "b"])),
      onChunk: () => {
        throw new Error("handler boom");
      },
    });
    // The handler threw on every chunk, yet the call still completed cleanly.
    expect(result.outcome).toBe("ok");
    expect(result.totalMs).toBeGreaterThanOrEqual(0);
  });

  it("never rejects when the capture core's sink throws", async () => {
    const throwingSink: Sink = {
      name: "throwing",
      send: () => {
        throw new Error("sink boom");
      },
    };
    init({ sink: throwingSink });

    await expect(
      trackApiCall("/api/chat", undefined, {
        fetchImpl: fetchReturning(streamResponse(["hi"])),
      }),
    ).resolves.toMatchObject({ outcome: "ok" });
    expect(() => flush("manual")).not.toThrow();
  });
});

describe("no global fetch monkey-patch", () => {
  it("never reassigns the global fetch", async () => {
    const original = globalThis.fetch;
    await trackApiCall("/api/chat", undefined, {
      fetchImpl: fetchReturning(streamResponse(["x"])),
    });
    expect(globalThis.fetch).toBe(original);
  });

  it("falls back to the global fetch when no fetchImpl is given", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(streamResponse(["x"]));

    const result = await trackApiCall("/api/chat");

    expect(spy).toHaveBeenCalledWith("/api/chat", undefined);
    expect(result.outcome).toBe("ok");
  });
});
