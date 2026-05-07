import { NextResponse } from "next/server";
import { MAX_FILE_SIZE_BYTES } from "@/lib/env";
import { chunkDocument } from "@/lib/rag/chunkDocument";
import { embedTexts } from "@/lib/rag/embeddings";
import { extractTextFromFile } from "@/lib/rag/extractText";
import { clearSessionVectors, indexDocumentChunks } from "@/lib/rag/vectorStore";
import type { IndexingStage } from "@/lib/types";
import type { UploadStreamEvent } from "@/lib/types";

export const runtime = "nodejs";

function isSupportedUpload(fileName: string, mimeType: string) {
  const lowerName = fileName.toLowerCase();

  return (
    lowerName.endsWith(".pdf") ||
    lowerName.endsWith(".txt") ||
    mimeType === "application/pdf" ||
    mimeType === "text/plain"
  );
}

function streamEvent(controller: ReadableStreamDefaultController, event: UploadStreamEvent) {
  controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event)}\n`));
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file was uploaded. Choose a PDF or text file to continue." },
      { status: 400 },
    );
  }

  if (!isSupportedUpload(file.name, file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a PDF or plain text file only." },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Keep uploads at 10MB or smaller." },
      { status: 400 },
    );
  }

  const sessionId = crypto.randomUUID();

  const stream = new ReadableStream({
    async start(controller) {
      let currentStage: IndexingStage = "extracting";

      try {
        streamEvent(controller, {
          type: "status",
          stage: "extracting",
          message: "Extracting text from the uploaded document...",
        });

        const buffer = Buffer.from(await file.arrayBuffer());
        const parsedDocument = await extractTextFromFile({
          fileName: file.name,
          mimeType: file.type,
          buffer,
        });

        currentStage = "chunking";
        streamEvent(controller, {
          type: "status",
          stage: "chunking",
          message: "Splitting the document into overlapping chunks...",
        });

        const chunks = await chunkDocument(parsedDocument, sessionId);

        currentStage = "embedding";
        streamEvent(controller, {
          type: "status",
          stage: "embedding",
          message: "Creating embeddings for each document chunk...",
        });

        const embeddings = await embedTexts(chunks.map((chunk) => chunk.text));

        currentStage = "storing";
        streamEvent(controller, {
          type: "status",
          stage: "storing",
          message: "Saving chunk vectors to the configured vector store...",
        });

        const storageMode = await indexDocumentChunks({
          chunks,
          embeddings,
        });

        streamEvent(controller, {
          type: "complete",
          data: {
            sessionId,
            fileName: parsedDocument.fileName,
            fileType: parsedDocument.fileType,
            pageCount: parsedDocument.pageCount,
            chunkCount: chunks.length,
            storageMode,
          },
        });
      } catch (error) {
        streamEvent(controller, {
          type: "error",
          stage: currentStage,
          error:
            error instanceof Error
              ? error.message
              : "Something went wrong while indexing the uploaded document.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { sessionId?: string };

    if (body.sessionId) {
      await clearSessionVectors(body.sessionId);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
