/**
 * User-set analytics opt-out preference.
 *
 * A complement to the browser-level Do-Not-Track / Global Privacy Control
 * signals consulted by {@link isDoNotTrack}: this exposes a UI-driven opt-out
 * that the rest of the app (notably the Settings panel) can read and write.
 *
 * Persistence: `localStorage`. The session/load identity (`src/analytics/identity.ts`,
 * design D7) deliberately avoids `localStorage` because identifiers must not
 * outlive the tab; an opt-out *preference* is a different concern — it carries
 * no identifier, and would be useless if it did not survive a reload. The key
 * stores a single boolean as `"1"` (opted out) or absent (opted in).
 *
 * Storage access is wrapped so that an unavailable `localStorage` (Safari
 * private mode, storage disabled) degrades cleanly: reads return `false`, writes
 * no-op. The user can still opt out via DNT/GPC in that case.
 */

const STORAGE_KEY = "pf.analytics.opt_out";
const OPT_OUT_VALUE = "1";

/** `true` when the user has set the in-app analytics opt-out. */
export function getAnalyticsOptOut(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === OPT_OUT_VALUE;
  } catch {
    return false;
  }
}

/**
 * Persist the user's analytics opt-out preference. Removing the key (rather
 * than writing `"0"`) keeps the storage surface minimal — only opted-out users
 * leave a footprint.
 */
export function setAnalyticsOptOut(optOut: boolean): void {
  try {
    if (optOut) {
      localStorage.setItem(STORAGE_KEY, OPT_OUT_VALUE);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage unavailable — preference cannot be persisted; DNT/GPC still apply.
  }
}
