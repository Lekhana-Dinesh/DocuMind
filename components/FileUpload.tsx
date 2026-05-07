"use client";

import { useRef, useState } from "react";

interface FileUploadProps {
  onSelect: (file: File) => Promise<void>;
  isUploading: boolean;
  disabled?: boolean;
  hasDocument: boolean;
}

const MAX_FILE_SIZE_MB = 10;

export function FileUpload({
  onSelect,
  isUploading,
  disabled,
  hasDocument,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file || disabled || isUploading) {
      return;
    }

    await onSelect(file);
  }

  return (
    <div className="glass-panel rounded-[28px] p-6 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-pine/70">
            Upload
          </p>
          <h2 className="mt-2 text-2xl text-ink">Add a PDF or text file</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink/72">
            Upload a document and ask questions grounded in its content.
            DocuMind accepts .pdf and .txt files up to {MAX_FILE_SIZE_MB}MB.
          </p>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isUploading}
          className="rounded-full bg-pine px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:bg-pine/50"
        >
          {hasDocument ? "Upload another file" : "Choose file"}
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
          Drop your file here or click to browse
        </p>
        <p className="mt-2 text-sm text-ink/65">
          Server-side extraction, chunking, embeddings, and retrieval happen
          after upload.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,text/plain,application/pdf"
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
    </div>
  );
}
