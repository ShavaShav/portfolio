import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type PropsWithChildren,
} from "react";

export type ChatRole = "system" | "assistant" | "user";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type AppView =
  | { type: "TERMINAL" }
  | { type: "SOLAR_SYSTEM" }
  | { type: "FLYING_TO_PLANET"; planetId: string }
  | { type: "PLANET_DETAIL"; planetId: string }
  | { type: "MISSION"; planetId: string; missionId: string }
  | { type: "FLYING_HOME" };

export type CompanionState = {
  visible: boolean;
  context: string | null;
  messages: ChatMessage[];
  isTyping: boolean;
};

export type AppState = {
  view: AppView;
  audioEnabled: boolean;
  visitedPlanets: Set<string>;
  nearestPlanetId: string | null;
  companion: CompanionState;
  chatSessionId: string;
  transmissionShownPlanets: Set<string>;
};

export type AppAction =
  | { type: "LAUNCH" }
  | { type: "FLY_TO_PLANET"; planetId: string }
  | { type: "ARRIVE_AT_PLANET"; planetId: string }
  | { type: "FLY_HOME" }
  | { type: "ARRIVE_HOME" }
  | { type: "DISENGAGE_PLANET" }
  | { type: "ENTER_MISSION"; planetId: string; missionId: string }
  | { type: "EXIT_MISSION" }
  | { type: "TOGGLE_AUDIO" }
  | { type: "COMPANION_SHOW"; context: string }
  | { type: "COMPANION_HIDE" }
  | { type: "COMPANION_ADD_MESSAGE"; message: ChatMessage }
  | { type: "COMPANION_SET_TYPING"; isTyping: boolean }
  | { type: "SET_NEAREST_PLANET"; planetId: string | null };

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}`;
}

const initialState: AppState = {
  view: { type: "TERMINAL" },
  audioEnabled: false,
  visitedPlanets: new Set<string>(),
  nearestPlanetId: null,
  companion: {
    visible: false,
    context: null,
    messages: [],
    isTyping: false,
  },
  chatSessionId: createSessionId(),
  transmissionShownPlanets: new Set<string>(),
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "LAUNCH": {
      return {
        ...state,
        view: { type: "SOLAR_SYSTEM" },
      };
    }
    case "FLY_TO_PLANET": {
      return {
        ...state,
        view: { type: "FLYING_TO_PLANET", planetId: action.planetId },
      };
    }
    case "ARRIVE_AT_PLANET": {
      const visitedPlanets = new Set(state.visitedPlanets);
      visitedPlanets.add(action.planetId);

      return {
        ...state,
        view: { type: "PLANET_DETAIL", planetId: action.planetId },
        visitedPlanets,
      };
    }
    case "FLY_HOME": {
      return {
        ...state,
        view: { type: "FLYING_HOME" },
      };
    }
    case "ARRIVE_HOME": {
      return {
        ...state,
        view: { type: "SOLAR_SYSTEM" },
      };
    }
    case "DISENGAGE_PLANET": {
      // Immediately return to free-flight without fly-home animation
      if (
        state.view.type !== "PLANET_DETAIL" &&
        state.view.type !== "MISSION"
      ) {
        return state;
      }
      return {
        ...state,
        view: { type: "SOLAR_SYSTEM" },
      };
    }
    case "ENTER_MISSION": {
      return {
        ...state,
        view: {
          type: "MISSION",
          planetId: action.planetId,
          missionId: action.missionId,
        },
      };
    }
    case "EXIT_MISSION": {
      if (state.view.type !== "MISSION") {
        return state;
      }

      return {
        ...state,
        view: { type: "PLANET_DETAIL", planetId: state.view.planetId },
      };
    }
    case "TOGGLE_AUDIO": {
      return {
        ...state,
        audioEnabled: !state.audioEnabled,
      };
    }
    case "COMPANION_SHOW": {
      return {
        ...state,
        companion: {
          ...state.companion,
          visible: true,
          context: action.context,
        },
      };
    }
    case "COMPANION_HIDE": {
      return {
        ...state,
        companion: {
          ...state.companion,
          visible: false,
          context: null,
          isTyping: false,
        },
      };
    }
    case "COMPANION_ADD_MESSAGE": {
      return {
        ...state,
        companion: {
          ...state.companion,
          messages: [...state.companion.messages, action.message],
        },
      };
    }
    case "COMPANION_SET_TYPING": {
      return {
        ...state,
        companion: {
          ...state.companion,
          isTyping: action.isTyping,
        },
      };
    }
    case "SET_NEAREST_PLANET": {
      if (state.nearestPlanetId === action.planetId) {
        return state;
      }
      return {
        ...state,
        nearestPlanetId: action.planetId,
      };
    }
    default: {
      return state;
    }
  }
}

const AppStateContext = createContext<AppState | undefined>(undefined);
const AppDispatchContext = createContext<Dispatch<AppAction> | undefined>(
  undefined,
);

export function AppProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const stateValue = useMemo(() => state, [state]);

  return (
    <AppStateContext.Provider value={stateValue}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used inside AppProvider");
  }

  return context;
}

export function useAppDispatch(): Dispatch<AppAction> {
  const context = useContext(AppDispatchContext);
  if (!context) {
    throw new Error("useAppDispatch must be used inside AppProvider");
  }

  return context;
}

export function useAppContext() {
  return {
    state: useAppState(),
    dispatch: useAppDispatch(),
  };
}
