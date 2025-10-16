import { ChatMessage } from "@/types";
import clsx from "clsx";

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
          message.content.split("\n").map((line, index) => (
            <p key={index} className="whitespace-pre-wrap">
              {line}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
