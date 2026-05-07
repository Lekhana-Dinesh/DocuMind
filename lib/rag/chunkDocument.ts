import type { DocumentChunk, ParsedDocument } from "@/lib/types";

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 120;

function cleanChunkText(text: string) {
  return text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function findChunkBoundary(text: string, start: number) {
  const maxEnd = Math.min(start + CHUNK_SIZE, text.length);

  if (maxEnd >= text.length) {
    return text.length;
  }

  const minimumPreferredEnd = start + Math.floor(CHUNK_SIZE * 0.6);
  const boundaries = [
    { index: text.lastIndexOf("\n\n", maxEnd), width: 2 },
    { index: text.lastIndexOf("\n", maxEnd), width: 1 },
    { index: text.lastIndexOf(". ", maxEnd), width: 2 },
    { index: text.lastIndexOf(" ", maxEnd), width: 1 },
  ];

  const preferredBoundary = boundaries.find(
    (boundary) => boundary.index >= minimumPreferredEnd,
  );

  if (!preferredBoundary) {
    return maxEnd;
  }

  return preferredBoundary.index + preferredBoundary.width;
}

function splitIntoOverlappingChunks(text: string) {
  const normalized = cleanChunkText(text);
  const chunks: string[] = [];

  if (!normalized) {
    return chunks;
  }

  let start = 0;

  while (start < normalized.length) {
    const end = findChunkBoundary(normalized, start);
    const chunk = normalized.slice(start, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(end - CHUNK_OVERLAP, start + 1);

    while (start < normalized.length && /\s/.test(normalized[start])) {
      start += 1;
    }
  }

  return chunks;
}

export async function chunkDocument(
  document: ParsedDocument,
  sessionId: string,
): Promise<DocumentChunk[]> {
  const units =
    document.pages.length > 0 ? document.pages : [{ text: document.text }];
  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;

  for (const unit of units) {
    if (!unit.text.trim()) {
      continue;
    }

    const splitTexts = splitIntoOverlappingChunks(unit.text);

    for (const text of splitTexts) {
      const normalized = text.trim();
      if (!normalized) {
        continue;
      }

      chunks.push({
        id: crypto.randomUUID(),
        documentId: sessionId,
        sessionId,
        fileName: document.fileName,
        text: normalized,
        pageNumber: unit.pageNumber,
        chunkIndex,
        charCount: normalized.length,
      });
      chunkIndex += 1;
    }
  }

  if (chunks.length === 0) {
    throw new Error("The uploaded document did not produce any usable chunks.");
  }

  return chunks;
}
