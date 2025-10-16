import { FormEvent, useEffect, useRef, useState } from "react";
import { Send, Square } from "lucide-react";
import MessageBubble from "./MessageBubble";
import type { ChatController } from "@/hooks/useChat";

type ChatWindowProps = {
  chat: ChatController;
};

export default function ChatWindow({ chat }: ChatWindowProps) {
  const [input, setInput] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [chat.messages]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    chat.ask(input.trim());
    setInput("");
  };

  return (
    <main className="flex flex-1 flex-col bg-slate-900/60">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-8 py-5 backdrop-blur">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">
            Personal Knowledge Assistant
          </h2>
          <p className="text-sm text-slate-400">
            Ask questions and get answers grounded in your private documents.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <div
          ref={viewportRef}
          className="h-full space-y-4 overflow-y-auto px-8 py-6"
        >
          {chat.messages.length === 0 ? (
            <div className="mt-24 flex flex-col items-center text-center text-slate-400">
              <p className="text-lg font-medium">Ready when you are</p>
              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Upload one or more files and then ask any question about their
                content. The assistant will search the knowledge base and stream
                a contextual answer.
              </p>
            </div>
          ) : (
            chat.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-800 bg-slate-900/80 px-8 py-4"
      >
        <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-3 focus-within:border-accent">
          <textarea
            rows={3}
            placeholder="Type your question. Press Enter to send, Shift + Enter for a new line."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (input.trim()) {
                  chat.ask(input.trim());
                  setInput("");
                }
              }
            }}
            className="h-24 w-full resize-none bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            disabled={chat.isStreaming}
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
                disabled={!input.trim() || chat.isStreaming}
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
