/**
 * Outbound API-call tracking.
 *
 * The API-call leg of the capture layer (design D11): it measures the health
 * of the one network request this app makes at runtime — the streaming
 * companion-chat `fetch` (see `useChat` in `src/hooks/useChat.ts`).
 *
 * {@link trackApiCall} is a *thin wrapper* around that `fetch` plus its
 * streamed-body read loop. It is deliberately **not** a global `fetch`
 * monkey-patch (design D11 / C11): instrumenting the one call site that
 * matters keeps the capture layer's footprint explicit and leaves every
 * unrelated request — asset loads, third-party SDKs — untouched and
 * unperturbed.
 *
 * Two durations are measured and kept distinct:
 *
 * - `ttfbMs` — call start → the first `reader.read()` that yields body bytes.
 *   For a streaming response this is when the model began answering.
 * - `totalMs` — call start → the stream's `done` (or the failure that ended
 *   it). This is the round trip the user actually waited on.
 *
 * The outcome is classified four ways (design C11):
 *
 * - `ok` — a 2xx response whose body stream drained to completion.
 * - `http_error` — the exchange completed but the status was non-2xx.
 * - `abort` — the caller aborted the request via its `AbortSignal`.
 * - `network_error` — `fetch` (or a mid-stream `read`) rejected for any other
 *   reason: DNS failure, connection drop, CORS, …
 *
 * The measurement rides into the capture core two ways. The headline
 * `api_call` {@link AnalyticsEvent} carries the round-trip `durationMs`
 * (= `totalMs`) and a 2xx `ok` flag — all its shape has room for. The fuller
 * picture — `ttfbMs` and the four-way `outcome` — is recorded as a `network`
 * breadcrumb (design D10), exactly as the load waterfall rides alongside its
 * event in `performance.ts`.
 *
 * Resilience contract: nothing here may throw into the host app. The analytics
 * emission is wrapped, a fault in the caller's chunk handler is swallowed, and
 * every transport failure is turned into an {@link ApiCallResult} rather than
 * an exception — analytics must never crash the page it measures.
 *
 * Design reference: §5.2 (`api_call` event), decisions D10 / D11 / C11.
 */

import { addBreadcrumb, track } from "./core";

/* -------------------------------------------------------------------------- */
/* Public surface                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The four-way classification of an outbound call's outcome (design C11).
 * Richer than the `api_call` event's boolean `ok`: it separates a server
 * rejection, a user abort and a transport failure, which a single flag cannot.
 */
export type ApiCallOutcome = "ok" | "http_error" | "abort" | "network_error";

/** Optional hooks for {@link trackApiCall}. */
export interface ApiCallOptions {
  /**
   * Invoked once per streamed body chunk, in arrival order, with the raw bytes
   * from `reader.read()`. The caller owns decoding and rendering; this wrapper
   * only observes the read for timing. A fault thrown here is swallowed (see
   * the resilience contract) — the handler must not rely on its exceptions
   * surfacing.
   */
  onChunk?: (chunk: Uint8Array) => void;
  /**
   * `fetch` implementation to use. Defaults to the global `fetch`. Exposed so
   * tests can supply a deterministic stand-in; production callers leave it
   * unset. Note this is dependency *injection*, not a monkey-patch — the
   * global `fetch` is never reassigned (design D11).
   */
  fetchImpl?: typeof fetch;
}

/** The measurement {@link trackApiCall} resolves to. */
export interface ApiCallResult {
  /** Four-way outcome classification (design C11). */
  outcome: ApiCallOutcome;
  /** HTTP status code; `0` when no response was ever received. */
  status: number;
  /**
   * Time to first body bytes, in ms (call start → first `reader.read()` with
   * data). `null` when the stream produced no bytes — a non-2xx response, an
   * empty body, or a failure before the first chunk.
   */
  ttfbMs: number | null;
  /** Round-trip duration, in ms (call start → stream `done` or failure). */
  totalMs: number;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Round to one decimal place — enough precision for ms reporting. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Reduce a request URL to its endpoint path, dropping origin, query string and
 * fragment ({@link ApiCallEvent.endpoint} carries the path only). Relative URLs
 * are resolved against the document. An unparseable URL falls back to the raw
 * string with any query string trimmed — this helper never throws.
 */
function toEndpoint(url: string): string {
  try {
    return new URL(url, window.location.href).pathname;
  } catch {
    const queryAt = url.indexOf("?");
    return queryAt === -1 ? url : url.slice(0, queryAt);
  }
}

/**
 * Decide whether a thrown value represents an abort rather than a genuine
 * network failure. An aborted `AbortSignal` is authoritative on its own; absent
 * that, the conventional `AbortError` name is checked, since `fetch` and
 * `reader.read()` reject with a `DOMException` so named.
 */
function isAbortError(
  err: unknown,
  signal: AbortSignal | null | undefined,
): boolean {
  if (signal?.aborted === true) return true;
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: unknown }).name === "AbortError"
  );
}

/**
 * Emit the measurement into the capture core: a `network` breadcrumb carrying
 * the full detail (design D10) and the headline `api_call` event.
 *
 * The whole body is wrapped — a fault in the capture core must not propagate
 * back out of {@link trackApiCall} into the host app.
 */
function emit(
  endpoint: string,
  method: string,
  status: number,
  outcome: ApiCallOutcome,
  ttfbMs: number | null,
  totalMs: number,
): void {
  try {
    // The `api_call` event only has room for the round-trip duration and a 2xx
    // flag; `ttfbMs` and the four-way outcome ride along as a breadcrumb (D10)
    // so no measured detail is lost.
    addBreadcrumb({
      category: "network",
      message: "api-call",
      data: { endpoint, method, status, outcome, ttfbMs, totalMs },
    });
    track({
      type: "api_call",
      endpoint,
      method,
      status,
      durationMs: totalMs,
      ok: outcome === "ok",
    });
  } catch {
    // Analytics must never crash the host app it measures.
  }
}

/**
 * Build the {@link ApiCallResult} and emit the matching events. The single
 * exit point shared by every branch of {@link trackApiCall}, so the event is
 * recorded on exactly one code path regardless of how the call ended.
 */
function settle(
  url: string,
  init: RequestInit | undefined,
  outcome: ApiCallOutcome,
  status: number,
  ttfbMs: number | null,
  totalMs: number,
): ApiCallResult {
  emit(
    toEndpoint(url),
    (init?.method ?? "GET").toUpperCase(),
    status,
    outcome,
    ttfbMs,
    totalMs,
  );
  return { outcome, status, ttfbMs, totalMs };
}

/* -------------------------------------------------------------------------- */
/* trackApiCall                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Perform a `fetch` and drive its streamed body, timing the call and recording
 * an `api_call` event when it ends.
 *
 * A thin wrapper, not a transport: `init` is passed straight to `fetch`, and
 * each body chunk is handed to {@link ApiCallOptions.onChunk} for the caller to
 * decode and render. This wrapper's only additions are the timing
 * (`ttfbMs` vs `totalMs`), the four-way outcome classification, and the
 * `api_call` event — and it patches nothing global to do so (design D11).
 *
 * Never rejects: a non-2xx status, an abort and a transport failure all resolve
 * to an {@link ApiCallResult} describing what happened. Callers branch on
 * `result.outcome` rather than wrapping the call in `try`/`catch`.
 */
export async function trackApiCall(
  url: string,
  init?: RequestInit,
  options?: ApiCallOptions,
): Promise<ApiCallResult> {
  const doFetch = options?.fetchImpl ?? fetch;
  const signal = init?.signal;
  const start = performance.now();

  // Recorded as the stream is read so that, on a mid-stream failure, the catch
  // block can still report whatever timing was reached before the fault.
  let ttfbAt: number | null = null;
  let status = 0;

  try {
    const response = await doFetch(url, init);
    status = response.status;

    // A completed exchange that the server itself rejected — no body to stream.
    if (!response.ok) {
      return settle(
        url,
        init,
        "http_error",
        status,
        null,
        round1(performance.now() - start),
      );
    }

    // A 2xx response with no readable body — nothing to stream, done already.
    const reader = response.body?.getReader();
    if (reader === undefined) {
      return settle(
        url,
        init,
        "ok",
        status,
        null,
        round1(performance.now() - start),
      );
    }

    // Drain the stream, timing the first body bytes and the close.
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value === undefined) continue;
      if (ttfbAt === null) ttfbAt = performance.now();
      try {
        options?.onChunk?.(value);
      } catch {
        // A fault in the caller's chunk handler is not a transport failure:
        // swallow it so it can neither corrupt the timing nor stop the drain.
      }
    }

    const ttfbMs = ttfbAt === null ? null : round1(ttfbAt - start);
    return settle(
      url,
      init,
      "ok",
      status,
      ttfbMs,
      round1(performance.now() - start),
    );
  } catch (err) {
    // `fetch` rejected, or a `reader.read()` did mid-stream. Either way the
    // call is over — classify it and report whatever timing was reached.
    const ttfbMs = ttfbAt === null ? null : round1(ttfbAt - start);
    const outcome: ApiCallOutcome = isAbortError(err, signal)
      ? "abort"
      : "network_error";
    return settle(
      url,
      init,
      outcome,
      status,
      ttfbMs,
      round1(performance.now() - start),
    );
  }
}
