import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Edit2, Eraser, Loader2, MoreHorizontal, Plus, Send, Square, Trash2 } from "lucide-react";
import MessageBubble from "./MessageBubble";
import type { ChatController } from "@/hooks/useChat";

interface ChatWindowProps {
  chat: ChatController;
  apiReady: boolean;
  onOpenSettings: () => void;
}

export default function ChatWindow({ chat, apiReady, onOpenSettings }: ChatWindowProps) {
  const [input, setInput] = useState("");
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const activeConversation = useMemo(
    () => chat.conversations.find((item) => item.id === chat.activeConversationId) ?? null,
    [chat.conversations, chat.activeConversationId]
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [chat.messages]);

  useEffect(() => {
    if (!isActionsOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setIsActionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [isActionsOpen]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim() || !apiReady) return;
    void chat.ask(input.trim());
    setInput("");
  };

  const handleRename = () => {
    if (!chat.activeConversationId || !activeConversation) return;
    const next = window.prompt("Enter a new title for this conversation:", activeConversation.title);
    if (!next || !next.trim()) return;
    void chat.renameConversation(chat.activeConversationId, next.trim());
  };

  const handleCreateConversation = () => {
    setIsActionsOpen(false);
    void chat.createConversation();
  };

  const handleDeleteConversation = () => {
    setIsActionsOpen(false);
    if (!chat.activeConversationId || !activeConversation) return;
    if (window.confirm(`Delete conversation "${activeConversation.title}"? This cannot be undone.`)) {
      void chat.deleteConversation(chat.activeConversationId);
    }
  };

  const handleClearConversations = () => {
    setIsActionsOpen(false);
    if (chat.conversations.length === 0) return;
    if (!window.confirm("Clear all conversations? This cannot be undone.")) return;
    void chat.clearConversations();
  };

  return (
    <main className="flex flex-1 flex-col bg-slate-900/60">
      <header className="border-b border-slate-800 bg-slate-900/80 px-8 py-5 backdrop-blur">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-100">Personal Knowledge Assistant</h2>
              <p className="text-sm text-slate-400">
                Manage conversations and ask questions grounded in your private documents.
              </p>
            </div>
            <div className="relative" ref={actionsRef}>
              <button
                type="button"
                onClick={() => setIsActionsOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-1 text-sm text-accent transition hover:bg-accent/20"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {isActionsOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-32 rounded-lg border border-slate-700 bg-slate-900/95 p-2 shadow-xl">
                  <button
                    type="button"
                    onClick={handleCreateConversation}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800/70"
                  >
                    <Plus className="h-4 w-4 text-accent" />
                    New
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteConversation}
                    disabled={!chat.activeConversationId}
                    className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={handleClearConversations}
                    className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800/70"
                  >
                    <Eraser className="h-4 w-4" />
                    Clear all
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          {!apiReady ? (
            <div className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <p>No Doubao API key is configured yet. Add one in API Settings before asking questions.</p>
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-2 rounded-md border border-amber-500/60 px-3 py-1 text-xs font-medium text-amber-100 hover:bg-amber-500/10"
                onClick={onOpenSettings}
              >
                Open API Settings
              </button>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Active conversation:
            </label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  className="min-w-[220px] rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
                  value={chat.activeConversationId ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value) return;
                    void chat.selectConversation(value);
                  }}
                  disabled={chat.isLoadingConversations || chat.conversations.length === 0}
                >
                  {chat.conversations.length === 0 ? <option value="">No conversations</option> : null}
                  {chat.conversations.map((conversation) => (
                    <option key={conversation.id} value={conversation.id}>
                      {conversation.title}
                    </option>
                  ))}
                </select>
                {chat.isLoadingConversations ? (
                  <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-accent" />
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleRename}
                disabled={!chat.activeConversationId}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Rename
              </button>
              <span className="text-xs text-slate-500">
                {chat.conversations.length} conversation(s)
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <div ref={viewportRef} className="h-full space-y-4 overflow-y-auto px-8 py-6">
          {chat.isLoadingMessages ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
              <div className="flex items-center gap-2 text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading conversation...
              </div>
            </div>
          ) : null}
          {chat.messages.length === 0 ? (
            <div className="mt-24 flex flex-col items-center text-center text-slate-400">
              <p className="text-lg font-medium">Ready when you are</p>
              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Upload files, select a conversation, and ask any question about their content.
              </p>
            </div>
          ) : (
            chat.messages.map((message) => <MessageBubble key={message.id} message={message} />)
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-800 bg-slate-900/80 px-8 py-4">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-3 focus-within:border-accent">
          <textarea
            rows={3}
            placeholder="Type your question. Press Enter to send, Shift + Enter for a new line."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (input.trim() && apiReady) {
                  void chat.ask(input.trim());
                  setInput("");
                }
              }
            }}
            className="h-24 w-full resize-none bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            disabled={chat.isStreaming || !apiReady}
          />
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Markdown formatting is supported.</span>
            <div className="flex items-center gap-2">
              {chat.isStreaming ? (
                <button
                  type="button"
                  onClick={chat.stop}
                  className="inline-flex items-center gap-1 rounded-full border border-red-500/60 px-3 py-1 text-red-300 transition hover:bg-red-500/10"
                >
                  <Square className="h-3 w-3" />
                  Stop
                </button>
              ) : null}
              <button
                type="submit"
                disabled={!input.trim() || chat.isStreaming || !apiReady}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-slate-900 transition hover:bg-accentMuted disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      </form>
    </main>
  );
}
