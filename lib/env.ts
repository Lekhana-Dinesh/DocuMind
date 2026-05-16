export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export function getServerEnv() {
  return {
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? "",
    geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    geminiEmbeddingModel:
      process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001",
    qdrantUrl: process.env.QDRANT_URL?.trim() ?? "",
    qdrantApiKey: process.env.QDRANT_API_KEY?.trim() ?? "",
    qdrantCollection:
      process.env.QDRANT_COLLECTION?.trim() || "documind_rag",
  };
}

export function assertGeminiConfigured() {
  const env = getServerEnv();

  if (!env.geminiApiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add it to your environment before uploading or chatting.",
    );
  }

  return env;
}

export function isQdrantConfigured() {
  return Boolean(getServerEnv().qdrantUrl);
}

export function assertQdrantConfigured() {
  const env = getServerEnv();

  if (!env.qdrantUrl) {
    throw new Error(
      "QDRANT_URL is not configured. Leave it blank to use in-memory local mode, or set both QDRANT_URL and QDRANT_API_KEY for Qdrant Cloud.",
    );
  }

  if (!env.qdrantApiKey) {
    throw new Error("QDRANT_API_KEY is missing while QDRANT_URL is configured.");
  }

  return env;
}
