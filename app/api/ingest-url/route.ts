import { NextResponse } from "next/server";
import { z } from "zod";
import { extractTextFromWebPage } from "@/lib/rag/extractWebPage";
import { indexParsedDocument } from "@/lib/rag/indexParsedDocument";
import type { IndexingStage, UploadStreamEvent } from "@/lib/types";

export const runtime = "nodejs";

const ingestUrlSchema = z.object({
  url: z.string().url(),
  sessionId: z.string().trim().optional(),
});

function streamEvent(
  controller: ReadableStreamDefaultController,
  event: UploadStreamEvent,
) {
  controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event)}\n`));
}

export async function POST(request: Request) {
  let payload: z.infer<typeof ingestUrlSchema>;

  try {
    payload = ingestUrlSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Provide a valid URL to index." },
      { status: 400 },
    );
  }

  const sessionId = payload.sessionId?.trim() || crypto.randomUUID();

  const stream = new ReadableStream({
    async start(controller) {
      let currentStage: IndexingStage = "extracting";

      try {
        streamEvent(controller, {
          type: "status",
          stage: "extracting",
          message: "Fetching and extracting text from the web page...",
        });

        const response = await fetch(payload.url, {
          redirect: "follow",
          headers: {
            "User-Agent": "DocuMind/1.0",
            Accept: "text/html,text/plain;q=0.9,*/*;q=0.2",
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            `Could not fetch the web page (${response.status} ${response.statusText}).`,
          );
        }

        const body = await response.text();
        const parsedDocument = extractTextFromWebPage({
          url: payload.url,
          body,
          contentType: response.headers.get("content-type"),
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
              : "Something went wrong while indexing the web page.",
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
