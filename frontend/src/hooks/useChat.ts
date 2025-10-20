import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  clearConversations as clearConversationsApi,
  createConversation,
  deleteConversation as deleteConversationApi,
  fetchConversations,
  getConversation,
  renameConversation as renameConversationApi,
  streamAnswer
} from "@/lib/api";
import type { ChatMessage, ConversationSummary } from "@/types";

const DEFAULT_TITLE = "New conversation";

const createMessage = (
  role: ChatMessage["role"],
  content: string
): ChatMessage => ({
  id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  content,
  createdAt: Date.now()
});

const deriveTitle = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return DEFAULT_TITLE;
  const clipped = trimmed.split(/\s+/).slice(0, 12).join(" ");
  return clipped.slice(0, 48);
};

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversation = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const detail = await getConversation(conversationId);
      const { conversation } = detail;
      setActiveConversationId(conversation.id);
      const mapped = conversation.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: new Date(message.created_at).getTime()
      })) as ChatMessage[];
      setMessages(mapped);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load conversation history.";
      toast.error(message);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const initialize = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      const { conversations: list } = await fetchConversations();
      setConversations(list);
      if (list.length > 0) {
        await loadConversation(list[0].id);
      } else {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to fetch conversations.";
      toast.error(message);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [loadConversation]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const ensureConversation = useCallback(
    async (question: string) => {
      if (activeConversationId) {
        return activeConversationId;
      }
      const title = deriveTitle(question);
      const detail = await createConversation({ title });
      const {
        conversation: { id, created_at, updated_at, title: storedTitle }
      } = detail;
      setConversations((prev) => [
        {
          id,
          title: storedTitle,
          created_at,
          updated_at
        },
        ...prev
      ]);
      setActiveConversationId(id);
      setMessages([]);
      return id;
    },
    [activeConversationId]
  );

  const updateConversationSummary = useCallback(
    (
      conversationId: string,
      updater: (summary: ConversationSummary) => ConversationSummary
    ) => {
      setConversations((prev) => {
        const current = prev.find((item) => item.id === conversationId);
        if (!current) return prev;
        const updated = updater(current);
        const remaining = prev.filter((item) => item.id !== conversationId);
        return [updated, ...remaining];
      });
    },
    []
  );

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let conversationId = await ensureConversation(trimmed);

        const userMessage = createMessage("user", trimmed);
        const assistantMessage = createMessage("assistant", "");

        const nowIso = new Date().toISOString();

        updateConversationSummary(conversationId, (summary) => ({
          ...summary,
          title: summary.title === DEFAULT_TITLE ? deriveTitle(trimmed) : summary.title,
          updated_at: nowIso
        }));

        setMessages((prev) => [...prev, userMessage, assistantMessage]);
        setIsStreaming(true);

        const resolvedConversationId = await streamAnswer(
          trimmed,
          conversationId,
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

        if (resolvedConversationId && resolvedConversationId !== conversationId) {
          conversationId = resolvedConversationId;
          setActiveConversationId(resolvedConversationId);
        }

        const updatedAt = new Date().toISOString();
        updateConversationSummary(conversationId, (summary) => ({
          ...summary,
          updated_at: updatedAt
        }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "The assistant failed to respond.";
        toast.error(message);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.role === "assistant" && msg.content === ""
              ? {
                  ...msg,
                  content: "Sorry, something went wrong while generating a reply."
                }
              : msg
          )
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [ensureConversation, updateConversationSummary]
  );

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  const handleSelectConversation = useCallback(
    async (conversationId: string) => {
      if (conversationId === activeConversationId) return;
      await loadConversation(conversationId);
    },
    [activeConversationId, loadConversation]
  );

  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      try {
        await deleteConversationApi(conversationId);
        let nextId: string | null = null;
        setConversations((prev) => {
          const remaining = prev.filter((item) => item.id !== conversationId);
          if (activeConversationId === conversationId) {
            nextId = remaining.length > 0 ? remaining[0].id : null;
          }
          return remaining;
        });

        if (activeConversationId === conversationId) {
          if (nextId) {
            await loadConversation(nextId);
          } else {
            setActiveConversationId(null);
            setMessages([]);
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to delete conversation.";
        toast.error(message);
      }
    },
    [activeConversationId, loadConversation]
  );

  const handleClearConversations = useCallback(async () => {
    try {
      await clearConversationsApi();
      setConversations([]);
      setActiveConversationId(null);
      setMessages([]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to clear conversations.";
      toast.error(message);
    }
  }, []);

  const handleCreateConversation = useCallback(async () => {
    try {
      const detail = await createConversation({ title: DEFAULT_TITLE });
      const {
        conversation: { id, title, created_at, updated_at }
      } = detail;
      setConversations((prev) => [
        { id, title, created_at, updated_at },
        ...prev
      ]);
      setActiveConversationId(id);
      setMessages([]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create conversation.";
      toast.error(message);
    }
  }, []);

  const handleRenameConversation = useCallback(
    async (conversationId: string, title: string) => {
      try {
        const detail = await renameConversationApi(conversationId, title);
        const {
          conversation: { title: updatedTitle, updated_at }
        } = detail;
        updateConversationSummary(conversationId, (summary) => ({
          ...summary,
          title: updatedTitle,
          updated_at
        }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to rename conversation.";
        toast.error(message);
      }
    },
    [updateConversationSummary]
  );

  const hasMessages = useMemo(() => messages.length > 0, [messages.length]);

  return {
    messages,
    isStreaming,
    hasMessages,
    ask,
    stop,
    conversations,
    activeConversationId,
    isLoadingConversations,
    isLoadingMessages,
    selectConversation: handleSelectConversation,
    createConversation: handleCreateConversation,
    deleteConversation: handleDeleteConversation,
    clearConversations: handleClearConversations,
    renameConversation: handleRenameConversation
  };
}

export type ChatController = ReturnType<typeof useChat>;
