import { NextResponse } from "next/server";
import { MAX_FILE_SIZE_BYTES } from "@/lib/env";
import { extractTextFromFile } from "@/lib/rag/extractText";
import { indexParsedDocument } from "@/lib/rag/indexParsedDocument";
import { clearSessionVectors } from "@/lib/rag/vectorStore";
import type { IndexingStage, UploadStreamEvent } from "@/lib/types";

export const runtime = "nodejs";

function isSupportedUpload(fileName: string, mimeType: string) {
  const lowerName = fileName.toLowerCase();

  return (
    lowerName.endsWith(".pdf") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".csv") ||
    mimeType === "application/pdf" ||
    mimeType === "text/plain" ||
    mimeType === "text/csv" ||
    mimeType === "application/csv" ||
    mimeType === "application/vnd.ms-excel"
  );
}

function streamEvent(
  controller: ReadableStreamDefaultController,
  event: UploadStreamEvent,
) {
  controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event)}\n`));
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const sessionIdField = formData.get("sessionId");

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        error:
          "No file was uploaded. Choose a PDF, text file, or CSV to continue.",
      },
      { status: 400 },
    );
  }

  if (!isSupportedUpload(file.name, file.type)) {
    return NextResponse.json(
      {
        error:
          "Unsupported file type. Upload a PDF, plain text file, or CSV only.",
      },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Keep uploads at 10MB or smaller." },
      { status: 400 },
    );
  }

  const sessionId =
    typeof sessionIdField === "string" && sessionIdField.trim()
      ? sessionIdField.trim()
      : crypto.randomUUID();

  const stream = new ReadableStream({
    async start(controller) {
      let currentStage: IndexingStage = "extracting";

      try {
        streamEvent(controller, {
          type: "status",
          stage: "extracting",
          message: "Extracting text from the uploaded source...",
        });

        const buffer = Buffer.from(await file.arrayBuffer());
        const parsedDocument = await extractTextFromFile({
          fileName: file.name,
          mimeType: file.type,
          buffer,
        });

        const indexedSource = await indexParsedDocument({
          parsedDocument,
          sessionId,
          onStatus: (stage, message) => {
            currentStage = stage;
            streamEvent(controller, {
              type: "status",
              stage,
              message,
            });
          },
        });

        streamEvent(controller, {
          type: "complete",
          data: indexedSource,
        });
      } catch (error) {
        streamEvent(controller, {
          type: "error",
          stage: currentStage,
          error:
            error instanceof Error
              ? error.message
              : "Something went wrong while indexing the uploaded source.",
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
