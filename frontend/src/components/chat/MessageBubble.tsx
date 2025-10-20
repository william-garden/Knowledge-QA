import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { ChatMessage } from "@/types";

type MessageBubbleProps = {
  message: ChatMessage;
};

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";

  return (
    <div
      className={clsx(
        "flex w-full",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      <div
        className={clsx(
          "max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg",
          isAssistant
            ? "rounded-bl-sm bg-slate-800 text-slate-100"
            : "rounded-br-sm bg-accent text-slate-900"
        )}
      >
        {message.content.length === 0 ? (
          <span className="text-slate-400">...</span>
        ) : (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
