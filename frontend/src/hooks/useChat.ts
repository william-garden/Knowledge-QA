import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { streamAnswer } from "@/lib/api";
import { ChatMessage } from "@/types";

const createMessage = (
  role: ChatMessage["role"],
  content: string
): ChatMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  content,
  createdAt: Date.now()
});

const STORAGE_KEY = "pkb-chat-history";

const safeParseMessages = (value: string | null): ChatMessage[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (
          typeof item !== "object" ||
          item === null ||
          (item.role !== "assistant" && item.role !== "user") ||
          typeof item.content !== "string"
        ) {
          return null;
        }

        return {
          id:
            typeof item.id === "string" && item.id.length > 0
              ? item.id
              : `${item.role}-${Date.now()}-${Math.random()
                  .toString(16)
                  .slice(2)}`,
          role: item.role,
          content: item.content,
          createdAt:
            typeof item.createdAt === "number" ? item.createdAt : Date.now()
        } satisfies ChatMessage;
      })
      .filter((msg): msg is ChatMessage => msg !== null);
  } catch {
    return [];
  }
};

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return [];
    return safeParseMessages(window.localStorage.getItem(STORAGE_KEY));
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const ask = useCallback(async (question: string) => {
    if (!question.trim()) return;
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    const userMessage = createMessage("user", question);
    const assistantMessage = createMessage("assistant", "");

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);

    try {
      await streamAnswer(
        question,
        (chunk) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? { ...msg, content: msg.content + chunk }
                : msg
            )
          );
        },
        controller.signal
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error.";
      toast.error(`Failed to generate an answer: ${message}`);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessage.id
            ? {
                ...msg,
                content: "Sorry, something went wrong while generating an answer."
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      setIsStreaming(false);
    }
  }, []);

  const hasMessages = useMemo(() => messages.length > 0, [messages.length]);

  return {
    messages,
    isStreaming,
    hasMessages,
    ask,
    stop
  };
}

export type ChatController = ReturnType<typeof useChat>;
