import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  clearConversations as clearConversationsApi,
  createConversation,
  deleteConversation as deleteConversationApi,
  fetchConversations as fetchConversationsApi,
  getConversation as getConversationApi,
  renameConversation as renameConversationApi,
  streamAnswer
} from "@/lib/api";
import type { AppSettings } from "@/lib/settingsStore";
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

export function useChat(settings: AppSettings) {\n  const hasApiKey = settings.doubao.apiKey.trim().length > 0;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversation = useCallback(
    async (conversationId: string) => {
      setIsLoadingMessages(true);
      try {
        if (!hasApiKey) {
          setMessages([]);
          setActiveConversationId(null);
          return;
        }
        const detail = await getConversationApi(conversationId, settings);
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
    },
    [settings, hasApiKey]
  );

  const initialize = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      if (!hasApiKey) {
        setConversations([]);
        setActiveConversationId(null);
        setMessages([]);
        return;
      }
      const { conversations: list } = await fetchConversationsApi(settings);
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
  }, [loadConversation, settings, hasApiKey]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const ensureConversation = useCallback(
    async (question: string) => {
      if (activeConversationId) {
        return activeConversationId;
      }
      const title = deriveTitle(question);
      const detail = await createConversation({ title }, settings);
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
    [activeConversationId, settings]
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
      if (!question.trim()) return;

      if (abortRef.current) {
        abortRef.current.abort();
      }

      const apiKey = settings.doubao.apiKey.trim();
      if (!apiKey) {
        toast.warning("Configure the Doubao API key in API Settings first.");
        return;
      }

      const conversationId = await ensureConversation(question);
      const userMessage = createMessage("user", question);
      const previewMessage = createMessage("assistant", "");

      setMessages((prev) => [...prev, userMessage, previewMessage]);
      updateConversationSummary(conversationId, (summary) => ({
        ...summary,
        updated_at: new Date().toISOString()
      }));

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      try {
        let accumulated = "";
        const resolvedConversationId = await streamAnswer(
          question,
          conversationId,
          settings,
          (chunk) => {
            accumulated += chunk;
            setMessages((prev) =>
              prev.map((message) =>
                message.id === previewMessage.id
                  ? { ...message, content: accumulated }
                  : message
              )
            );
          },
          controller.signal
        );

        setMessages((prev) =>
          prev.map((message) =>
            message.id === previewMessage.id
              ? { ...message, content: accumulated.trim(), createdAt: Date.now() }
              : message
          )
        );

        if (resolvedConversationId) {
          setActiveConversationId(resolvedConversationId);
        }

        updateConversationSummary(conversationId, (summary) => ({
          ...summary,
          updated_at: new Date().toISOString()
        }));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          toast.info("Generation stopped.");
          setMessages((prev) => prev.filter((msg) => msg.id !== previewMessage.id));
        } else {
          const message =
            error instanceof Error ? error.message : "An error occurred while generating a response.";
          toast.error(message);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === previewMessage.id
                ? { ...msg, content: `⚠️ ${message}`, createdAt: Date.now() }
                : msg
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [ensureConversation, settings, updateConversationSummary]
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
      if (!hasApiKey) return;
      try {
        await deleteConversationApi(conversationId, settings);
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
    [activeConversationId, loadConversation, settings, hasApiKey]
  );

  const handleClearConversations = useCallback(async () => {
    if (!hasApiKey) return;
    try {
      await clearConversationsApi(settings);
      setConversations([]);
      setActiveConversationId(null);
      setMessages([]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to clear conversations.";
      toast.error(message);
    }
  }, [settings, hasApiKey]);

  const handleCreateConversation = useCallback(async () => {
    if (!hasApiKey) return;
    try {
      const detail = await createConversation({ title: DEFAULT_TITLE }, settings);
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
  }, [settings, hasApiKey]);

  const handleRenameConversation = useCallback(
    async (conversationId: string, title: string) => {
      try {
        const detail = await renameConversationApi(conversationId, title, settings);
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
    [settings, updateConversationSummary]
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






