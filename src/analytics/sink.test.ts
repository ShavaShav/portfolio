import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BeaconSink,
  ConsoleSink,
  MAX_BATCH_BYTES,
  NullSink,
  SERVER_BODY_CAP_BYTES,
  byteLength,
  checkBatchSize,
} from "./sink";
import type { Batch, Sink } from "./types";

/** A minimal, valid {@link Batch} for transport tests. */
function makeBatch(overrides: Partial<Batch> = {}): Batch {
  return {
    v: 1,
    session: { id: "session-1", loadId: "load-1" },
    reason: "interval",
    sentAt: 1_000,
    events: [],
    breadcrumbs: [],
    ...overrides,
  };
}

const COLLECTOR_URL = "https://collect.example.com/api/events";

/** Signature of `navigator.sendBeacon`. */
type BeaconImpl = (url: string, data?: BodyInit | null) => boolean;

/** Install (or, with `undefined`, remove) a `navigator.sendBeacon` stub. */
function stubSendBeacon(impl: BeaconImpl | undefined): void {
  if (impl === undefined) {
    Reflect.deleteProperty(navigator, "sendBeacon");
    return;
  }
  Object.defineProperty(navigator, "sendBeacon", {
    value: impl,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "sendBeacon");
});

/* -------------------------------------------------------------------------- */
/* Byte-size guard                                                            */
/* -------------------------------------------------------------------------- */

describe("byteLength", () => {
  it("counts ASCII as one byte per character", () => {
    expect(byteLength("hello")).toBe(5);
  });

  it("counts multi-byte UTF-8 characters by byte, not by code unit", () => {
    // "€" is one UTF-16 code unit but three UTF-8 bytes.
    expect("€".length).toBe(1);
    expect(byteLength("€")).toBe(3);
  });

  it("is zero for the empty string", () => {
    expect(byteLength("")).toBe(0);
  });
});

describe("checkBatchSize", () => {
  it("keeps the soft budget below the 32 KB server cap [review #1]", () => {
    expect(SERVER_BODY_CAP_BYTES).toBe(32 * 1024);
    expect(MAX_BATCH_BYTES).toBeLessThan(SERVER_BODY_CAP_BYTES);
  });

  it("reports a small batch as within budget", () => {
    const report = checkBatchSize(JSON.stringify(makeBatch()));
    expect(report.overBudget).toBe(false);
    expect(report.bytes).toBeGreaterThan(0);
    expect(report.budget).toBe(MAX_BATCH_BYTES);
  });

  it("reports a serialized batch over ~28 KB as over budget", () => {
    const report = checkBatchSize("x".repeat(MAX_BATCH_BYTES + 1));
    expect(report.bytes).toBe(MAX_BATCH_BYTES + 1);
    expect(report.overBudget).toBe(true);
  });

  it("treats a payload exactly at the budget as within budget", () => {
    const report = checkBatchSize("x".repeat(MAX_BATCH_BYTES));
    expect(report.bytes).toBe(MAX_BATCH_BYTES);
    expect(report.overBudget).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* NullSink                                                                   */
/* -------------------------------------------------------------------------- */

describe("NullSink", () => {
  it("has the name 'null'", () => {
    expect(new NullSink().name).toBe("null");
  });

  it("send() is a no-op that never throws", () => {
    const sink: Sink = new NullSink();
    expect(() => sink.send(makeBatch())).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* ConsoleSink                                                                */
/* -------------------------------------------------------------------------- */

describe("ConsoleSink", () => {
  it("has the name 'console'", () => {
    expect(new ConsoleSink().name).toBe("console");
  });

  it("logs the batch to the console", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    new ConsoleSink().send(makeBatch({ reason: "manual" }));
    expect(debug).toHaveBeenCalledOnce();
  });

  it("never throws even when console.debug throws", () => {
    vi.spyOn(console, "debug").mockImplementation(() => {
      throw new Error("console blew up");
    });
    expect(() => new ConsoleSink().send(makeBatch())).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* BeaconSink                                                                 */
/* -------------------------------------------------------------------------- */

describe("BeaconSink", () => {
  it("has the name 'beacon'", () => {
    expect(new BeaconSink(COLLECTOR_URL).name).toBe("beacon");
  });

  it("sends via navigator.sendBeacon with a text/plain blob", async () => {
    const beacon = vi.fn((_url: string, _data?: BodyInit | null) => true);
    stubSendBeacon(beacon);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await new BeaconSink(COLLECTOR_URL).send(makeBatch());

    expect(beacon).toHaveBeenCalledOnce();
    const [url, data] = beacon.mock.calls[0];
    expect(url).toBe(COLLECTOR_URL);
    expect(data).toBeInstanceOf(Blob);
    expect((data as Blob).type).toContain("text/plain");
    // A successful beacon must not also hit the fetch fallback.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ships the serialized batch as the beacon payload", async () => {
    let captured: Blob | undefined;
    stubSendBeacon((_url, data) => {
      captured = data as Blob;
      return true;
    });
    const batch = makeBatch({ reason: "pagehide" });

    await new BeaconSink(COLLECTOR_URL).send(batch);

    expect(captured).toBeInstanceOf(Blob);
    expect(JSON.parse(await captured!.text())).toEqual(batch);
  });

  it("falls back to a keepalive fetch when sendBeacon returns false", async () => {
    stubSendBeacon(() => false);
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", fetchMock);

    await new BeaconSink(COLLECTOR_URL).send(makeBatch());

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(COLLECTOR_URL);
    expect(init).toMatchObject({ method: "POST", keepalive: true });
  });

  it("the fetch fallback uses Content-Type text/plain;charset=UTF-8 [review #12]", async () => {
    stubSendBeacon(() => false);
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", fetchMock);

    await new BeaconSink(COLLECTOR_URL).send(makeBatch());

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("text/plain;charset=UTF-8");
  });

  it("falls back to fetch when sendBeacon is unavailable", async () => {
    stubSendBeacon(undefined);
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", fetchMock);

    await new BeaconSink(COLLECTOR_URL).send(makeBatch());

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("falls back to fetch when sendBeacon throws", async () => {
    stubSendBeacon(() => {
      throw new Error("beacon exploded");
    });
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", fetchMock);

    await new BeaconSink(COLLECTOR_URL).send(makeBatch());

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("never throws or rejects when the fetch fallback fails", async () => {
    stubSendBeacon(() => false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    await expect(
      new BeaconSink(COLLECTOR_URL).send(makeBatch()),
    ).resolves.toBeUndefined();
  });

  it("never throws on an unserializable batch and ships nothing", () => {
    const beacon = vi.fn((_url: string, _data?: BodyInit | null) => true);
    stubSendBeacon(beacon);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const circular = makeBatch() as Batch & { self?: unknown };
    circular.self = circular; // JSON.stringify throws on a circular structure

    expect(() => new BeaconSink(COLLECTOR_URL).send(circular)).not.toThrow();
    expect(beacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
