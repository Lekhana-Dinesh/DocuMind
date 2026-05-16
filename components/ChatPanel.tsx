"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (question: string) => Promise<void>;
  disabled: boolean;
  isAsking: boolean;
}

function getRetrievalModeLabel(mode: ChatMessage["retrievalMode"]) {
  if (mode === "corrected") {
    return "Corrected retrieval";
  }

  if (mode === "insufficient") {
    return "Insufficient context";
  }

  return "Direct retrieval";
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
          Corrective RAG
        </span>
      </div>

      <div
        ref={listRef}
        className="mt-6 flex-1 space-y-4 overflow-y-auto rounded-[24px] border border-ink/10 bg-white/72 p-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-56 items-center justify-center rounded-[20px] border border-dashed border-ink/12 bg-mist/40 p-6 text-center">
            <p className="max-w-md text-sm leading-7 text-ink/65">
              Add one or more sources first, then ask questions like
              {" "}&#34;Summarize the main argument&#34; or
              {" "}&#34;What does the policy say about pricing?&#34;.
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

              {message.role === "assistant" && message.retrievalMode ? (
                <div className="mb-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] opacity-75">
                  <span className="rounded-full border border-current/15 px-2 py-1">
                    {getRetrievalModeLabel(message.retrievalMode)}
                  </span>
                  {message.rewrittenQuery ? (
                    <span className="rounded-full border border-current/15 px-2 py-1">
                      Query refined
                    </span>
                  ) : null}
                </div>
              ) : null}

              <p>{message.content}</p>

              {message.role === "assistant" && message.rewrittenQuery ? (
                <p className="mt-3 text-xs leading-6 opacity-80">
                  Refined query: {message.rewrittenQuery}
                </p>
              ) : null}

              {message.role === "assistant" && message.evaluationReason ? (
                <p className="mt-2 text-xs leading-6 opacity-80">
                  {message.evaluationReason}
                </p>
              ) : null}
            </div>
          ))
        )}

        {isAsking ? (
          <div className="max-w-[90%] rounded-[22px] bg-mist px-4 py-3 text-sm text-ink">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
              DocuMind
            </p>
            <p>Retrieving relevant chunks, checking support, and composing a grounded answer...</p>
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="mt-4">
        <label className="sr-only" htmlFor="question">
          Ask a question about the indexed sources
        </label>
        <div className="flex flex-col gap-3 rounded-[24px] border border-ink/10 bg-white/86 p-3">
          <textarea
            id="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={disabled || isAsking}
            rows={3}
            placeholder="Ask a question about the indexed sources..."
            className="w-full resize-none border-0 bg-transparent px-2 py-2 text-sm leading-7 text-ink outline-none placeholder:text-ink/40 disabled:cursor-not-allowed"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs leading-5 text-ink/55">
              Answers are restricted to retrieved source context.
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
