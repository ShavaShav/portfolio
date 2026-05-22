/**
 * Link-activation tracking helper.
 *
 * A single stateless function, {@link trackLink}, that records a `link`
 * {@link AnalyticsEvent} when the user activates a link — whether it stays
 * on-origin (an in-app route, an anchor jump) or leaves the site entirely.
 *
 * The one piece of derivation here is the `external` flag (design D5): rather
 * than make every call site classify its own links, the helper resolves the
 * destination against the current document location and compares hosts. A
 * relative path (`/about`, `#section`) collapses onto the current origin and
 * counts as internal; anything pointing at a different host — including
 * host-less schemes such as `mailto:` and `tel:` — counts as external.
 *
 * Stateless: the only side effect is the {@link track} call into the capture
 * core, which buffers the event and lets the core's flush triggers ship it.
 * Nothing here is `flush`ed eagerly — a link activation is routine navigation,
 * not a "last chance" signal like an error.
 *
 * Design reference: §5.2 (`link` event), decision D5.
 */

import { track } from "./core";
import type { AnalyticsEvent } from "./types";

/* -------------------------------------------------------------------------- */
/* External-link classification (design D5)                                   */
/* -------------------------------------------------------------------------- */

/**
 * Decide whether `href` points off the current origin.
 *
 * The href is resolved against the document's current location, so a relative
 * path or a bare fragment collapses onto the current origin. A link is external
 * when its resolved host differs from the host the page is served from — a
 * comparison that also catches host-less schemes (`mailto:`, `tel:`), whose
 * empty host never matches the page host and so correctly read as leaving the
 * site.
 *
 * An href that cannot be parsed at all is treated as internal: an unparseable
 * value is far more likely a malformed in-app link than a deliberate jump to
 * another origin, and the classifier must never throw into the caller.
 */
function isExternalHref(href: string): boolean {
  try {
    const destination = new URL(href, window.location.href);
    return destination.host !== window.location.host;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* trackLink                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Record a `link` {@link AnalyticsEvent} for an activated link.
 *
 * @param name - Human-facing label / accessible name of the link. Stored as
 *   the event's `label`.
 * @param href - Destination URL. May be absolute, relative, a bare fragment,
 *   or a host-less scheme; {@link isExternalHref} resolves it to set the
 *   event's `external` flag.
 */
export function trackLink(name: string, href: string): void {
  const event: AnalyticsEvent = {
    type: "link",
    href,
    external: isExternalHref(href),
    label: name,
  };
  track(event);
}
