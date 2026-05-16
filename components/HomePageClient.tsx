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
  RetrievalMode,
  SourceSnippet,
  SourceType,
  UploadedDocument,
  UploadStreamEvent,
} from "@/lib/types";

interface HomePageClientProps {
  qdrantConfigured: boolean;
}

interface RetrievalMeta {
  retrievalMode: RetrievalMode;
  originalQuery: string;
  finalQuery: string;
  rewrittenQuery?: string;
  evaluationReason: string;
}

const STEP_TEMPLATE: IndexingStep[] = [
  {
    key: "extracting",
    label: "Extracting text",
    description: "Read the source and extract clean text with source metadata where available.",
    status: "pending",
  },
  {
    key: "chunking",
    label: "Splitting into chunks",
    description: "Break the source into overlapping sections for semantic retrieval.",
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
    label: "Ready to answer",
    description: "The indexed workspace is ready for grounded questions and source-backed answers.",
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
  ready: "Ready to answer",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIndexingStage(value: unknown): value is IndexingStage {
  return typeof value === "string" && STEP_ORDER.includes(value as IndexingStage);
}

function isSourceType(value: unknown): value is SourceType {
  return (
    value === "pdf" ||
    value === "text" ||
    value === "csv" ||
    value === "web_page"
  );
}

function isRetrievalMode(value: unknown): value is RetrievalMode {
  return value === "direct" || value === "corrected" || value === "insufficient";
}

function isUploadedDocument(value: unknown): value is UploadedDocument {
  return (
    isRecord(value) &&
    typeof value.sessionId === "string" &&
    typeof value.sourceId === "string" &&
    typeof value.fileName === "string" &&
    typeof value.fileType === "string" &&
    isSourceType(value.sourceType) &&
    (value.sourceUrl === undefined || typeof value.sourceUrl === "string") &&
    typeof value.pageCount === "number" &&
    typeof value.chunkCount === "number" &&
    (value.storageMode === "qdrant" || value.storageMode === "memory")
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
  return isRecord(event) && event.type === "complete" && isUploadedDocument(event.data);
}

function isSourceSnippet(value: unknown): value is SourceSnippet {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.sourceId === "string" &&
    typeof value.fileName === "string" &&
    typeof value.fileType === "string" &&
    isSourceType(value.sourceType) &&
    (value.sourceUrl === undefined || typeof value.sourceUrl === "string") &&
    typeof value.text === "string" &&
    (value.pageNumber === undefined || typeof value.pageNumber === "number") &&
    typeof value.chunkIndex === "number" &&
    (value.score === undefined || typeof value.score === "number")
  );
}

function isChatApiResponse(payload: unknown): payload is ChatApiResponse {
  return (
    isRecord(payload) &&
    typeof payload.answer === "string" &&
    typeof payload.refused === "boolean" &&
    Array.isArray(payload.sources) &&
    payload.sources.every(isSourceSnippet) &&
    Array.isArray(payload.citationIds) &&
    payload.citationIds.every((value) => typeof value === "string") &&
    isRetrievalMode(payload.retrievalMode) &&
    typeof payload.originalQuery === "string" &&
    typeof payload.finalQuery === "string" &&
    (payload.rewrittenQuery === undefined ||
      typeof payload.rewrittenQuery === "string") &&
    typeof payload.evaluationReason === "string"
  );
}

function formatUploadFailure(stage: IndexingStage | null, message: string) {
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

function formatSourceType(sourceType: SourceType) {
  if (sourceType === "web_page") {
    return "Web page";
  }

  if (sourceType === "csv") {
    return "CSV";
  }

  if (sourceType === "pdf") {
    return "PDF";
  }

  return "Text";
}

function getRetrievalModeLabel(mode: RetrievalMode) {
  if (mode === "corrected") {
    return "Corrected retrieval";
  }

  if (mode === "insufficient") {
    return "Insufficient context";
  }

  return "Direct retrieval";
}

export function HomePageClient({ qdrantConfigured }: HomePageClientProps) {
  const [steps, setSteps] = useState<IndexingStep[]>(STEP_TEMPLATE);
  const [summary, setSummary] = useState<string | null>(null);
  const [documentInfo, setDocumentInfo] = useState<UploadedDocument | null>(null);
  const [indexedSources, setIndexedSources] = useState<UploadedDocument[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sources, setSources] = useState<SourceSnippet[]>([]);
  const [lastRetrievalMeta, setLastRetrievalMeta] = useState<RetrievalMeta | null>(
    null,
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAsking, setIsAsking] = useState(false);

  const hasWorkspace = Boolean(documentInfo);
  const isReady = Boolean(documentInfo && !isUploading);
  const storageBadge = qdrantConfigured
    ? "Qdrant Cloud configured"
    : "In-memory local mode";
  const totalChunkCount = indexedSources.reduce(
    (sum, source) => sum + source.chunkCount,
    0,
  );

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

  async function clearWorkspace(shouldCallApi = true) {
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
        // Clearing the server-side workspace is helpful but non-blocking for the UI.
      }
    }

    setDocumentInfo(null);
    setIndexedSources([]);
    setMessages([]);
    setSources([]);
    setLastRetrievalMeta(null);
    setUploadError(null);
    setChatError(null);
    resetSteps();
  }

  async function runIndexingRequest(
    startRequest: () => Promise<Response>,
    successMessage: (sourceCount: number) => string,
  ) {
    const hadWorkspace = Boolean(documentInfo?.sessionId);
    const existingWorkspace = documentInfo;
    const existingSources = indexedSources;

    setIsUploading(true);
    setUploadError(null);
    setChatError(null);

    if (!hadWorkspace) {
      setMessages([]);
      setSources([]);
      setLastRetrievalMeta(null);
    }

    resetSteps();

    const completedSources: UploadedDocument[] = [];
    let lastStage: IndexingStage | null = null;
    let errorStage: IndexingStage | null = null;
    let errorMessage: string | null = null;

    try {
      const response = await startRequest();

      if (!response.ok || !response.body) {
        let message = "Indexing failed while starting the request.";

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
          throw new Error("Indexing stream returned an invalid response.");
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
          completedSources.push(event.data);
          return;
        }

        throw new Error("Indexing stream returned an unknown event.");
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

      const finalizedSource = completedSources.at(-1);

      if (!finalizedSource) {
        throw new Error(errorMessage ?? "The indexing stream ended before completion.");
      }

      const updatedSources =
        existingWorkspace?.sessionId === finalizedSource.sessionId
          ? [...existingSources, finalizedSource]
          : [finalizedSource];

      updateStepStatus("ready");
      setSummary(successMessage(updatedSources.length));
      setDocumentInfo(finalizedSource);
      setIndexedSources(updatedSources);
      setSources([]);
      setLastRetrievalMeta(null);
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            updatedSources.length === 1
              ? `I indexed ${finalizedSource.fileName} into ${finalizedSource.chunkCount} chunks. Ask a question and I'll answer only from the indexed content.`
              : `I added ${finalizedSource.fileName} to the workspace. ${updatedSources.length} sources are now indexed across ${updatedSources.reduce((sum, source) => sum + source.chunkCount, 0)} chunks.`,
        },
      ]);
    } catch (error) {
      const rawMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong while indexing the source.";
      const hasCompletedSource = completedSources.length > 0;
      const resolvedFailedStage = errorStage ?? (hasCompletedSource ? null : lastStage);
      const displayMessage = formatUploadFailure(resolvedFailedStage, rawMessage);

      if (resolvedFailedStage) {
        updateStepStatus(resolvedFailedStage, true);
      }

      setSummary(displayMessage);
      setUploadError(displayMessage);

      if (!hadWorkspace) {
        setDocumentInfo(null);
        setIndexedSources([]);
        setMessages([]);
        setSources([]);
        setLastRetrievalMeta(null);
      }
    } finally {
      setIsUploading(false);
    }
  }

  async function handleFileUpload(file: File) {
    const currentSessionId = documentInfo?.sessionId;

    await runIndexingRequest(
      () => {
        const formData = new FormData();
        formData.append("file", file);

        if (currentSessionId) {
          formData.append("sessionId", currentSessionId);
        }

        return fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
      },
      (sourceCount) =>
        sourceCount === 1
          ? "Document indexed successfully. You can now ask questions."
          : "Source indexed successfully. You can now ask questions across all indexed content.",
    );
  }

  async function handleUrlIngest(url: string) {
    const currentSessionId = documentInfo?.sessionId;

    await runIndexingRequest(
      () =>
        fetch("/api/ingest-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url,
            sessionId: currentSessionId,
          }),
        }),
      (sourceCount) =>
        sourceCount === 1
          ? "Web page indexed successfully. You can now ask questions."
          : "Source indexed successfully. You can now ask questions across all indexed content.",
    );
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

      const retrievalMeta: RetrievalMeta = {
        retrievalMode: payload.retrievalMode,
        originalQuery: payload.originalQuery,
        finalQuery: payload.finalQuery,
        rewrittenQuery: payload.rewrittenQuery,
        evaluationReason: payload.evaluationReason,
      };

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.answer,
          refused: payload.refused,
          sources: payload.sources,
          retrievalMode: payload.retrievalMode,
          finalQuery: payload.finalQuery,
          rewrittenQuery: payload.rewrittenQuery,
          evaluationReason: payload.evaluationReason,
        },
      ]);
      setSources(payload.sources);
      setLastRetrievalMeta(retrievalMeta);
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
          retrievalMode: "insufficient",
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
                Grounded answers over the sources you actually indexed
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-ink/74">
                Add documents and web pages, ask natural language questions, and
                review the exact snippets behind every response. DocuMind uses a
                corrective retrieval loop to retry weak searches before it answers.
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
              onSelectFile={handleFileUpload}
              onSelectUrl={handleUrlIngest}
              isUploading={isUploading}
              hasWorkspace={hasWorkspace}
              workspaceSourceCount={indexedSources.length}
            />

            <StatusSteps steps={steps} summary={summary} isBusy={isUploading} />

            {uploadError ? (
              <div className="glass-panel rounded-[24px] border border-coral/30 bg-coral/8 p-5 text-sm leading-7 text-ink">
                <p className="font-semibold text-coral">Indexing error</p>
                <p className="mt-2">{uploadError}</p>
              </div>
            ) : null}

            {documentInfo ? (
              <div className="glass-panel rounded-[24px] p-5 shadow-soft">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pine/70">
                      Indexed workspace
                    </p>
                    <h2 className="mt-2 text-xl text-ink">
                      {indexedSources.length} source
                      {indexedSources.length === 1 ? "" : "s"} indexed
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-ink/72">
                      {totalChunkCount} chunks across the current workspace. Session
                      ID: {documentInfo.sessionId}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => clearWorkspace(true)}
                    className="rounded-full border border-ink/14 px-4 py-3 text-sm font-semibold text-ink transition hover:border-pine hover:text-pine"
                  >
                    Clear workspace
                  </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {indexedSources.map((source) => (
                    <div
                      key={source.sourceId}
                      className="rounded-[20px] border border-ink/10 bg-white/78 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-pine/70">
                        <span>{formatSourceType(source.sourceType)}</span>
                        <span className="rounded-full bg-sand px-2 py-1 text-pine">
                          {source.chunkCount} chunk{source.chunkCount === 1 ? "" : "s"}
                        </span>
                        {source.pageCount > 0 ? (
                          <span className="rounded-full bg-surf/14 px-2 py-1 text-ink">
                            {source.pageCount} page{source.pageCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm font-semibold text-ink">
                        {source.fileName}
                      </p>
                      {source.sourceUrl ? (
                        <a
                          href={source.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex text-xs text-pine underline-offset-4 hover:underline"
                        >
                          {source.sourceUrl}
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>

                {documentInfo.storageMode === "memory" ? (
                  <p className="mt-4 rounded-2xl bg-sand px-4 py-3 text-sm leading-6 text-pine">
                    In-memory local mode is active for this workspace. Configure
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-pine/70">
                Sources
              </p>
              <h2 className="mt-2 text-2xl text-ink">Retrieved snippets</h2>
            </div>
            <span className="rounded-full bg-surf/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink">
              {lastRetrievalMeta
                ? getRetrievalModeLabel(lastRetrievalMeta.retrievalMode)
                : "Grounding"}
            </span>
          </div>

          {lastRetrievalMeta ? (
            <div className="mt-5 rounded-[22px] border border-ink/10 bg-white/76 p-4 text-sm leading-7 text-ink/74">
              <p className="font-semibold text-ink">
                Retrieval decision: {getRetrievalModeLabel(lastRetrievalMeta.retrievalMode)}
              </p>
              <p className="mt-2">{lastRetrievalMeta.evaluationReason}</p>
              {lastRetrievalMeta.rewrittenQuery ? (
                <p className="mt-2">
                  Final retrieval query: {lastRetrievalMeta.finalQuery}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            {sources.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-ink/12 bg-white/70 p-6 text-center">
                <p className="mx-auto max-w-xl text-sm leading-7 text-ink/62">
                  {lastRetrievalMeta?.retrievalMode === "insufficient"
                    ? "DocuMind refused the last question because the indexed workspace did not provide enough support for a grounded answer."
                    : "Retrieved source snippets appear here after each answer so you can verify the context behind the response."}
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
              DocuMind helps users ask questions over PDFs, text files, CSV files,
              and indexed web pages without losing track of where the answer came
              from.
            </p>
            <p>
              Each response is generated from retrieved source snippets, so users
              can review the supporting context instead of trusting a black-box
              answer.
            </p>
            <p>
              Use it for study notes, reports, policies, research papers, product
              documents, and other sources where grounded answers matter.
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
