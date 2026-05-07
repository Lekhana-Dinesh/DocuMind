"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { FileUpload } from "@/components/FileUpload";
import { HowItWorks } from "@/components/HowItWorks";
import { SourceCard } from "@/components/SourceCard";
import { StatusSteps } from "@/components/StatusSteps";
import type {
  ChatApiResponse,
  ChatMessage,
  IndexingStage,
  IndexingStep,
  SourceSnippet,
  UploadedDocument,
  UploadStreamEvent,
} from "@/lib/types";

interface HomePageClientProps {
  qdrantConfigured: boolean;
}

const STEP_TEMPLATE: IndexingStep[] = [
  {
    key: "extracting",
    label: "Extracting text",
    description: "Read the uploaded file and extract plain text with page metadata when available.",
    status: "pending",
  },
  {
    key: "chunking",
    label: "Splitting into chunks",
    description: "Break the document into overlapping sections for semantic retrieval.",
    status: "pending",
  },
  {
    key: "embedding",
    label: "Creating embeddings",
    description: "Convert each chunk into vectors using Gemini embeddings for semantic retrieval.",
    status: "pending",
  },
  {
    key: "storing",
    label: "Saving to vector database",
    description: "Store chunk vectors in Qdrant Cloud, or an in-memory fallback for local use.",
    status: "pending",
  },
  {
    key: "ready",
    label: "Ready to chat",
    description: "The document is indexed and can now be queried through retrieval-augmented generation.",
    status: "pending",
  },
];

const STEP_ORDER: IndexingStage[] = [
  "extracting",
  "chunking",
  "embedding",
  "storing",
  "ready",
];

const STAGE_LABELS: Record<IndexingStage, string> = {
  extracting: "Extracting text",
  chunking: "Splitting into chunks",
  embedding: "Creating embeddings",
  storing: "Saving to vector database",
  ready: "Ready to chat",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIndexingStage(value: unknown): value is IndexingStage {
  return (
    typeof value === "string" &&
    STEP_ORDER.includes(value as IndexingStage)
  );
}

function isUploadStatusEvent(
  event: unknown,
): event is Extract<UploadStreamEvent, { type: "status" }> {
  return (
    isRecord(event) &&
    event.type === "status" &&
    isIndexingStage(event.stage) &&
    typeof event.message === "string"
  );
}

function isUploadErrorEvent(
  event: unknown,
): event is Extract<UploadStreamEvent, { type: "error" }> {
  return (
    isRecord(event) &&
    event.type === "error" &&
    isIndexingStage(event.stage) &&
    typeof event.error === "string"
  );
}

function isUploadCompleteEvent(
  event: unknown,
): event is Extract<UploadStreamEvent, { type: "complete" }> {
  const data = isRecord(event) ? event.data : null;

  return (
    isRecord(event) &&
    event.type === "complete" &&
    isRecord(data) &&
    typeof data.sessionId === "string" &&
    typeof data.fileName === "string" &&
    typeof data.fileType === "string" &&
    typeof data.pageCount === "number" &&
    typeof data.chunkCount === "number" &&
    (data.storageMode === "qdrant" || data.storageMode === "memory")
  );
}

function isChatApiResponse(payload: unknown): payload is ChatApiResponse {
  return (
    isRecord(payload) &&
    typeof payload.answer === "string" &&
    typeof payload.refused === "boolean" &&
    Array.isArray(payload.sources) &&
    Array.isArray(payload.citationIds)
  );
}

function formatUploadFailure(
  stage: IndexingStage | null,
  message: string,
) {
  if (!stage) {
    return message;
  }

  if (
    stage === "storing" &&
    [
      "Vector database error while saving chunks:",
      "Vector database error while preparing the collection:",
      "Vector database search failed:",
      "Qdrant collection vector size mismatch.",
      "Qdrant collection schema mismatch.",
      "QDRANT_API_KEY is missing while QDRANT_URL is configured.",
    ].some((prefix) => message.startsWith(prefix))
  ) {
    return message;
  }

  return `${STAGE_LABELS[stage]} failed: ${message}`;
}

export function HomePageClient({
  qdrantConfigured,
}: HomePageClientProps) {
  const [steps, setSteps] = useState<IndexingStep[]>(STEP_TEMPLATE);
  const [summary, setSummary] = useState<string | null>(null);
  const [documentInfo, setDocumentInfo] = useState<UploadedDocument | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sources, setSources] = useState<SourceSnippet[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAsking, setIsAsking] = useState(false);

  const hasDocument = Boolean(documentInfo);
  const isReady = Boolean(documentInfo && !isUploading);
  const storageBadge = qdrantConfigured
    ? "Qdrant Cloud configured"
    : "In-memory local mode";

  function resetSteps() {
    setSteps(STEP_TEMPLATE);
    setSummary(null);
  }

  function updateStepStatus(stage: IndexingStage, hasError = false) {
    const stageIndex = STEP_ORDER.indexOf(stage);

    setSteps((current) =>
      current.map((step, index) => {
        if (hasError && step.key === stage) {
          return { ...step, status: "error" };
        }

        if (index < stageIndex) {
          return { ...step, status: "complete" };
        }

        if (index === stageIndex) {
          return {
            ...step,
            status: hasError ? "error" : stage === "ready" ? "complete" : "active",
          };
        }

        if (stage === "ready") {
          return { ...step, status: "complete" };
        }

        return { ...step, status: "pending" };
      }),
    );
  }

  async function clearDocument(shouldCallApi = true) {
    if (shouldCallApi && documentInfo?.sessionId) {
      try {
        await fetch("/api/upload", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId: documentInfo.sessionId }),
        });
      } catch {
        // Clearing the server-side session is helpful but non-blocking for the UI.
      }
    }

    setDocumentInfo(null);
    setMessages([]);
    setSources([]);
    setUploadError(null);
    setChatError(null);
    resetSteps();
  }

  async function handleUpload(file: File) {
    if (documentInfo?.sessionId) {
      await clearDocument(true);
    }

    setIsUploading(true);
    setUploadError(null);
    setChatError(null);
    setMessages([]);
    setSources([]);
    resetSteps();

    const formData = new FormData();
    formData.append("file", file);
    let completed = false;
    let lastStage: IndexingStage | null = null;
    let errorStage: IndexingStage | null = null;
    let errorMessage: string | null = null;

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok || !response.body) {
        let message = "Upload failed while starting document indexing.";

        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) {
            message = payload.error;
          }
        } catch {
          // Fall back to the default message.
        }

        throw new Error(message);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      function processEventLine(rawLine: string) {
        let event: unknown;

        try {
          event = JSON.parse(rawLine);
        } catch {
          throw new Error("Upload stream returned an invalid response.");
        }

        if (isUploadStatusEvent(event)) {
          lastStage = event.stage;
          updateStepStatus(event.stage);
          setSummary(event.message);
          return;
        }

        if (isUploadErrorEvent(event)) {
          errorStage = event.stage;
          errorMessage = event.error;
          throw new Error(event.error);
        }

        if (isUploadCompleteEvent(event)) {
          completed = true;
          updateStepStatus("ready");
          setSummary("Document indexed successfully. You can now ask questions.");
          setDocumentInfo(event.data);
          setMessages([
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `I indexed ${event.data.fileName} into ${event.data.chunkCount} chunks. Ask a question and I'll answer only from the uploaded document.`,
            },
          ]);
          return;
        }

        throw new Error("Upload stream returned an unknown event.");
      }

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          processEventLine(line);
        }

        if (done) {
          if (buffer.trim()) {
            processEventLine(buffer);
            buffer = "";
          }
          break;
        }
      }

      if (!completed) {
        throw new Error(errorMessage ?? "The upload stream ended before indexing completed.");
      }
    } catch (error) {
      const rawMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong while indexing the document.";
      const failedStage = errorStage ?? (completed ? null : lastStage);
      const displayMessage = formatUploadFailure(failedStage, rawMessage);

      if (failedStage) {
        updateStepStatus(failedStage, true);
      }

      setDocumentInfo(null);
      setMessages([]);
      setSources([]);
      setSummary(displayMessage);
      setUploadError(displayMessage);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleAsk(question: string) {
    if (!documentInfo) {
      return;
    }

    setChatError(null);
    setIsAsking(true);
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: question,
      },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: documentInfo.sessionId,
          question,
        }),
      });

      const payload = (await response.json()) as ChatApiResponse | { error?: string };

      if (!response.ok || "error" in payload) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : "Chat failed while generating an answer.",
        );
      }

      if (!isChatApiResponse(payload)) {
        throw new Error("Chat API returned an invalid response.");
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.answer,
          refused: payload.refused,
          sources: payload.sources,
        },
      ]);
      setSources(payload.sources);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while answering the question.";

      setChatError(message);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "I could not answer because the request failed on the server.",
          refused: true,
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <main className="grid-background min-h-screen overflow-x-hidden px-4 pb-14 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="fade-up glass-panel rounded-[32px] px-6 py-6 shadow-soft sm:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-pine/70">
                DocuMind
              </p>
              <h1 className="mt-3 text-4xl leading-tight text-ink sm:text-5xl">
                Chat with PDFs and text files using retrieval-augmented generation.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-ink/74">
                Upload a document, ask questions, and get answers backed by
                source snippets. The pipeline extracts text, chunks content,
                creates embeddings, retrieves semantically relevant sections,
                and generates grounded answers using only retrieved context.
              </p>
            </div>

            <div className="grid gap-3 rounded-[28px] border border-ink/10 bg-white/84 p-5 text-sm text-ink/74 sm:grid-cols-2">
              <div>
                <p className="font-semibold text-ink">Model</p>
                <p className="mt-1 leading-6">
                  Gemini for answer generation and embeddings
                </p>
              </div>
              <div>
                <p className="font-semibold text-ink">Storage</p>
                <p className="mt-1 leading-6">{storageBadge}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.05fr,1.25fr]">
          <div className="space-y-6">
            <FileUpload
              onSelect={handleUpload}
              isUploading={isUploading}
              hasDocument={hasDocument}
            />

            <StatusSteps steps={steps} summary={summary} isBusy={isUploading} />

            {uploadError ? (
              <div className="glass-panel rounded-[24px] border border-coral/30 bg-coral/8 p-5 text-sm leading-7 text-ink">
                <p className="font-semibold text-coral">Upload error</p>
                <p className="mt-2">{uploadError}</p>
              </div>
            ) : null}

            {documentInfo ? (
              <div className="glass-panel rounded-[24px] p-5 shadow-soft">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pine/70">
                      Indexed document
                    </p>
                    <h2 className="mt-2 text-xl text-ink">{documentInfo.fileName}</h2>
                    <p className="mt-2 text-sm leading-6 text-ink/72">
                      {documentInfo.chunkCount} chunks indexed
                      {documentInfo.pageCount > 0
                        ? ` across ${documentInfo.pageCount} page${documentInfo.pageCount === 1 ? "" : "s"}`
                        : ""}
                      . Session ID: {documentInfo.sessionId}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => clearDocument(true)}
                    className="rounded-full border border-ink/14 px-4 py-3 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
                  >
                    Clear document / Upload another document
                  </button>
                </div>

                {documentInfo.storageMode === "memory" ? (
                  <p className="mt-4 rounded-2xl bg-sand px-4 py-3 text-sm leading-6 text-pine">
                    In-memory local mode is active for this session. Configure
                    Qdrant Cloud for persistent vector storage.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <ChatPanel
              messages={messages}
              onSend={handleAsk}
              disabled={!isReady}
              isAsking={isAsking}
            />

            {chatError ? (
              <div className="glass-panel rounded-[24px] border border-coral/30 bg-coral/8 p-5 text-sm leading-7 text-ink">
                <p className="font-semibold text-coral">Chat error</p>
                <p className="mt-2">{chatError}</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-8 glass-panel rounded-[28px] p-6 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-pine/70">
                Sources
              </p>
              <h2 className="mt-2 text-2xl text-ink">Retrieved snippets</h2>
            </div>
            <span className="rounded-full bg-surf/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink">
              Top chunks
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {sources.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-ink/12 bg-white/70 p-6 text-center">
                <p className="mx-auto max-w-xl text-sm leading-7 text-ink/62">
                  Retrieved source snippets appear here after each answer so you
                  can verify the document context behind the response.
                </p>
              </div>
            ) : (
              sources.map((source) => <SourceCard key={source.id} source={source} />)
            )}
          </div>
        </section>

        <section className="mt-8">
          <HowItWorks />
        </section>

        <section className="mt-8 fade-up glass-panel rounded-[32px] p-8 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-pine/70">
            Why DocuMind
          </p>
          <h2 className="mt-2 text-3xl text-ink">
            Reliable document answers with visible sources
          </h2>
          <div className="mt-6 space-y-4 text-sm leading-7 text-ink/74">
            <p>
              DocuMind helps users ask questions over PDFs and text files
              without losing track of where the answer came from.
            </p>
            <p>
              Each response is generated from retrieved document snippets, so
              users can review the source context instead of trusting a
              black-box answer.
            </p>
            <p>
              Use it for study notes, reports, policies, research papers, and
              other documents where grounded answers matter.
            </p>
          </div>
          <a
            href="#how-it-works"
            className="mt-6 inline-flex rounded-full bg-pine px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink"
          >
            View the RAG pipeline
          </a>
        </section>
      </div>
    </main>
  );
}
