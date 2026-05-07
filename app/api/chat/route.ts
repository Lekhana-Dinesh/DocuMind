import { NextResponse } from "next/server";
import { z } from "zod";
import { generateGroundedAnswer, REFUSAL_MESSAGE } from "@/lib/rag/generateAnswer";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve";
import type { ChatApiResponse, SourceSnippet } from "@/lib/types";

export const runtime = "nodejs";

const chatRequestSchema = z.object({
  sessionId: z.string().min(1),
  question: z.string().min(2).max(2000),
});

export async function POST(request: Request) {
  try {
    const payload = chatRequestSchema.parse(await request.json());
    const retrievedChunks = await retrieveRelevantChunks({
      documentId: payload.sessionId,
      question: payload.question,
      limit: 4,
    });

    if (retrievedChunks.length === 0) {
      const response: ChatApiResponse = {
        answer: REFUSAL_MESSAGE,
        refused: true,
        sources: [],
        citationIds: [],
      };

      return NextResponse.json(response);
    }

    const generation = await generateGroundedAnswer({
      question: payload.question,
      sources: retrievedChunks,
    });

    const citedSources =
      generation.citationIds.length > 0
        ? generation.citationIds
            .map((id) => retrievedChunks[Number(id.replace("S", "")) - 1])
            .filter(Boolean)
        : retrievedChunks;

    const sources: SourceSnippet[] = citedSources.map((source) => ({
      id: source.id,
      fileName: source.fileName,
      text: source.text,
      pageNumber: source.pageNumber,
      chunkIndex: source.chunkIndex,
      score: source.score,
    }));

    const response: ChatApiResponse = {
      answer: generation.answer,
      refused: generation.refused,
      sources,
      citationIds: generation.citationIds,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Something went wrong while generating the answer.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
