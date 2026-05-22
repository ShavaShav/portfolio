/**
 * Unit tests for the action → analytics-event mapper (design §14.8).
 *
 * {@link actionToEvents} is the single pure function of `actionEvents.ts`: it
 * turns an {@link AppAction} into the {@link AnalyticsEvent}s it should emit.
 * Being side-effect-free and dependent only on the read-only `AppAction` type,
 * it is the most directly unit-testable piece of the capture layer. These
 * tests walk the whole D4 mapping table, with deliberate attention to the
 * `FLYING_*` edges — the transient in-flight transitions that must map to
 * *nothing* so navigation paths stay over the stable destinations only.
 */

import { describe, expect, it } from "vitest";

import type { AppAction } from "../../state/AppState";
import { actionToEvents } from "../actionEvents";
import type { AnalyticsEvent, ViewName } from "../types";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Assert that `events` is exactly one bare `view` event for `name` — i.e. the
 * mapper produced a single destination view with the `from` / `dwellMs`
 * cross-action fields left as `null` placeholders.
 */
function expectSingleView(events: AnalyticsEvent[], name: ViewName): void {
  expect(events).toEqual([{ type: "view", name, from: null, dwellMs: null }]);
}

/**
 * Every variant of {@link AppAction}, one representative each. Used by the
 * sweep tests so a new action added to the reducer surfaces here.
 */
const ALL_ACTIONS: AppAction[] = [
  { type: "LAUNCH" },
  { type: "FLY_TO_PLANET", planetId: "mars" },
  { type: "ARRIVE_AT_PLANET", planetId: "mars" },
  { type: "FLY_HOME" },
  { type: "ARRIVE_HOME" },
  { type: "DISENGAGE_PLANET" },
  { type: "ENTER_MISSION", planetId: "mars", missionId: "rover" },
  { type: "EXIT_MISSION" },
  { type: "TOGGLE_AUDIO" },
  { type: "COMPANION_SHOW", context: "intro" },
  { type: "COMPANION_HIDE" },
  {
    type: "COMPANION_ADD_MESSAGE",
    message: { role: "user", content: "hi", createdAt: "2026-05-22T00:00:00Z" },
  },
  { type: "COMPANION_SET_TYPING", isTyping: true },
  { type: "SET_NEAREST_PLANET", planetId: "mars" },
];

/* -------------------------------------------------------------------------- */
/* Destination views                                                          */
/* -------------------------------------------------------------------------- */

describe("actionToEvents — destination views", () => {
  it("maps LAUNCH to a solar_system view", () => {
    expectSingleView(actionToEvents({ type: "LAUNCH" }), "solar_system");
  });

  it("maps ARRIVE_HOME to a solar_system view", () => {
    expectSingleView(actionToEvents({ type: "ARRIVE_HOME" }), "solar_system");
  });

  it("maps DISENGAGE_PLANET to a solar_system view", () => {
    expectSingleView(
      actionToEvents({ type: "DISENGAGE_PLANET" }),
      "solar_system",
    );
  });

  it("maps ARRIVE_AT_PLANET to a planet_detail view", () => {
    expectSingleView(
      actionToEvents({ type: "ARRIVE_AT_PLANET", planetId: "mars" }),
      "planet_detail",
    );
  });

  it("maps EXIT_MISSION to a planet_detail view", () => {
    expectSingleView(actionToEvents({ type: "EXIT_MISSION" }), "planet_detail");
  });

  it("maps ENTER_MISSION to a mission view", () => {
    const action: AppAction = {
      type: "ENTER_MISSION",
      planetId: "mars",
      missionId: "x",
    };
    expectSingleView(actionToEvents(action), "mission");
  });

  it("emits exactly one event per navigation action", () => {
    const navActions: AppAction[] = [
      { type: "LAUNCH" },
      { type: "ARRIVE_HOME" },
      { type: "DISENGAGE_PLANET" },
      { type: "ARRIVE_AT_PLANET", planetId: "mars" },
      { type: "EXIT_MISSION" },
      { type: "ENTER_MISSION", planetId: "mars", missionId: "x" },
    ];
    for (const action of navActions) {
      expect(actionToEvents(action)).toHaveLength(1);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* FLYING_* edge cases                                                        */
/* -------------------------------------------------------------------------- */

describe("actionToEvents — FLYING_* edge cases", () => {
  it("emits nothing for FLY_TO_PLANET (in-flight edge, not a destination)", () => {
    expect(actionToEvents({ type: "FLY_TO_PLANET", planetId: "mars" })).toEqual(
      [],
    );
  });

  it("emits nothing for FLY_HOME (in-flight edge, not a destination)", () => {
    expect(actionToEvents({ type: "FLY_HOME" })).toEqual([]);
  });

  it("never produces a flying_* view name for any action", () => {
    const flyingNames: ViewName[] = ["flying_to_planet", "flying_home"];
    for (const action of ALL_ACTIONS) {
      for (const event of actionToEvents(action)) {
        if (event.type === "view") {
          expect(flyingNames).not.toContain(event.name);
        }
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Non-navigation actions                                                     */
/* -------------------------------------------------------------------------- */

describe("actionToEvents — non-navigation actions emit nothing", () => {
  const silent: AppAction[] = [
    { type: "TOGGLE_AUDIO" },
    { type: "COMPANION_SHOW", context: "intro" },
    { type: "COMPANION_HIDE" },
    {
      type: "COMPANION_ADD_MESSAGE",
      message: {
        role: "assistant",
        content: "hello",
        createdAt: "2026-05-22T00:00:00Z",
      },
    },
    { type: "COMPANION_SET_TYPING", isTyping: false },
    { type: "SET_NEAREST_PLANET", planetId: null },
  ];

  for (const action of silent) {
    it(`emits nothing for ${action.type}`, () => {
      expect(actionToEvents(action)).toEqual([]);
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Robustness & purity                                                        */
/* -------------------------------------------------------------------------- */

describe("actionToEvents — robustness & purity", () => {
  it("emits nothing for an unrecognized action rather than throwing", () => {
    const bogus = { type: "SOMETHING_NEW" } as unknown as AppAction;
    expect(() => actionToEvents(bogus)).not.toThrow();
    expect(actionToEvents(bogus)).toEqual([]);
  });

  it("leaves cross-action fields as null placeholders on view events", () => {
    // `from` / `dwellMs` need running capture state; a single-action mapper
    // cannot know them, so it must hand back nulls for the core to stitch.
    for (const action of ALL_ACTIONS) {
      for (const event of actionToEvents(action)) {
        if (event.type === "view") {
          expect(event.from).toBeNull();
          expect(event.dwellMs).toBeNull();
        }
      }
    }
  });

  it("is pure — repeated calls yield equal but independent results", () => {
    const first = actionToEvents({ type: "LAUNCH" });
    const second = actionToEvents({ type: "LAUNCH" });

    expect(first).toEqual(second);
    // Fresh array and fresh event objects each call — no shared mutable state.
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
  });

  it("does not mutate the action it is given", () => {
    const action: AppAction = { type: "ARRIVE_AT_PLANET", planetId: "mars" };
    const snapshot = JSON.stringify(action);
    actionToEvents(action);
    expect(JSON.stringify(action)).toBe(snapshot);
  });
});
