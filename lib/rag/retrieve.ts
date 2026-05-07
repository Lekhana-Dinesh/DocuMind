import { embedQuery } from "@/lib/rag/embeddings";
import { searchDocumentChunks } from "@/lib/rag/vectorStore";
import type { RetrievedChunk } from "@/lib/types";

interface RetrieveParams {
  documentId: string;
  question: string;
  limit?: number;
}

const DEFAULT_LIMIT = 4;
const MIN_SOURCE_TEXT_LENGTH = 80;
const MIN_COMBINED_CONTEXT_LENGTH = 160;
const MIN_TOP_SCORE = 0.18;

export async function retrieveRelevantChunks({
  documentId,
  question,
  limit = DEFAULT_LIMIT,
}: RetrieveParams): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(question);
  const results = await searchDocumentChunks({
    documentId,
    queryEmbedding,
    limit,
  });

  const usable = results.filter((chunk) => chunk.text.trim().length >= MIN_SOURCE_TEXT_LENGTH);
  const combinedLength = usable.reduce((sum, chunk) => sum + chunk.text.length, 0);
  const topScore = usable[0]?.score ?? 0;

  if (usable.length === 0 || combinedLength < MIN_COMBINED_CONTEXT_LENGTH) {
    return [];
  }

  if (typeof usable[0]?.score === "number" && topScore < MIN_TOP_SCORE) {
    return [];
  }

  return usable;
}
