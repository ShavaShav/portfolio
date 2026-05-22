import { useCallback, useRef, useState } from "react";

import { trackApiCall } from "../analytics";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type CompanionContext = {
  /** Companion identity / situational awareness passed to the API */
  mode: "standby" | "active" | "copilot";
  currentPlanetId?: string;
  currentPlanetLabel?: string;
  visitedPlanetLabels: string[];
  missionTitle?: string;
  scenarioContext?: string;
};

const API_URL =
  import.meta.env.VITE_API_URL || "https://portfolio-api.vercel.app";

export function useChat(sessionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserMessageRef = useRef<string>("");
  const lastContextRef = useRef<CompanionContext | undefined>(undefined);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const sendMessage = useCallback(
    async (text: string, context?: CompanionContext) => {
      if (!text.trim() || isLoading) return;

      lastUserMessageRef.current = text;
      lastContextRef.current = context;

      const userMsg: ChatMessage = { role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const decoder = new TextDecoder();
        let botContent = "";
        let assistantAdded = false;

        // Wrap the streaming chat fetch in trackApiCall so the round trip is
        // timed and recorded as an `api_call` event (design D11). The wrapper
        // owns the body read loop; each decoded chunk arrives via onChunk and
        // is streamed into the assistant message, while trackApiCall never
        // rejects — it resolves to a four-way outcome we branch on below.
        const result = await trackApiCall(
          `${API_URL}/api/chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: text,
              sessionId,
              companionContext: context,
            }),
            signal: controller.signal,
          },
          {
            onChunk: (chunk) => {
              botContent += decoder.decode(chunk, { stream: true });
              const current = botContent;
              setMessages((prev) => {
                // First chunk: append the assistant message to stream into.
                if (!assistantAdded) {
                  assistantAdded = true;
                  return [...prev, { role: "assistant", content: current }];
                }
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: current,
                };
                return updated;
              });
            },
          },
        );

        // A user-aborted request is intentional — leave the messages as-is.
        if (result.outcome === "abort") return;

        // A server rejection or transport failure surfaces as a comms error.
        if (result.outcome !== "ok") {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: "COMMS ERROR - Connection lost. Check your connection.",
            },
          ]);
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [isLoading, sessionId],
  );

  const retry = useCallback(() => {
    if (lastUserMessageRef.current) {
      // Remove the error message first
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "system") {
          return prev.slice(0, -1);
        }
        return prev;
      });
      // Also remove the failed user message so sendMessage can re-add it
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "user") {
          return prev.slice(0, -1);
        }
        return prev;
      });
      sendMessage(lastUserMessageRef.current, lastContextRef.current);
    }
  }, [sendMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    sendMessage,
    addMessage,
    isLoading,
    retry,
    clearMessages,
  };
}
