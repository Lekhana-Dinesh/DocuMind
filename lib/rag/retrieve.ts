import { embedQuery } from "@/lib/rag/embeddings";
import { searchDocumentChunks } from "@/lib/rag/vectorStore";
import type { RetrievedChunk } from "@/lib/types";

interface RetrieveParams {
  documentId: string;
  question: string;
  limit?: number;
}

const DEFAULT_LIMIT = 5;

function normalizeChunkText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

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

  return results
    .map((chunk) => ({
      ...chunk,
      text: normalizeChunkText(chunk.text),
    }))
    .filter((chunk) => chunk.text.length > 0);
}
