import { NextResponse } from "next/server";
import { z } from "zod";
import { correctiveRetrieve } from "@/lib/rag/correctiveRetrieve";
import {
  generateGroundedAnswer,
  REFUSAL_MESSAGE,
} from "@/lib/rag/generateAnswer";
import type { ChatApiResponse, SourceSnippet } from "@/lib/types";

export const runtime = "nodejs";

const chatRequestSchema = z.object({
  sessionId: z.string().min(1),
  question: z.string().min(2).max(2000),
});

function mapChunksToSources(chunks: Parameters<typeof generateGroundedAnswer>[0]["sources"]) {
  return chunks.map(
    (source): SourceSnippet => ({
      id: source.id,
      sourceId: source.sourceId,
      fileName: source.fileName,
      fileType: source.fileType,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      text: source.text,
      pageNumber: source.pageNumber,
      chunkIndex: source.chunkIndex,
      score: source.score,
    }),
  );
}

export async function POST(request: Request) {
  try {
    const payload = chatRequestSchema.parse(await request.json());
    const retrieval = await correctiveRetrieve({
      documentId: payload.sessionId,
      question: payload.question,
      limit: 5,
    });

    if (retrieval.retrievalMode === "insufficient" || retrieval.chunks.length === 0) {
      const response: ChatApiResponse = {
        answer: REFUSAL_MESSAGE,
        refused: true,
        sources: [],
        citationIds: [],
        retrievalMode: "insufficient",
        originalQuery: retrieval.originalQuery,
        finalQuery: retrieval.finalQuery,
        rewrittenQuery: retrieval.rewrittenQuery,
        evaluationReason: retrieval.evaluationReason,
      };

      return NextResponse.json(response);
    }

    const generation = await generateGroundedAnswer({
      question: payload.question,
      sources: retrieval.chunks,
    });

    const citedSources =
      generation.citationIds.length > 0
        ? generation.citationIds
            .map((id) => retrieval.chunks[Number(id.replace("S", "")) - 1])
            .filter(Boolean)
        : retrieval.chunks;

    const response: ChatApiResponse = {
      answer: generation.answer,
      refused: generation.refused,
      sources: mapChunksToSources(citedSources),
      citationIds: generation.citationIds,
      retrievalMode: retrieval.retrievalMode,
      originalQuery: retrieval.originalQuery,
      finalQuery: retrieval.finalQuery,
      rewrittenQuery: retrieval.rewrittenQuery,
      evaluationReason: retrieval.evaluationReason,
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
