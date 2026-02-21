import { useEffect, useRef, useState } from "react";
import {
  useChat,
  type ChatMessage,
  type CompanionContext,
} from "../../hooks/useChat";
import { getPlanetById } from "../../data/planets";
import { getMissionForPlanet } from "../../data/missions";
import { useAppDispatch, useAppState } from "../../state/AppState";
import { CockpitScreen } from "./CockpitScreen";

type CompanionScreenProps = {
  mode?: "standby" | "active" | "copilot";
  planetId?: string;
  missionId?: string;
};

export function CompanionScreen({
  mode = "standby",
  planetId,
  missionId,
}: CompanionScreenProps) {
  const { chatSessionId, visitedPlanets } = useAppState();
  const dispatch = useAppDispatch();
  const { messages, sendMessage, addMessage, isLoading, retry } =
    useChat(chatSessionId);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const greetedPlanetsRef = useRef<Set<string>>(new Set());
  const prevModeRef = useRef(mode);

  const isActive = mode === "active" || mode === "copilot";
  const powered = isActive;

  const headerTitle = mode === "copilot" ? "COPILOT MODE" : "COMPANION COMMS";

  // Auto-greeting when arriving at a planet
  useEffect(() => {
    const wasInactive = prevModeRef.current === "standby";
    prevModeRef.current = mode;

    if (!isActive || !planetId) return;
    if (!wasInactive) return;

    const planet = getPlanetById(planetId);
    if (!planet) return;

    if (greetedPlanetsRef.current.has(planetId)) {
      addMessage({
        role: "assistant",
        content: `Welcome back to ${planet.label}.`,
      });
    } else {
      greetedPlanetsRef.current.add(planetId);
      addMessage({
        role: "assistant",
        content: planet.companionGreeting,
      });
    }
  }, [isActive, planetId, addMessage, mode]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    dispatch({ type: "COMPANION_SET_TYPING", isTyping: isLoading });
  }, [isLoading, dispatch]);

  function buildContext(): CompanionContext {
    const planet = planetId ? getPlanetById(planetId) : undefined;
    const mission =
      missionId && planetId ? getMissionForPlanet(planetId) : undefined;

    const visitedLabels = Array.from(visitedPlanets).map((id) => {
      if (id === "about") return "The Sun (About Me)";
      return getPlanetById(id)?.label ?? id;
    });

    return {
      mode,
      currentPlanetId: planetId,
      currentPlanetLabel:
        planet?.label ??
        (planetId === "about" ? "The Sun (About Me)" : undefined),
      visitedPlanetLabels: visitedLabels,
      missionTitle: mission?.title,
      scenarioContext: mission?.scenario ?? mission?.title,
    };
  }

  function handleSend() {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    setInputValue("");
    sendMessage(text, buildContext());
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  const placeholder =
    mode === "copilot" ? "Ask about this mission..." : "Ask me anything...";

  return (
    <CockpitScreen powered={powered} title={headerTitle}>
      <div className={`companion-screen ${isActive ? "is-active" : ""}`}>
        {!isActive ? (
          <div className="companion-screen__standby">
            <div className="companion-screen__avatar">ZS</div>
            <p>COMMS: STANDBY</p>
          </div>
        ) : (
          <>
            <div className="companion-screen__messages">
              {messages.map((msg, index) => (
                <MessageRow
                  key={index}
                  isStreaming={
                    msg.role === "assistant" &&
                    isLoading &&
                    index === messages.length - 1
                  }
                  message={msg}
                  onRetry={msg.role === "system" ? retry : undefined}
                />
              ))}
              {isLoading &&
                messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="companion-screen__typing">
                    <span />
                    <span />
                    <span />
                  </div>
                )}
              <div ref={messagesEndRef} />
            </div>
            <div className="companion-screen__input">
              <input
                disabled={isLoading}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                type="text"
                value={inputValue}
              />
              <button
                disabled={isLoading || !inputValue.trim()}
                onClick={handleSend}
                type="button"
              >
                {"\u2192"}
              </button>
            </div>
          </>
        )}
      </div>
    </CockpitScreen>
  );
}

function MessageRow({
  message,
  isStreaming,
  onRetry,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
  onRetry?: () => void;
}) {
  const isBot = message.role === "assistant";
  const isError = message.role === "system";
  const isUser = message.role === "user";

  let className = "companion-screen__message";
  if (isBot) className += " companion-screen__message--bot";
  if (isUser) className += " companion-screen__message--user";
  if (isError) className += " companion-screen__message--error";

  return (
    <div className={className}>
      {isBot && <span className="companion-screen__badge">ZS</span>}
      <span className="companion-screen__text">
        {message.content}
        {isStreaming && <span className="companion-screen__cursor" />}
      </span>
      {isError && onRetry && (
        <button
          className="companion-screen__retry"
          onClick={onRetry}
          type="button"
        >
          RETRY
        </button>
      )}
    </div>
  );
}
