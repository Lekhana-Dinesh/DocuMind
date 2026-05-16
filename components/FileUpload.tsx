"use client";

import { useRef, useState } from "react";

interface FileUploadProps {
  onSelectFile: (file: File) => Promise<void>;
  onSelectUrl: (url: string) => Promise<void>;
  isUploading: boolean;
  disabled?: boolean;
  hasWorkspace: boolean;
  workspaceSourceCount: number;
}

const MAX_FILE_SIZE_MB = 10;

export function FileUpload({
  onSelectFile,
  onSelectUrl,
  isUploading,
  disabled,
  hasWorkspace,
  workspaceSourceCount,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<"file" | "url">("file");
  const [url, setUrl] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file || disabled || isUploading) {
      return;
    }

    await onSelectFile(file);
  }

  async function handleUrlSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = url.trim();
    if (!trimmed || disabled || isUploading) {
      return;
    }

    await onSelectUrl(trimmed);
    setUrl("");
  }

  return (
    <div className="glass-panel rounded-[28px] p-6 shadow-soft">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-pine/70">
            Add source
          </p>
          <h2 className="mt-2 text-2xl text-ink">
            Build a grounded document workspace
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink/72">
            Index PDFs, text files, CSV files, and web pages. Every answer stays
            tied to the content you explicitly ingested.
          </p>
        </div>

        <div className="rounded-[22px] border border-ink/10 bg-white/82 p-4 text-sm text-ink/72">
          <p className="font-semibold text-ink">Workspace</p>
          <p className="mt-1 leading-6">
            {hasWorkspace
              ? `${workspaceSourceCount} source${workspaceSourceCount === 1 ? "" : "s"} indexed`
              : "No sources indexed yet"}
          </p>
        </div>
      </div>

      <div className="mt-6 inline-flex rounded-full border border-ink/10 bg-white/80 p-1">
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === "file"
              ? "bg-pine text-white"
              : "text-ink/70 hover:text-ink"
          }`}
        >
          Upload file
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === "url"
              ? "bg-pine text-white"
              : "text-ink/70 hover:text-ink"
          }`}
        >
          Ingest URL
        </button>
      </div>

      {mode === "file" ? (
        <>
          <div className="mt-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-ink">
                Upload PDF, TXT, or CSV
              </p>
              <p className="mt-1 text-sm leading-6 text-ink/65">
                DocuMind accepts .pdf, .txt, and .csv files up to{" "}
                {MAX_FILE_SIZE_MB}MB.
              </p>
            </div>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || isUploading}
              className="rounded-full bg-pine px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:bg-pine/50"
            >
              Choose file
            </button>
          </div>

          <div
            role="presentation"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={async (event) => {
              event.preventDefault();
              setIsDragging(false);
              await handleFile(event.dataTransfer.files?.[0]);
            }}
            className={`mt-6 rounded-[24px] border border-dashed px-6 py-10 text-center transition ${
              isDragging
                ? "border-surf bg-surf/12"
                : "border-ink/15 bg-white/70 hover:border-surf/60 hover:bg-white"
            } ${disabled || isUploading ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sand text-2xl text-pine">
              PDF
            </div>
            <p className="mt-4 text-lg font-semibold text-ink">
              Drop a file here or click to browse
            </p>
            <p className="mt-2 text-sm text-ink/65">
              Server-side extraction, chunking, embeddings, and retrieval happen
              after upload.
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt,.csv,text/plain,application/pdf,text/csv,application/vnd.ms-excel"
            className="hidden"
            onChange={async (event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];

              try {
                await handleFile(file);
              } finally {
                input.value = "";
              }
            }}
          />
        </>
      ) : (
        <form onSubmit={handleUrlSubmit} className="mt-6 rounded-[24px] border border-ink/10 bg-white/78 p-5">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-base font-semibold text-ink">Index a web page</p>
              <p className="mt-1 text-sm leading-6 text-ink/65">
                Paste a URL to fetch and index its readable page content. The app
                uses it only after it has been ingested.
              </p>
            </div>

            <label className="sr-only" htmlFor="source-url">
              Web page URL
            </label>
            <input
              id="source-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/article"
              disabled={disabled || isUploading}
              className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/40 focus:border-pine disabled:cursor-not-allowed"
            />

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs leading-5 text-ink/55">
                Use web pages that you want included in the indexed workspace.
              </p>
              <button
                type="submit"
                disabled={disabled || isUploading || !url.trim()}
                className="rounded-full bg-pine px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:bg-pine/50"
              >
                Index web page
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
