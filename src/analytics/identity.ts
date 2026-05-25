/**
 * Identity & client context for the analytics capture layer.
 *
 * This module produces the producer-identity values every batch carries — the
 * per-load {@link loadId} and the cross-reload session id (together a
 * {@link SessionRef}) — plus the {@link ClientContext} environment snapshot
 * attached as a batch's `client` field, the host-only {@link getReferrerHost}
 * value, and the {@link isDoNotTrack} privacy check.
 *
 * Privacy stance (design D7): **no `localStorage`, no cookies**. The session
 * id lives only in `sessionStorage`, so it clears when the tab closes; the
 * load id lives only in memory. Callers should consult {@link isDoNotTrack}
 * before shipping anything.
 *
 * Design reference: §5.4, review #9, review #10.
 */

import {
  getDeviceCapability,
  type QualityTier,
} from "../hooks/useDeviceCapability";
import { getAnalyticsOptOut } from "./preference";
import type { SessionRef } from "./types";

/** `sessionStorage` key the session id is persisted under. */
const SESSION_STORAGE_KEY = "pf.analytics.sid";

/**
 * Per-load identifier — minted once, in memory, for the lifetime of this
 * page/app load. A fresh value on every load; never persisted. Sits *below*
 * the session id in the identity hierarchy (see {@link SessionRef}).
 */
export const loadId: string = crypto.randomUUID();

/**
 * Cached session id. Resolved lazily on the first {@link getSessionId} call so
 * that a `sessionStorage` failure (private mode, storage disabled) degrades to
 * a *stable* in-memory id rather than minting a new id on every call.
 */
let sessionIdCache: string | null = null;

/**
 * The long-lived session id — the top of the identity hierarchy. Read from
 * `sessionStorage` when present, otherwise minted and persisted there so it
 * survives reloads within the same tab. Stable for the lifetime of this load.
 *
 * `sessionStorage` access is wrapped in `try`/`catch`: when storage is
 * unavailable the id still resolves (in memory) and stays stable, it just
 * will not survive a reload.
 */
export function getSessionId(): string {
  if (sessionIdCache !== null) return sessionIdCache;

  let existing: string | null = null;
  try {
    existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    existing = null; // storage unavailable — fall through and mint one
  }

  if (existing !== null && existing !== "") {
    sessionIdCache = existing;
    return existing;
  }

  const minted = crypto.randomUUID();
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, minted);
  } catch {
    // Persisting failed; keep `minted` in memory so the id stays stable.
  }
  sessionIdCache = minted;
  return minted;
}

/**
 * Producer identity for a batch: the stable session id paired with this
 * load's {@link loadId}.
 */
export function getSessionRef(): SessionRef {
  return { id: getSessionId(), loadId };
}

/**
 * A {@link Navigator} extended with the {@link globalPrivacyControl} signal —
 * non-standard and so absent from the standard lib type. `doNotTrack` is part
 * of `Navigator` itself in current TypeScript lib.dom and is read directly off
 * the navigator without an interface extension.
 */
interface PrivacyNavigator extends Navigator {
  /** Global Privacy Control signal; `true` means "do not sell/share". */
  globalPrivacyControl?: boolean;
}

/**
 * `true` when the user has expressed a tracking opt-out via any of: the legacy
 * Do-Not-Track signal (`navigator.doNotTrack === "1"`), Global Privacy Control
 * (`navigator.globalPrivacyControl === true`), or the in-app analytics opt-out
 * preference set from the Settings panel ({@link getAnalyticsOptOut}). Callers
 * should suppress collection when this is set.
 */
export function isDoNotTrack(): boolean {
  const nav = navigator as PrivacyNavigator;
  if (nav.doNotTrack === "1" || nav.globalPrivacyControl === true) return true;
  return getAnalyticsOptOut();
}

/**
 * The referrer reduced to its **host only** — no path, query or fragment, so
 * a referring URL cannot leak PII [review #9]. Returns `""` when there is no
 * referrer or it cannot be parsed.
 */
export function getReferrerHost(): string {
  try {
    return new URL(document.referrer).host;
  } catch {
    return "";
  }
}

/** A viewport size, in CSS pixels. */
export interface Viewport {
  /** Width — `window.innerWidth`. */
  w: number;
  /** Height — `window.innerHeight`. */
  h: number;
}

/**
 * Environment snapshot of the producing client, attached to a batch as its
 * `client` field. Deliberately coarse — user agent, language, viewport,
 * device quality tier and the do-not-track flag — and carries nothing that
 * identifies an individual (design D7).
 */
export interface ClientContext {
  /** `navigator.userAgent`. */
  ua: string;
  /** Primary UI language — `navigator.language`. */
  lang: string;
  /** Current viewport size. */
  viewport: Viewport;
  /** Device rendering-quality tier, shared with the WebGL layer. */
  tier: QualityTier;
  /** `true` when the user has opted out of tracking — see {@link isDoNotTrack}. */
  dnt: boolean;
}

/** Build the {@link ClientContext} snapshot for the current environment. */
export function getClientContext(): ClientContext {
  return {
    ua: navigator.userAgent,
    lang: navigator.language,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    tier: getDeviceCapability().qualityTier,
    dnt: isDoNotTrack(),
  };
}
