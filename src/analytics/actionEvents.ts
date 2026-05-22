/**
 * Action → analytics-event mapper.
 *
 * A single pure function, {@link actionToEvents}, that turns an {@link AppAction}
 * into the {@link AnalyticsEvent}s it should produce. This is the "FLYING_*-aware
 * mapping table" of design **D4**.
 *
 * Why drive views off *actions* rather than off `state.view` changes: the app's
 * navigation passes through transient `FLYING_TO_PLANET` / `FLYING_HOME` states
 * (see `AppView` in `src/state/AppState.tsx`). Emitting a `view` event for every
 * `state.view` change would double the length of every navigation path with
 * non-destination "in flight" entries (research §2 refinement, C5). Mapping the
 * *action* instead — `ARRIVE_AT_PLANET → planet_detail`, `LAUNCH` / `ARRIVE_HOME
 * → solar_system`, and so on — and treating `FLY_TO_PLANET` / `FLY_HOME` as
 * edges that emit nothing yields clean paths over the stable destinations only.
 *
 * Purity contract: this module has **no side effects** and **no dependency on
 * `AppState`** beyond the read-only `AppAction` type import. It never reads the
 * store, the clock, or `track()`. That is what makes it the most directly
 * unit-testable piece of the capture layer (tasklist item 13). The dispatch tap
 * (wired in `AppState.tsx`, design D3) is what actually feeds actions through
 * here and forwards the result to `track()`.
 *
 * Design reference: §4.1, §5.1, D4.
 */

import type { AppAction } from "../state/AppState";
import type { AnalyticsEvent, ViewName } from "./types";

/**
 * Build a bare {@link ViewEvent} for `name`.
 *
 * `from` and `dwellMs` are emitted as `null` placeholders: this mapper is a
 * pure function of a *single* action and so cannot know which view preceded
 * this one or how long the user dwelled there. Both fields require cross-action
 * state, which by design lives in the capture core — it stitches the previous
 * view and the dwell duration onto the event when it is tracked. Keeping that
 * state out of here is precisely what preserves this module's testability.
 */
function viewEvent(name: ViewName): AnalyticsEvent {
  return { type: "view", name, from: null, dwellMs: null };
}

/**
 * Map an {@link AppAction} to the {@link AnalyticsEvent}s it should emit.
 *
 * Returns an array so callers have a uniform shape regardless of how many
 * events an action produces; today every action yields either one `view`
 * event or none, but the array keeps the door open without a signature change.
 *
 * The mapping table:
 *
 * | Action               | Emits                  |
 * | -------------------- | ---------------------- |
 * | `LAUNCH`             | `view: solar_system`   |
 * | `ARRIVE_HOME`        | `view: solar_system`   |
 * | `DISENGAGE_PLANET`   | `view: solar_system`   |
 * | `ARRIVE_AT_PLANET`   | `view: planet_detail`  |
 * | `EXIT_MISSION`       | `view: planet_detail`  |
 * | `ENTER_MISSION`      | `view: mission`        |
 * | `FLY_TO_PLANET`      | — (edge, in flight)    |
 * | `FLY_HOME`           | — (edge, in flight)    |
 * | everything else      | — (no view change)     |
 *
 * `TERMINAL` is a valid {@link ViewName} but never appears here: it is the
 * initial view of a load, reached without an action, so the capture core emits
 * it once at init rather than this mapper.
 */
export function actionToEvents(action: AppAction): AnalyticsEvent[] {
  switch (action.type) {
    // --- Actions that land on a stable, recordable destination view --------
    case "LAUNCH":
    case "ARRIVE_HOME":
    case "DISENGAGE_PLANET":
      return [viewEvent("solar_system")];

    case "ARRIVE_AT_PLANET":
    case "EXIT_MISSION":
      return [viewEvent("planet_detail")];

    case "ENTER_MISSION":
      return [viewEvent("mission")];

    // --- Edges: transient in-flight transitions, deliberately not views ----
    // `FLY_TO_PLANET` / `FLY_HOME` enter `FLYING_*` states. They are the
    // motion *between* destinations, not destinations — no event (D4).
    case "FLY_TO_PLANET":
    case "FLY_HOME":
      return [];

    // --- Non-navigation actions: no view change, nothing for this mapper ---
    // Audio toggling, companion-chat state, and nearest-planet tracking do
    // not move the user between views. Any interaction events for these are
    // captured at their UI call sites, not derived from the reducer action.
    case "TOGGLE_AUDIO":
    case "COMPANION_SHOW":
    case "COMPANION_HIDE":
    case "COMPANION_ADD_MESSAGE":
    case "COMPANION_SET_TYPING":
    case "SET_NEAREST_PLANET":
      return [];

    // An unrecognized action (e.g. one added to `AppState.tsx` later) emits
    // nothing rather than throwing — analytics must never break the app.
    default:
      return [];
  }
}
