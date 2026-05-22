# Analytics server collector — contract

This document is the **contract for the server-side analytics collector**. The
collector does not live in this repository — it ships from the separate
`portfolio-api` repo, deployed as Vercel Functions. This file is the spec the
build stage applies *there*: it defines the HTTP endpoints, the storage schema,
the retention job, and the canned reporting SQL.

The front-end capture layer in `src/analytics` already encodes its half of the
contract — see `types.ts` (the wire format: `Batch`, `StampedEvent`,
`AnalyticsEvent`), `sink.ts` (transport + the byte caps), and `identity.ts`
(producer identity + client context). Anything below that contradicts those
files is a bug in this document, not in the client.

**Design references:** §4.2, §5.5, §6, §11, decisions D12 / D16, open thread
OT1. Review-thread call-outs (`[review #N]`) are reproduced inline so the build
stage can verify each was honored.

---

## 1. Overview

| Endpoint                  | Method | Auth                    | Purpose                                  |
| ------------------------- | ------ | ----------------------- | ---------------------------------------- |
| `/api/events`             | `POST` | Origin allowlist only   | Ingest a batch of captured events.       |
| `/api/events/summary`     | `GET`  | **Required** (ship gate)| Read aggregated reporting data.          |
| `/api/cron/prune-events`  | `POST` | `CRON_SECRET`           | Retention sweep — invoked by Vercel cron.|

Two requirements below are **blocking ship gates** — the site must not go live
without them:

1. `GET /api/events/summary` MUST require authentication before shipping
   — see §5 `[review #2]`.
2. The retention cron MUST exist and be scheduled before shipping
   — see §4 `[review #5]`.

Both are restated in the §7 checklist.

---

## 2. `POST /api/events` — the collector endpoint

The single ingestion endpoint. The browser ships a `Batch` here via
`navigator.sendBeacon`, with a `keepalive` `fetch` fallback (see
`BeaconSink` in `src/analytics/sink.ts`).

### 2.1 Request

- **Method:** `POST`. Any other method → `405 Method Not Allowed`.
- **Content-Type:** `text/plain;charset=UTF-8`. This is deliberate: a
  `text/plain` body keeps the request a CORS *simple request*, so the browser
  issues **no preflight** `OPTIONS`. `sendBeacon` sends a `text/plain` `Blob`
  and the `fetch` fallback sets the identical header `[review #12]`.
- **Body:** the UTF-8 JSON serialization of one `Batch` object (§2.5).

Because the body arrives as `text/plain`, the serverless runtime will **not**
auto-parse it as JSON. The handler MUST read the raw request body as text and
`JSON.parse` it itself. A parse failure is a `400` (§2.4).

### 2.2 Admission checks (in order)

The handler applies these gates before touching storage. Order matters — cheap
rejections come first.

1. **Method** — not `POST` → `405`.
2. **Origin allowlist** — the `Origin` request header MUST exactly match an
   entry in `ALLOWED_ORIGINS` (env-configured, e.g. the production site origin
   plus any preview/localhost origins). A missing or non-allowlisted `Origin`
   → `403 Forbidden`. This is a server-side admission gate and is independent
   of the CORS *response* headers in §2.3.
3. **Body-size cap** — the request body MUST be **strictly under 32 KB**
   (`32 * 1024 = 32768` bytes). This is the hard cap mirrored by
   `SERVER_BODY_CAP_BYTES` in `src/analytics/sink.ts`; the client keeps a
   ~28 KB soft budget (`MAX_BATCH_BYTES`) to stay safely under it. A body at
   or over the cap → `413 Payload Too Large`. Enforce on the actual decoded
   byte length, not on a possibly-absent `Content-Length` header.
4. **JSON parse** — body text fails `JSON.parse`, or is not a JSON object
   → `400 Bad Request`.
5. **Wire version** — `batch.v` MUST be an integer `>= MIN_WIRE_VERSION`
   (currently `1`). See §2.6 — `v` is a **forward-compatible range**, not an
   equality check `[review #8]`. A missing, non-integer, or below-minimum `v`
   → `400`.
6. **Event-count cap** — `batch.events` MUST be an array of **at most 100**
   elements `[OT1]`. More than 100 → `400`. A batch with zero events is
   accepted (a breadcrumb-only or heartbeat batch is valid).
7. **Shape** — `batch.session.id`, `batch.session.loadId`, `batch.reason`,
   and `batch.sentAt` MUST be present and well-typed; each `events[]` entry
   MUST be a `StampedEvent` with a recognized `event.type`. Malformed → `400`.
   Unknown *extra* fields anywhere are **ignored, never rejected** (§2.6).

A batch that clears every gate is persisted (§3) and the handler returns
`204` (§2.4).

> **Note on error responses.** `navigator.sendBeacon` discards the HTTP
> response entirely — the client never sees a `4xx`. Error codes therefore
> serve the `fetch` fallback, monitoring, and manual testing. The collector
> must still reject bad data server-side regardless of whether the client can
> observe the rejection: a rejected batch is simply dropped, never stored.

### 2.3 CORS

`POST /api/events` itself is a CORS simple request and triggers no preflight.
Still, set CORS *response* headers so the `fetch` fallback path is not blocked
by the browser:

```
Access-Control-Allow-Origin: <the request's Origin, only if allowlisted>
Vary: Origin
```

Echo the specific allowlisted origin — never `*`. If the origin is not
allowlisted the request was already rejected at gate 2 with `403`.

No credentials are used (no cookies — see `docs/privacy.md`), so
`Access-Control-Allow-Credentials` is **not** sent.

### 2.4 Response

- **Success:** `204 No Content`, empty body. Nothing useful can be returned to
  a beacon, and a 204 is the cheapest possible reply.
- **Failure:** the status from §2.2 (`400` / `403` / `405` / `413`) with a
  short `text/plain` reason. Bodies are advisory only.

| Status | Meaning                                                        |
| ------ | -------------------------------------------------------------- |
| `204`  | Batch accepted and stored.                                     |
| `400`  | Malformed JSON, bad shape, bad `v`, or > 100 events.           |
| `403`  | `Origin` missing or not in `ALLOWED_ORIGINS`.                  |
| `405`  | Method other than `POST`.                                      |
| `413`  | Body ≥ 32 KB.                                                  |

The handler MUST NOT throw into the runtime: any unexpected internal error is
caught, logged, and answered with `500` — analytics must never page anyone.

### 2.5 Request body — the `Batch` wire format

The body is one `Batch` object, defined canonically by the `Batch` interface in
`src/analytics/types.ts` (§5.4). Summary:

```jsonc
{
  "v": 1,                       // wire version — see §2.6
  "session": {
    "id": "…",                  // tab-session id (sessionStorage-backed)
    "loadId": "…"               // per page/app load
  },
  "reason": "interval",         // FlushReason: interval|size|visibilitychange|
                                //              pagehide|manual|error
  "sentAt": 1747000000000,      // epoch ms, client clock
  "events": [                   // 0..100 StampedEvent objects
    {
      "seq": 7,                 // per-load monotonic sequence
      "ts": 1747000000000,      // epoch ms, client clock
      "view": "solar_system",   // active ViewName, or null before first view
      "event": {                // an AnalyticsEvent (discriminated on `type`)
        "type": "web_vital",
        "metric": "LCP", "value": 2310.5, "rating": "good"
      }
    }
  ],
  "breadcrumbs": [ /* Breadcrumb[] — trailing context */ ],
  "client": {                   // ClientContext — see note below
    "ua": "…", "lang": "en-US",
    "viewport": { "w": 1280, "h": 800 },
    "tier": "high", "dnt": false
  }
}
```

`AnalyticsEvent` is a discriminated union on `event.type`; the recognized tags
are `view`, `interaction`, `link`, `error`, `web_vital`, `frame_health`,
`api_call`. The collector stores each event's payload verbatim (§3) and does
not need to validate inner shapes beyond the discriminant.

> **`client` is optional.** The `ClientContext` snapshot (see `identity.ts`)
> rides along as the batch's `client` field. Treat it as optional and tolerate
> its absence — every column derived from it is nullable (§3). This is the
> forward-compatible posture of §2.6 in practice.

### 2.6 `v` is a forward-compatible range `[review #8]`

The collector MUST NOT test `batch.v` for equality against a single expected
number. It maintains a floor, `MIN_WIRE_VERSION` (currently `1`), and:

- **accepts** any batch whose `v` is an integer `>= MIN_WIRE_VERSION`,
  including values **greater** than the newest version it was built against;
- **ignores** any field it does not recognize, at every level of the batch;
- **rejects** (`400`) only when `v` is absent, non-integer, or below the floor.

This lets the front-end add fields and bump `v` without a coordinated deploy:
an older collector keeps ingesting newer batches, simply dropping the fields it
has no column for. Raise `MIN_WIRE_VERSION` only to deliberately retire a wire
format that can no longer be stored safely.

---

## 3. Storage — the `events` table

Postgres (Vercel Postgres / Neon). **One row per captured event** — each
`StampedEvent` in a batch is flattened into its own row, with the batch
envelope and client context denormalized onto every row. Denormalizing keeps
the §6 reporting queries join-free.

```sql
CREATE TABLE events (
  -- server-assigned --------------------------------------------------------
  id            BIGSERIAL    PRIMARY KEY,
  received_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),  -- server clock; the
                                                      -- retention + reporting key

  -- producer identity (§5.4 SessionRef) ------------------------------------
  session_id    TEXT         NOT NULL,   -- sessionStorage-backed TAB session
                                         -- (see the caveat in §6)
  load_id       TEXT         NOT NULL,   -- one per page/app load

  -- ordering & client timing (§5.3 StampedEvent) ---------------------------
  seq           INTEGER      NOT NULL,   -- per-load monotonic sequence
  client_ts     TIMESTAMPTZ  NOT NULL,   -- StampedEvent.ts — client clock,
                                         -- NOT trusted for retention
  sent_at       TIMESTAMPTZ  NOT NULL,   -- Batch.sentAt — client clock

  -- batch envelope (§5.4 Batch) --------------------------------------------
  wire_v        SMALLINT     NOT NULL,   -- Batch.v
  batch_reason  TEXT         NOT NULL,   -- Batch.reason (FlushReason)

  -- event (§5.2 / §5.3) ----------------------------------------------------
  view          TEXT,                    -- StampedEvent.view; NULL before the
                                         -- first view of a load
  event_type    TEXT         NOT NULL,   -- AnalyticsEvent discriminant
  payload       JSONB        NOT NULL,   -- the raw AnalyticsEvent, verbatim

  -- client context (ClientContext — optional, see §2.5) --------------------
  ua            TEXT,
  lang          TEXT,
  viewport_w    INTEGER,
  viewport_h    INTEGER,
  tier          TEXT,
  dnt           BOOLEAN,
  referrer_host TEXT,

  -- coarse geo -------------------------------------------------------------
  country       TEXT,                    -- NULLABLE  [review #6]

  CONSTRAINT events_type_matches_payload
    CHECK (event_type = payload ->> 'type'),
  CONSTRAINT events_seq_nonneg CHECK (seq >= 0)
);

CREATE INDEX events_received_at_idx   ON events (received_at);
CREATE INDEX events_type_received_idx ON events (event_type, received_at);
CREATE INDEX events_load_seq_idx      ON events (load_id, seq);
CREATE INDEX events_session_idx       ON events (session_id);
```

### 3.1 `country` is nullable `[review #6]`

`country` is a **coarse, two-letter geo hint derived server-side** from the
request — on Vercel, the `x-vercel-ip-country` header. It MUST be `NULL`able:

- geo is frequently unavailable — localhost, preview deploys, VPNs, and IPs the
  edge cannot resolve all yield no country;
- a forced placeholder (`'??'`, `''`) would silently corrupt the §6 geography
  query. `NULL` is the honest value and every query handles it explicitly.

**The raw IP address is never stored** — only this derived country code. See
`docs/privacy.md` ("No raw IP addresses"). The collector reads the geo header,
copies the country to this column, and discards the IP.

### 3.2 Breadcrumbs

`Batch.breadcrumbs` is trailing context for debugging, not reporting data, and
none of the §6 questions need it. Persisting it is **optional**; if kept, store
the trail in a separate `breadcrumbs` table keyed by `(load_id)` rather than
denormalizing a JSON blob onto every event row. It is out of scope for the
canned SQL below.

---

## 4. Retention — Vercel cron `DELETE` (blocking ship gate) `[review #5]`

First-party analytics keeps data only as long as it is useful. A scheduled job
deletes events older than **~12 months**. Shipping the site **without this job
configured is not permitted** `[review #5]` — it is a blocking requirement, not
a follow-up.

### 4.1 Schedule

`vercel.json` in `portfolio-api`:

```json
{
  "crons": [
    { "path": "/api/cron/prune-events", "schedule": "17 4 * * *" }
  ]
}
```

Daily, off-peak. A daily cadence keeps each delete small; the exact minute is
unimportant.

### 4.2 Handler

`/api/cron/prune-events` runs a single statement:

```sql
DELETE FROM events
WHERE received_at < now() - INTERVAL '12 months';
```

Retention is measured on `received_at` (the trusted server clock), never on the
client-supplied `client_ts` / `sent_at` — a skewed client clock must not be
able to keep a row alive past its window or evict it early.

### 4.3 Securing the cron route

Vercel cron invocations carry `Authorization: Bearer $CRON_SECRET`. The handler
MUST verify this header against the `CRON_SECRET` env var and return `401` on a
mismatch, so the destructive `DELETE` cannot be triggered by an arbitrary
external `POST`.

---

## 5. `GET /api/events/summary` — reporting read API (blocking ship gate) `[review #2]`

The dashboard reads aggregated analytics from `GET /api/events/summary` (it
runs the §6 queries server-side and returns JSON).

**This endpoint MUST require authentication before the site ships** `[review
#2]`. It exposes the entire analytics dataset in aggregate; unauthenticated, it
is a public data leak. This is a blocking ship gate.

Acceptable auth, in order of preference:

1. **Vercel deployment protection / SSO** on the route — zero app code, and
   the operator is the only consumer.
2. A **shared bearer token** (`SUMMARY_API_TOKEN` env var): the handler
   requires `Authorization: Bearer <token>` and returns `401` otherwise.

Requirements:

- No valid credential → `401 Unauthorized`. The endpoint MUST NOT return data
  on any unauthenticated path — fail closed.
- A bearer token is a non-simple header, so a browser dashboard will send a
  CORS preflight. Handle `OPTIONS /api/events/summary` → `204` with
  `Access-Control-Allow-Methods: GET, OPTIONS`,
  `Access-Control-Allow-Headers: Authorization`, and an allowlisted
  `Access-Control-Allow-Origin`.
- Until the auth mechanism is in place, this endpoint MUST NOT be deployed in
  a reachable state — an unauthenticated `/api/events/summary` blocks launch.

---

## 6. Canned SQL — the §11 questions

Design §11 enumerates the questions this analytics effort exists to answer. The
queries below are the canned answers; the build stage should keep this list
reconciled with §11 if the design's wording shifts. All examples use a 30-day
window — adjust the `INTERVAL` per question. Postgres dialect.

### Two caveats that apply to every query

**Web-vital values: take `MAX(value)` per `(session_id, metric)` first**
`[review #3]`. The `web-vitals` library can report the same metric more than
once, and a tab-session spans multiple page loads — so a single
`(session_id, metric)` pair accumulates several `web_vital` rows. Aggregating
the raw rows would let a session that produced many samples outweigh one that
produced few, and intermediate readings would drag percentiles around.
**Collapse to one value per session+metric with `MAX(value)`** *before*
computing any cross-session statistic. See Q7.

**"Sessions" means tab-sessions, not people** `[review #7]` `[review #10]`.
`session_id` is the `sessionStorage`-backed id from `identity.ts`. It
identifies one **browser tab session**: it is minted per tab, cleared when the
tab closes, and — by design (no cookies, no `localStorage`; see
`docs/privacy.md`) — there is **no cross-session user identity**. Therefore:

- `COUNT(DISTINCT session_id)` counts **tab-sessions**, never unique humans.
  One person in two tabs, or returning tomorrow, counts as multiple sessions.
- `session_id` sits *above* `load_id` in the identity hierarchy: one session
  fans out to one-or-more loads. `COUNT(DISTINCT load_id)` counts page loads —
  finer-grained still.
- Never label a `session_id` count "users" / "visitors" in the dashboard.
  Label it "sessions (tabs)".

---

### Q1 — How much traffic is the site getting?

```sql
SELECT
  date_trunc('day', received_at)::date  AS day,
  count(DISTINCT session_id)            AS tab_sessions,  -- NOT unique users
  count(DISTINCT load_id)               AS loads,
  count(*)                              AS events
FROM events
WHERE received_at >= now() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1;
```

### Q2 — Which views do visitors look at?

```sql
SELECT
  payload ->> 'name'           AS view,
  count(*)                     AS visits,
  count(DISTINCT session_id)   AS tab_sessions   -- tabs, not people
FROM events
WHERE event_type = 'view'
  AND received_at >= now() - INTERVAL '30 days'
GROUP BY 1
ORDER BY visits DESC;
```

### Q3 — How long do visitors dwell in each view?

A `view` event carries `from` (the view departed) and `dwellMs` (time spent
there). Aggregate `dwellMs` grouped by the *departed* view.

```sql
SELECT
  payload ->> 'from'                                                    AS view,
  count(*)                                                              AS departures,
  round(percentile_cont(0.5) WITHIN GROUP (
        ORDER BY (payload ->> 'dwellMs')::numeric))                     AS median_dwell_ms,
  round(avg((payload ->> 'dwellMs')::numeric))                          AS avg_dwell_ms
FROM events
WHERE event_type = 'view'
  AND payload ->> 'from'    IS NOT NULL    -- excludes the first view of a load
  AND payload ->> 'dwellMs' IS NOT NULL
  AND received_at >= now() - INTERVAL '30 days'
GROUP BY 1
ORDER BY median_dwell_ms DESC;
```

### Q4 — How do visitors enter and leave? (entry & drop-off views)

```sql
-- Entry view: the first view event of each load.
WITH entry AS (
  SELECT DISTINCT ON (load_id) load_id, payload ->> 'name' AS view
  FROM events
  WHERE event_type = 'view'
    AND received_at >= now() - INTERVAL '30 days'
  ORDER BY load_id, seq ASC
)
SELECT view AS entry_view, count(*) AS loads
FROM entry GROUP BY 1 ORDER BY loads DESC;

-- Exit view: the last view of each load — where visitors drop off.
WITH exit_view AS (
  SELECT DISTINCT ON (load_id) load_id, view
  FROM events
  WHERE view IS NOT NULL
    AND received_at >= now() - INTERVAL '30 days'
  ORDER BY load_id, seq DESC
)
SELECT view AS last_view, count(*) AS loads
FROM exit_view GROUP BY 1 ORDER BY loads DESC;
```

### Q5 — Which links do visitors click?

```sql
SELECT
  payload ->> 'href'                  AS href,
  payload ->> 'label'                 AS label,
  (payload ->> 'external')::boolean   AS external,
  count(*)                            AS clicks
FROM events
WHERE event_type = 'link'
  AND received_at >= now() - INTERVAL '30 days'
GROUP BY 1, 2, 3
ORDER BY clicks DESC;
```

### Q6 — Which interactions get used?

```sql
SELECT
  payload ->> 'action'         AS action,
  payload ->> 'target'         AS target,
  count(*)                     AS hits,
  count(DISTINCT session_id)   AS tab_sessions
FROM events
WHERE event_type = 'interaction'
  AND received_at >= now() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY hits DESC;
```

### Q7 — What do Core Web Vitals look like in the field?

`MAX(value)` per `(session_id, metric)` first `[review #3]`, then percentiles
across sessions.

```sql
WITH per_session AS (
  SELECT
    session_id,
    payload ->> 'metric'                   AS metric,
    max((payload ->> 'value')::numeric)    AS value   -- [review #3]
  FROM events
  WHERE event_type = 'web_vital'
    AND received_at >= now() - INTERVAL '30 days'
  GROUP BY session_id, payload ->> 'metric'
)
SELECT
  metric,
  count(*)                                                            AS tab_sessions,
  round(percentile_cont(0.50) WITHIN GROUP (ORDER BY value), 1)        AS p50,
  round(percentile_cont(0.75) WITHIN GROUP (ORDER BY value), 1)        AS p75,
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY value), 1)        AS p95
FROM per_session
GROUP BY metric
ORDER BY metric;
```

### Q8 — Is rendering smooth across device tiers?

```sql
SELECT
  tier,
  count(*)                                                                  AS samples,
  round(avg((payload ->> 'fps')::numeric), 1)                               AS avg_fps,
  round(percentile_cont(0.95) WITHIN GROUP (
        ORDER BY (payload ->> 'longestFrameMs')::numeric), 1)               AS p95_longest_frame_ms,
  sum((payload ->> 'jankFrames')::int)                                      AS total_jank_frames
FROM events
WHERE event_type = 'frame_health'
  AND received_at >= now() - INTERVAL '30 days'
GROUP BY tier
ORDER BY tier;
```

### Q9 — What errors are visitors hitting?

```sql
SELECT
  payload ->> 'source'         AS source,
  (payload ->> 'fatal')::bool  AS fatal,
  payload ->> 'message'        AS message,
  count(*)                     AS occurrences,
  count(DISTINCT session_id)   AS tab_sessions_affected
FROM events
WHERE event_type = 'error'
  AND received_at >= now() - INTERVAL '30 days'
GROUP BY 1, 2, 3
ORDER BY occurrences DESC;
```

### Q10 — Where in the world are visitors?

`country` is nullable (§3.1); surface the unknown bucket rather than dropping it.

```sql
SELECT
  coalesce(country, '(unknown)')  AS country,
  count(DISTINCT session_id)      AS tab_sessions,   -- tabs, not people
  count(DISTINCT load_id)         AS loads
FROM events
WHERE received_at >= now() - INTERVAL '30 days'
GROUP BY 1
ORDER BY tab_sessions DESC;
```

> `api_call` events (outbound request health — endpoint, status, `durationMs`,
> `ok`) are not one of the §11 questions but are queryable with the same
> `event_type = 'api_call'` filter and `payload ->> '…'` extraction shown
> above, should the dashboard want a transport-health panel.

---

## 7. Ship checklist for `portfolio-api`

- [ ] `POST /api/events`: `POST`-only; `Origin` allowlist; **< 32 KB** body
      cap; **≤ 100** events; `text/plain` body read + `JSON.parse`d manually;
      `v` accepted as a forward-compatible range (`>= MIN_WIRE_VERSION`,
      unknown fields ignored) `[review #8]`; CORS response headers; `204` on
      success.
- [ ] `events` table created per §3, with **`country` nullable** `[review #6]`
      and **no raw IP stored**.
- [ ] **Retention cron configured** in `vercel.json` and the
      `/api/cron/prune-events` `DELETE` handler deployed — `~12 months` on
      `received_at`, protected by `CRON_SECRET`. **Blocking** `[review #5]`.
- [ ] **`GET /api/events/summary` requires authentication** and fails closed
      with `401`. **Blocking** `[review #2]`.
- [ ] Canned §6 queries wired into the summary endpoint, with web vitals using
      `MAX(value)` per `(session_id, metric)` `[review #3]` and every
      session count labelled as **tab-sessions, not users**
      `[review #7]` `[review #10]`.
