import { QdrantClient } from "@qdrant/js-client-rest";
import {
  assertQdrantConfigured,
  isQdrantConfigured,
} from "@/lib/env";
import type { DocumentChunk, RetrievedChunk, VectorStoreMode } from "@/lib/types";

interface IndexChunksParams {
  chunks: DocumentChunk[];
  embeddings: number[][];
}

interface SearchChunksParams {
  documentId: string;
  queryEmbedding: number[];
  limit: number;
}

interface MemoryChunkRecord extends DocumentChunk {
  embedding: number[];
}

const VECTOR_SIZE_MISMATCH_MESSAGE =
  "Qdrant collection vector size mismatch. Change QDRANT_COLLECTION or delete the old collection.";
const SCHEMA_MISMATCH_MESSAGE =
  "Qdrant collection schema mismatch. Change QDRANT_COLLECTION to a new unused name or delete the existing collection.";

const memoryStore = new Map<string, MemoryChunkRecord[]>();
let qdrantClient: QdrantClient | null = null;
let ensuredCollection:
  | {
      name: string;
      vectorSize: number;
    }
  | null = null;

function getVectorStoreMode(): VectorStoreMode {
  return isQdrantConfigured() ? "qdrant" : "memory";
}

function cosineSimilarity(left: number[], right: number[]) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  return denominator === 0 ? 0 : dot / denominator;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeSerialize(value: unknown) {
  try {
    const serialized = JSON.stringify(value);
    return serialized && serialized !== "{}" ? serialized : undefined;
  } catch {
    return undefined;
  }
}

function getQdrantErrorDetails(error: unknown) {
  const details: Record<string, unknown> = {};

  if (error instanceof Error) {
    details.name = error.name;
    details.message = error.message;
    details.stackFirstLine = error.stack?.split("\n")[0]?.trim();
  }

  if (isRecord(error)) {
    if (typeof error.name === "string") {
      details.name ??= error.name;
    }
    if (typeof error.message === "string") {
      details.message ??= error.message;
    }
    if (typeof error.status === "string" || typeof error.status === "number") {
      details.status = error.status;
    }
    if (
      typeof error.statusCode === "string" ||
      typeof error.statusCode === "number"
    ) {
      details.statusCode = error.statusCode;
    }
    if (error.cause !== undefined) {
      details.cause =
        typeof error.cause === "string"
          ? error.cause
          : safeSerialize(error.cause) ?? String(error.cause);
    }
    if (error.data !== undefined) {
      details.data = error.data;
    }

    const response = error.response;
    if (isRecord(response)) {
      if (
        typeof response.status === "string" ||
        typeof response.status === "number"
      ) {
        details.responseStatus = response.status;
      }
      if (response.data !== undefined) {
        details.responseData = response.data;
      }
      if (response.body !== undefined) {
        details.responseBody = response.body;
      }
    }
  }

  details.serialized = safeSerialize(error);

  return details;
}

function formatQdrantError(error: unknown) {
  const details = getQdrantErrorDetails(error);
  const responseData = details.responseData;

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData;
  }

  if (isRecord(responseData)) {
    const responseStatus = responseData.status;
    if (
      isRecord(responseStatus) &&
      typeof responseStatus.error === "string" &&
      responseStatus.error.trim()
    ) {
      return responseStatus.error;
    }

    if (typeof responseData.error === "string" && responseData.error.trim()) {
      return responseData.error;
    }
  }

  if (typeof details.responseBody === "string" && details.responseBody.trim()) {
    return details.responseBody;
  }

  if (typeof details.data === "string" && details.data.trim()) {
    return details.data;
  }

  if (typeof details.cause === "string" && details.cause.trim()) {
    return details.cause;
  }

  if (typeof details.message === "string" && details.message.trim()) {
    return details.message;
  }

  if (typeof details.serialized === "string" && details.serialized.trim()) {
    return details.serialized;
  }

  return "Unknown Qdrant error.";
}

function getDefaultVectorSize(vectors: unknown) {
  if (!isRecord(vectors)) {
    return null;
  }

  if (typeof vectors.size === "number") {
    return vectors.size;
  }

  return null;
}

function usesNamedVectors(vectors: unknown) {
  return isRecord(vectors) && typeof vectors.size !== "number";
}

function getVectorMode(vectors: unknown) {
  return usesNamedVectors(vectors) ? "named" : "unnamed";
}

function validateEmbeddings(chunks: DocumentChunk[], embeddings: number[][]) {
  if (chunks.length === 0) {
    throw new Error("No document chunks were produced for vector storage.");
  }

  if (embeddings.length === 0) {
    throw new Error("No embeddings were generated for the document chunks.");
  }

  if (chunks.length !== embeddings.length) {
    throw new Error("Chunk and embedding counts do not match.");
  }

  const vectorSize = embeddings[0]?.length ?? 0;
  if (vectorSize === 0) {
    throw new Error("The first embedding is empty, so the document cannot be indexed.");
  }

  const mismatchedIndex = embeddings.findIndex(
    (embedding) => embedding.length !== vectorSize,
  );

  if (mismatchedIndex !== -1) {
    throw new Error(
      `Embedding dimension mismatch at index ${mismatchedIndex}. Expected ${vectorSize}, received ${embeddings[mismatchedIndex].length}.`,
    );
  }

  return vectorSize;
}

function isRagDebugEnabled() {
  return process.env.DEBUG_RAG === "true";
}

function logQdrantError(params: {
  operation: string;
  collection: string;
  documentId?: string;
  vectorSize?: number;
  chunkCount?: number;
  error: unknown;
  diagnostics?: Record<string, unknown>;
}) {
  console.error("[DocuMind][Qdrant]", {
    operation: params.operation,
    collection: params.collection,
    documentId: params.documentId,
    vectorSize: params.vectorSize,
    chunkCount: params.chunkCount,
    diagnostics: params.diagnostics,
    error: getQdrantErrorDetails(params.error),
  });
}

async function getCollectionDiagnostics(collectionName: string) {
  const client = getQdrantClient();
  const collection = await client.getCollection(collectionName);
  const vectors = collection.config.params.vectors;

  return {
    collectionInfo: collection,
    vectorMode: getVectorMode(vectors),
    storedVectorSize: getDefaultVectorSize(vectors),
    payloadSchema: collection.payload_schema,
    strictMode: collection.config.strict_mode_config ?? null,
  };
}

async function ensureDocumentIdIndex(collectionName: string) {
  const client = getQdrantClient();
  const diagnostics = await getCollectionDiagnostics(collectionName);
  const documentIdSchema = isRecord(diagnostics.payloadSchema)
    ? diagnostics.payloadSchema.documentId
    : undefined;

  if (documentIdSchema) {
    return diagnostics;
  }

  await client.createPayloadIndex(collectionName, {
    wait: true,
    field_name: "documentId",
    field_schema: "keyword",
  });

  return getCollectionDiagnostics(collectionName);
}

function getQdrantClient() {
  const env = assertQdrantConfigured();

  if (!qdrantClient) {
    qdrantClient = new QdrantClient({
      url: env.qdrantUrl,
      apiKey: env.qdrantApiKey || undefined,
    });
  }

  return qdrantClient;
}

async function ensureQdrantCollection(vectorSize: number) {
  const env = assertQdrantConfigured();
  const client = getQdrantClient();

  if (
    ensuredCollection &&
    ensuredCollection.name === env.qdrantCollection &&
    ensuredCollection.vectorSize === vectorSize
  ) {
    return;
  }

  try {
    const collections = await client.getCollections();
    const exists = collections.collections.some(
      (collection) => collection.name === env.qdrantCollection,
    );

    if (!exists) {
      await client.createCollection(env.qdrantCollection, {
        vectors: {
          size: vectorSize,
          distance: "Cosine",
        },
      });
    }

    const diagnostics = await getCollectionDiagnostics(env.qdrantCollection);
    const configuredVectors = diagnostics.collectionInfo.config.params.vectors;

    if (usesNamedVectors(configuredVectors)) {
      throw new Error(SCHEMA_MISMATCH_MESSAGE);
    }

    const configuredSize = getDefaultVectorSize(configuredVectors);

    if (configuredSize !== null && configuredSize !== vectorSize) {
      throw new Error(VECTOR_SIZE_MISMATCH_MESSAGE);
    }

    await ensureDocumentIdIndex(env.qdrantCollection);
  } catch (error) {
    const message = formatQdrantError(error);

    logQdrantError({
      operation: "ensureCollection",
      collection: env.qdrantCollection,
      vectorSize,
      error,
    });

    if (
      message === VECTOR_SIZE_MISMATCH_MESSAGE ||
      message === SCHEMA_MISMATCH_MESSAGE
    ) {
      throw new Error(message);
    }

    throw new Error(
      `Vector database error while preparing the collection: ${message}`,
    );
  }

  ensuredCollection = {
    name: env.qdrantCollection,
    vectorSize,
  };
}

export async function indexDocumentChunks({
  chunks,
  embeddings,
}: IndexChunksParams): Promise<VectorStoreMode> {
  const vectorSize = validateEmbeddings(chunks, embeddings);

  if (getVectorStoreMode() === "memory") {
    memoryStore.set(
      chunks[0].sessionId,
      chunks.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index],
      })),
    );

    return "memory";
  }

  await ensureQdrantCollection(vectorSize);
  const env = assertQdrantConfigured();
  const client = getQdrantClient();

  try {
    await client.upsert(env.qdrantCollection, {
      wait: true,
      points: chunks.map((chunk, index) => ({
        id: chunk.id,
        vector: embeddings[index],
        payload: {
          documentId: chunk.documentId,
          sessionId: chunk.sessionId,
          sourceId: chunk.sourceId,
          fileName: chunk.fileName,
          fileType: chunk.fileType,
          sourceType: chunk.sourceType,
          sourceUrl: chunk.sourceUrl ?? null,
          text: chunk.text,
          pageNumber: chunk.pageNumber ?? null,
          chunkIndex: chunk.chunkIndex,
          charCount: chunk.charCount,
        },
      })),
    });

    if (isRagDebugEnabled()) {
      console.info("[DocuMind][Qdrant][upsert]", {
        collection: env.qdrantCollection,
        pointsUpserted: chunks.length,
        firstDocumentId: chunks[0]?.documentId,
        vectorSize,
      });
    }
  } catch (error) {
    logQdrantError({
      operation: "upsert",
      collection: env.qdrantCollection,
      documentId: chunks[0]?.documentId,
      vectorSize,
      chunkCount: chunks.length,
      error,
    });
    throw new Error(
      `Vector database error while saving chunks: ${formatQdrantError(error)}`,
    );
  }

  return "qdrant";
}

export async function searchDocumentChunks({
  documentId,
  queryEmbedding,
  limit,
}: SearchChunksParams): Promise<RetrievedChunk[]> {
  if (getVectorStoreMode() === "memory") {
    const records = memoryStore.get(documentId) ?? [];

    return [...records]
      .map((record) => ({
        ...record,
        score: cosineSimilarity(queryEmbedding, record.embedding),
      }))
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
      .slice(0, limit);
  }

  const env = assertQdrantConfigured();
  const client = getQdrantClient();
  let diagnostics: Awaited<ReturnType<typeof getCollectionDiagnostics>> | null = null;

  try {
    diagnostics = await getCollectionDiagnostics(env.qdrantCollection);

    if (
      !isRecord(diagnostics.payloadSchema) ||
      !diagnostics.payloadSchema.documentId
    ) {
      diagnostics = await ensureDocumentIdIndex(env.qdrantCollection);
    }

    if (isRagDebugEnabled()) {
      console.info("[DocuMind][Qdrant][search]", {
        collection: env.qdrantCollection,
        documentId,
        queryVectorSize: queryEmbedding.length,
        topK: limit,
        vectorMode: diagnostics.vectorMode,
        storedVectorSize: diagnostics.storedVectorSize,
        payloadSchema: diagnostics.payloadSchema,
        strictMode: diagnostics.strictMode,
      });
    }

    const results = await client.search(env.qdrantCollection, {
      vector: queryEmbedding,
      limit,
      with_payload: true,
      with_vector: false,
      filter: {
        must: [
          {
            key: "documentId",
            match: {
              value: documentId,
            },
          },
        ],
      },
    });

    return results.map((result) => {
      const payload = (result.payload ?? {}) as Record<string, unknown>;

      return {
        id: String(result.id),
        documentId: String(payload.documentId ?? documentId),
        sessionId: String(payload.sessionId ?? documentId),
        sourceId: String(payload.sourceId ?? payload.documentId ?? documentId),
        fileName: String(payload.fileName ?? "document"),
        fileType: String(payload.fileType ?? "text/plain"),
        sourceType:
          payload.sourceType === "pdf" ||
          payload.sourceType === "text" ||
          payload.sourceType === "csv" ||
          payload.sourceType === "web_page"
            ? payload.sourceType
            : "text",
        sourceUrl:
          typeof payload.sourceUrl === "string" && payload.sourceUrl.trim()
            ? payload.sourceUrl
            : undefined,
        text: String(payload.text ?? ""),
        pageNumber:
          typeof payload.pageNumber === "number" ? payload.pageNumber : undefined,
        chunkIndex:
          typeof payload.chunkIndex === "number"
            ? payload.chunkIndex
            : Number(payload.chunkIndex ?? 0),
        charCount:
          typeof payload.charCount === "number"
            ? payload.charCount
            : String(payload.text ?? "").length,
        score: result.score,
      };
    });
  } catch (error) {
    logQdrantError({
      operation: "search",
      collection: env.qdrantCollection,
      documentId,
      vectorSize: queryEmbedding.length,
      error,
      diagnostics: diagnostics
        ? {
            vectorMode: diagnostics.vectorMode,
            storedVectorSize: diagnostics.storedVectorSize,
            payloadSchema: diagnostics.payloadSchema,
            strictMode: diagnostics.strictMode,
          }
        : undefined,
    });
    throw new Error(
      `Vector database search failed: ${formatQdrantError(error)}`,
    );
  }
}

export async function clearSessionVectors(sessionId: string) {
  memoryStore.delete(sessionId);

  if (getVectorStoreMode() === "memory") {
    return;
  }

  const env = assertQdrantConfigured();
  const client = getQdrantClient();

  try {
    await client.delete(env.qdrantCollection, {
      wait: true,
      filter: {
        must: [
          {
            key: "documentId",
            match: {
              value: sessionId,
            },
          },
        ],
      },
    });
  } catch (error) {
    logQdrantError({
      operation: "delete",
      collection: env.qdrantCollection,
      error,
    });
    // Ignore cleanup failures so the UI can still reset its state.
  }
}

export { getVectorStoreMode };
