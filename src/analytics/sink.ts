/**
 * Delivery sinks for analytics batches.
 *
 * A {@link Sink} is the transport seam between the capture core and the world
 * outside the page. This module provides three implementations plus a
 * byte-size guard the flush path uses to stay under the collector's body cap:
 *
 * - {@link BeaconSink} — production transport. Ships a batch via
 *   `navigator.sendBeacon` and falls back to a `keepalive` `fetch` when the
 *   beacon is unavailable or refuses the payload.
 * - {@link NullSink} — a no-op sink installed when the user has opted out of
 *   tracking (DNT / GPC, design D8); lets the rest of the pipeline run
 *   unconditionally while nothing leaves the device.
 * - {@link ConsoleSink} — logs batches to the console for local development.
 * - {@link checkBatchSize} — measures a serialized batch against the ~28 KB
 *   soft budget so the caller can split/trim before sending [review #1].
 *
 * Every `send()` is failure-tolerant: a transport error is swallowed, never
 * thrown into the host app — analytics must not crash the page it measures.
 *
 * Design reference: §5.4, review #1, review #12.
 */

import type { Batch, Sink } from "./types";

/* -------------------------------------------------------------------------- */
/* Byte-size guard                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Hard request-body cap enforced by the server collector. A batch at or above
 * this size is rejected on the wire, so the client must never ship one.
 */
export const SERVER_BODY_CAP_BYTES = 32 * 1024;

/**
 * Soft byte budget for a serialized batch. Deliberately set ~4 KB below
 * {@link SERVER_BODY_CAP_BYTES} so a batch that passes the guard still has
 * headroom below the hard cap for any last-moment framing [review #1]. The
 * flush path (capture core) splits or trims any batch that exceeds this
 * before handing it to a {@link Sink}.
 */
export const MAX_BATCH_BYTES = 28 * 1024;

/** Reusable encoder — measuring UTF-8 length needs no per-call allocation. */
const utf8 = new TextEncoder();

/**
 * UTF-8 byte length of a string. This is what the wire and the server cap
 * count — not `String.length`, which counts UTF-16 code units and undercounts
 * any non-ASCII payload.
 */
export function byteLength(serialized: string): number {
  return utf8.encode(serialized).length;
}

/** The verdict {@link checkBatchSize} reports back to its caller. */
export interface BatchSizeReport {
  /** UTF-8 byte length of the serialized batch. */
  bytes: number;
  /** The budget `bytes` was compared against — {@link MAX_BATCH_BYTES}. */
  budget: number;
  /**
   * `true` when `bytes` exceeds {@link MAX_BATCH_BYTES}. The caller should
   * split the batch or trim its breadcrumb trail before delivery.
   */
  overBudget: boolean;
}

/**
 * Measure an already-serialized batch against the soft byte budget.
 *
 * The capture core calls this in the flush path: it `JSON.stringify`s the
 * pending batch once, hands the string here, and — when `overBudget` is set —
 * splits the batch or truncates breadcrumbs before calling {@link Sink.send}
 * [review #1]. Pure and allocation-light; safe to call on every flush.
 */
export function checkBatchSize(serialized: string): BatchSizeReport {
  const bytes = byteLength(serialized);
  return {
    bytes,
    budget: MAX_BATCH_BYTES,
    overBudget: bytes > MAX_BATCH_BYTES,
  };
}

/* -------------------------------------------------------------------------- */
/* Shared transport helpers                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Content type for both transports. `text/plain` keeps the request a CORS
 * "simple request" (no preflight) and is what `sendBeacon` sends for a
 * `text/plain` `Blob`; the `fetch` fallback MUST set the identical value so a
 * dropped beacon and its retry look the same to the collector [review #12].
 */
const CONTENT_TYPE = "text/plain;charset=UTF-8";

/**
 * Serialize a batch to its wire string, returning `null` when it cannot be
 * stringified (e.g. a circular reference slipped into a payload). Callers
 * treat `null` as "nothing to send" rather than letting the throw escape.
 */
function serialize(batch: Batch): string | null {
  try {
    return JSON.stringify(batch);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* BeaconSink                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Production transport. Prefers `navigator.sendBeacon`, which the browser
 * delivers asynchronously and which survives page unload — exactly what an
 * end-of-session flush needs.
 *
 * `sendBeacon` returns `false` when the user agent cannot queue the payload
 * (over the per-origin beacon budget). In that case — and when the API is
 * absent or throws — {@link BeaconSink} falls back to a `fetch` with
 * `keepalive: true`, which has the same unload-survival property. The fallback
 * sends the identical `text/plain;charset=UTF-8` content type so the collector
 * parses both paths the same way [review #12].
 */
export class BeaconSink implements Sink {
  readonly name = "beacon";

  /** Absolute URL of the collector endpoint (`POST /api/events`). */
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  send(batch: Batch): void | Promise<void> {
    const body = serialize(batch);
    if (body === null) return; // unserializable — drop it, never throw

    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function"
      ) {
        const blob = new Blob([body], { type: CONTENT_TYPE });
        if (navigator.sendBeacon(this.url, blob)) return; // queued — done
      }
    } catch {
      // sendBeacon itself threw (rare) — fall through to the fetch fallback.
    }

    // Beacon missing or refused the payload — retry with a keepalive fetch.
    return this.fetchFallback(body);
  }

  /**
   * Deliver via `fetch(url, { keepalive: true })`. The returned promise always
   * resolves: a network failure is swallowed so analytics cannot reject into
   * the host app.
   */
  private fetchFallback(body: string): Promise<void> {
    try {
      return fetch(this.url, {
        method: "POST",
        body,
        keepalive: true,
        headers: { "Content-Type": CONTENT_TYPE },
      }).then(
        () => undefined,
        () => undefined,
      );
    } catch {
      // Synchronous throw (e.g. a malformed URL) — still resolve cleanly.
      return Promise.resolve();
    }
  }
}

/* -------------------------------------------------------------------------- */
/* NullSink                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A sink that discards every batch. Installed when the user has opted out of
 * tracking (DNT / GPC, design D8) so the capture pipeline can run unchanged
 * while nothing leaves the device. `send()` is a no-op and trivially succeeds.
 */
export class NullSink implements Sink {
  readonly name = "null";

  send(): void {
    // Intentionally empty — opted-out batches go nowhere.
  }
}

/* -------------------------------------------------------------------------- */
/* ConsoleSink                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A development sink that logs batches to the console instead of shipping
 * them — useful when running locally without a collector. Like every sink,
 * `send()` never throws, even if `console` has been patched to throw.
 */
export class ConsoleSink implements Sink {
  readonly name = "console";

  send(batch: Batch): void {
    try {
      console.debug(
        `[analytics] batch (${batch.reason}, ${batch.events.length} events)`,
        batch,
      );
    } catch {
      // console unavailable / patched to throw — swallow it.
    }
  }
}
