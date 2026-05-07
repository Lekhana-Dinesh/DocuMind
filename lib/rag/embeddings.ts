import "server-only";
import { GoogleGenAI } from "@google/genai";
import { assertGeminiConfigured } from "@/lib/env";

const EMBEDDING_BATCH_SIZE = 32;

let geminiClient: GoogleGenAI | null = null;

export function getGeminiClient() {
  const env = assertGeminiConfigured();

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: env.geminiApiKey,
    });
  }

  return geminiClient;
}

export async function embedTexts(texts: string[]) {
  if (texts.length === 0) {
    return [];
  }

  const env = assertGeminiConfigured();
  const client = getGeminiClient();
  const embeddings: number[][] = [];

  for (let index = 0; index < texts.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(index, index + EMBEDDING_BATCH_SIZE);
    const response = await client.models.embedContent({
      model: env.geminiEmbeddingModel,
      contents: batch,
      config: {
        taskType: "RETRIEVAL_DOCUMENT",
      },
    });

    if (!response.embeddings || response.embeddings.length !== batch.length) {
      throw new Error("Gemini did not return embeddings for every document chunk.");
    }

    embeddings.push(
      ...response.embeddings.map((item) => {
        if (!item.values?.length) {
          throw new Error("Gemini returned an empty document embedding.");
        }

        return item.values;
      }),
    );
  }

  return embeddings;
}

export async function embedQuery(question: string) {
  const env = assertGeminiConfigured();
  const client = getGeminiClient();
  const response = await client.models.embedContent({
    model: env.geminiEmbeddingModel,
    contents: [question],
    config: {
      taskType: "RETRIEVAL_QUERY",
    },
  });

  const embedding = response.embeddings?.[0]?.values;

  if (!embedding?.length) {
    throw new Error("Gemini did not return a valid query embedding.");
  }

  return embedding;
}
