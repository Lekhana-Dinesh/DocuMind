import { evaluateRetrieval } from "@/lib/rag/evaluateRetrieval";
import { rewriteQueryForRetrieval } from "@/lib/rag/queryRewrite";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve";
import type { RetrievedChunk } from "@/lib/types";

interface CorrectiveRetrieveParams {
  documentId: string;
  question: string;
  limit?: number;
}

interface CorrectiveRetrieveResult {
  finalQuery: string;
  originalQuery: string;
  retrievalMode: "direct" | "corrected" | "insufficient";
  rewrittenQuery?: string;
  evaluationReason: string;
  chunks: RetrievedChunk[];
}

function normalizeQuery(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export async function correctiveRetrieve({
  documentId,
  question,
  limit,
}: CorrectiveRetrieveParams): Promise<CorrectiveRetrieveResult> {
  const originalChunks = await retrieveRelevantChunks({
    documentId,
    question,
    limit,
  });
  const firstEvaluation = evaluateRetrieval({
    question,
    chunks: originalChunks,
  });

  if (firstEvaluation.isRelevant) {
    return {
      finalQuery: question,
      originalQuery: question,
      retrievalMode: "direct",
      evaluationReason: firstEvaluation.reason,
      chunks: originalChunks,
    };
  }

  const rewrite = await rewriteQueryForRetrieval({
    originalQuestion: question,
    retrievedChunks: originalChunks,
  });
  const rewrittenQuery = rewrite.rewrittenQuery.trim() || question.trim();

  const correctedChunks = await retrieveRelevantChunks({
    documentId,
    question: rewrittenQuery,
    limit,
  });
  const secondEvaluation = evaluateRetrieval({
    question,
    chunks: correctedChunks,
  });

  if (secondEvaluation.isRelevant) {
    return {
      finalQuery: rewrittenQuery,
      originalQuery: question,
      retrievalMode:
        normalizeQuery(rewrittenQuery) === normalizeQuery(question)
          ? "direct"
          : "corrected",
      rewrittenQuery:
        normalizeQuery(rewrittenQuery) === normalizeQuery(question)
          ? undefined
          : rewrittenQuery,
      evaluationReason: `Initial retrieval was weak. ${rewrite.reason} ${secondEvaluation.reason}`.trim(),
      chunks: correctedChunks,
    };
  }

  return {
    finalQuery: rewrittenQuery,
    originalQuery: question,
    retrievalMode: "insufficient",
    rewrittenQuery:
      normalizeQuery(rewrittenQuery) === normalizeQuery(question)
        ? undefined
        : rewrittenQuery,
    evaluationReason: `Initial retrieval was weak. ${rewrite.reason} ${secondEvaluation.reason}`.trim(),
    chunks: correctedChunks,
  };
}
