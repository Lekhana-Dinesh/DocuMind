"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (question: string) => Promise<void>;
  disabled: boolean;
  isAsking: boolean;
}

export function ChatPanel({
  messages,
  onSend,
  disabled,
  isAsking,
}: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isAsking]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = question.trim();
    if (!trimmed || disabled || isAsking) {
      return;
    }

    setQuestion("");
    await onSend(trimmed);
  }

  return (
    <div className="glass-panel flex h-full min-h-[38rem] flex-col rounded-[28px] p-6 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-pine/70">
            Chat
          </p>
          <h2 className="mt-2 text-2xl text-ink">Ask grounded questions</h2>
        </div>
        <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-pine">
          RAG only
        </span>
      </div>

      <div
        ref={listRef}
        className="mt-6 flex-1 space-y-4 overflow-y-auto rounded-[24px] border border-ink/10 bg-white/72 p-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-56 items-center justify-center rounded-[20px] border border-dashed border-ink/12 bg-mist/40 p-6 text-center">
            <p className="max-w-md text-sm leading-7 text-ink/65">
              Upload a document first, then ask questions like “Summarize the
              main argument” or “What does the author say about pricing?”.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[90%] rounded-[22px] px-4 py-3 text-sm leading-7 ${
                message.role === "user"
                  ? "ml-auto bg-pine text-white"
                  : message.refused
                    ? "bg-coral/12 text-ink"
                    : "bg-mist text-ink"
              }`}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                {message.role === "user" ? "You" : "DocuMind"}
              </p>
              <p>{message.content}</p>
            </div>
          ))
        )}

        {isAsking ? (
          <div className="max-w-[90%] rounded-[22px] bg-mist px-4 py-3 text-sm text-ink">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
              DocuMind
            </p>
            <p>Retrieving relevant chunks and composing a grounded answer...</p>
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="mt-4">
        <label className="sr-only" htmlFor="question">
          Ask a question about the document
        </label>
        <div className="flex flex-col gap-3 rounded-[24px] border border-ink/10 bg-white/86 p-3">
          <textarea
            id="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={disabled || isAsking}
            rows={3}
            placeholder="Ask a question about the uploaded document..."
            className="w-full resize-none border-0 bg-transparent px-2 py-2 text-sm leading-7 text-ink outline-none placeholder:text-ink/40 disabled:cursor-not-allowed"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs leading-5 text-ink/55">
              Answers are restricted to retrieved document context.
            </p>
            <button
              type="submit"
              disabled={disabled || isAsking || !question.trim()}
              className="rounded-full bg-pine px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:bg-pine/50"
            >
              {isAsking ? "Thinking..." : "Ask DocuMind"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
