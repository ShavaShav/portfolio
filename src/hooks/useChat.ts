import { useCallback, useRef, useState } from "react";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

const API_URL =
  import.meta.env.VITE_API_URL || "https://portfolio-api.vercel.app";

export function useChat(sessionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserMessageRef = useRef<string>("");
  const lastScenarioRef = useRef<string | undefined>(undefined);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const sendMessage = useCallback(
    async (text: string, scenarioContext?: string) => {
      if (!text.trim() || isLoading) return;

      lastUserMessageRef.current = text;
      lastScenarioRef.current = scenarioContext;

      const userMsg: ChatMessage = { role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`${API_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            sessionId,
            scenarioContext,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let botContent = "";

        // Add empty assistant message that we'll stream into
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "" },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          botContent += decoder.decode(value, { stream: true });
          const current = botContent;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: current,
            };
            return updated;
          });
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;

        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: "COMMS ERROR - Connection lost. Check your connection.",
          },
        ]);
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
      sendMessage(lastUserMessageRef.current, lastScenarioRef.current);
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
