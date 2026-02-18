import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "../../hooks/useChat";
import { CockpitScreen } from "./CockpitScreen";

type CompanionScreenProps = {
  mode?: "standby" | "active" | "copilot";
  planetId?: string;
  planetLabel?: string;
  greeting?: string;
  missionContext?: string;
  onTypingChange?: (isTyping: boolean) => void;
};

export function CompanionScreen({
  mode = "standby",
  planetId,
  planetLabel,
  greeting,
  missionContext,
  onTypingChange,
}: CompanionScreenProps) {
  const {
    addAssistantMessage,
    clearError,
    error,
    isLoading,
    messages,
    retryLast,
    sendMessage,
  } = useChat({
    onTypingChange,
  });

  const [inputText, setInputText] = useState("");
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const greetedPlanetsRef = useRef<Set<string>>(new Set());
  const greetedMissionsRef = useRef<Set<string>>(new Set());
  const lastContextRef = useRef<string>("standby");

  const contextKey = useMemo(() => {
    if (mode === "copilot") {
      return `mission:${missionContext ?? "unknown"}`;
    }

    if (mode === "active") {
      return `planet:${planetId ?? "unknown"}`;
    }

    return "standby";
  }, [missionContext, mode, planetId]);

  useEffect(() => {
    const element = messageContainerRef.current;
    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [isLoading, messages]);

  useEffect(() => {
    if (mode === "standby") {
      lastContextRef.current = "standby";
      return;
    }

    if (lastContextRef.current === contextKey) {
      return;
    }

    lastContextRef.current = contextKey;

    if (mode === "active" && planetId) {
      if (!greetedPlanetsRef.current.has(planetId)) {
        addAssistantMessage(
          greeting ??
            `Welcome to ${planetLabel ?? planetId}. Ask anything about this chapter.`,
        );
        greetedPlanetsRef.current.add(planetId);
      } else {
        addAssistantMessage(`Welcome back to ${planetLabel ?? planetId}.`);
      }
      return;
    }

    if (mode === "copilot" && missionContext) {
      if (!greetedMissionsRef.current.has(missionContext)) {
        addAssistantMessage(
          `Copilot mode engaged for ${missionContext}. Ask for tradeoffs, constraints, or implementation details.`,
        );
        greetedMissionsRef.current.add(missionContext);
      } else {
        addAssistantMessage(`Copilot still online for ${missionContext}.`);
      }
    }
  }, [
    addAssistantMessage,
    contextKey,
    greeting,
    missionContext,
    mode,
    planetId,
    planetLabel,
  ]);

  const statusLabel =
    mode === "copilot"
      ? "COPILOT MODE"
      : mode === "active"
        ? "COMMS ONLINE"
        : "COMMS: STANDBY";

  if (mode === "standby") {
    return (
      <CockpitScreen powered={false} title="COMPANION COMMS">
        <div className="companion-screen">
          <div className="companion-screen__avatar">ZS</div>
          <p>{statusLabel}</p>
          <small>Awaiting planetary context.</small>
        </div>
      </CockpitScreen>
    );
  }

  return (
    <CockpitScreen powered title="COMPANION COMMS">
      <div className="companion-chat">
        <header className="companion-chat__header">
          <div className="companion-screen__avatar">ZS</div>
          <div>
            <p>{statusLabel}</p>
            <small>{mode === "copilot" ? missionContext : planetLabel}</small>
          </div>
        </header>

        <div className="companion-chat__messages" ref={messageContainerRef}>
          {messages.map((message) => (
            <article
              className={`companion-chat__message ${message.role === "user" ? "is-user" : "is-assistant"}`}
              key={message.id}
            >
              {message.content || "..."}
            </article>
          ))}

          {isLoading ? (
            <div className="companion-chat__typing">
              <span />
              <span />
              <span />
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="companion-chat__error">
            <span>{error}</span>
            <button
              onClick={() => {
                clearError();
                void retryLast();
              }}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}

        <form
          className="companion-chat__composer"
          onSubmit={(event) => {
            event.preventDefault();

            const prompt = inputText.trim();
            if (!prompt || isLoading) {
              return;
            }

            setInputText("");
            void sendMessage(
              prompt,
              mode === "copilot"
                ? missionContext
                : `${planetLabel ?? planetId ?? "general"}`,
            );
          }}
        >
          <input
            onChange={(event) => setInputText(event.target.value)}
            placeholder="Ask me anything..."
            value={inputText}
          />
          <button disabled={isLoading || !inputText.trim()} type="submit">
            Send
          </button>
        </form>
      </div>
    </CockpitScreen>
  );
}
