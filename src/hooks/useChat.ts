import { useCallback, useEffect, useRef, useState } from "react";

export type CompanionMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type UseChatOptions = {
  onTypingChange?: (isTyping: boolean) => void;
};

const API_URL =
  import.meta.env.VITE_API_URL || "https://portfolio-api.vercel.app";

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());

  const lastPromptRef = useRef<{
    text: string;
    scenarioContext?: string;
  } | null>(null);

  useEffect(() => {
    options.onTypingChange?.(isLoading);
  }, [isLoading, options]);

  const addAssistantMessage = useCallback((content: string) => {
    setMessages((previous) => [
      ...previous,
      {
        id: createMessageId(),
        role: "assistant",
        content,
      },
    ]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (text: string, scenarioContext?: string) => {
      if (!text.trim() || isLoading) {
        return;
      }

      lastPromptRef.current = {
        text,
        scenarioContext,
      };

      const userMessage: CompanionMessage = {
        id: createMessageId(),
        role: "user",
        content: text,
      };
      const assistantMessageId = createMessageId();

      setMessages((previous) => [
        ...previous,
        userMessage,
        { id: assistantMessageId, role: "assistant", content: "" },
      ]);
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch(`${API_URL}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: text,
            sessionId,
            scenarioContext,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          assistantText += decoder.decode(value, { stream: true });

          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: assistantText }
                : message,
            ),
          );
        }
      } catch (caughtError) {
        setError("Connection lost. Please try again.");
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: "Connection lost. Please try again." }
              : message,
          ),
        );

        console.error("companion_chat_error", caughtError);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, sessionId],
  );

  const retryLast = useCallback(async () => {
    if (!lastPromptRef.current) {
      return;
    }

    const { text, scenarioContext } = lastPromptRef.current;
    await sendMessage(text, scenarioContext);
  }, [sendMessage]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    retryLast,
    sessionId,
    addAssistantMessage,
    clearError,
  };
}
