import { chunkDocument } from "@/lib/rag/chunkDocument";
import { embedTexts } from "@/lib/rag/embeddings";
import { indexDocumentChunks } from "@/lib/rag/vectorStore";
import type { IndexingStage, ParsedDocument, UploadedDocument } from "@/lib/types";

interface IndexParsedDocumentParams {
  parsedDocument: ParsedDocument;
  sessionId: string;
  onStatus?: (stage: IndexingStage, message: string) => void;
}

export async function indexParsedDocument({
  parsedDocument,
  sessionId,
  onStatus,
}: IndexParsedDocumentParams): Promise<UploadedDocument> {
  const sourceId = crypto.randomUUID();

  onStatus?.("chunking", "Splitting the document into overlapping chunks...");
  const chunks = await chunkDocument(parsedDocument, sessionId, sourceId);

  onStatus?.("embedding", "Creating embeddings for each document chunk...");
  const embeddings = await embedTexts(chunks.map((chunk) => chunk.text));

  onStatus?.(
    "storing",
    "Saving chunk vectors to the configured vector store...",
  );
  const storageMode = await indexDocumentChunks({
    chunks,
    embeddings,
  });

  return {
    sessionId,
    sourceId,
    fileName: parsedDocument.fileName,
    fileType: parsedDocument.fileType,
    sourceType: parsedDocument.sourceType,
    sourceUrl: parsedDocument.sourceUrl,
    pageCount: parsedDocument.pageCount,
    chunkCount: chunks.length,
    storageMode,
  };
}
