import "server-only";
import { z } from "zod";
import { assertGeminiConfigured } from "@/lib/env";
import { getGeminiClient } from "@/lib/rag/embeddings";
import type { RetrievedChunk } from "@/lib/types";

interface QueryRewriteParams {
  originalQuestion: string;
  retrievedChunks: RetrievedChunk[];
}

interface QueryRewriteResult {
  rewrittenQuery: string;
  reason: string;
}

const rewriteSchema = z.object({
  rewrittenQuery: z.string().min(1),
  reason: z.string().min(1),
});

const SYSTEM_INSTRUCTION =
  "You rewrite user questions into concise retrieval queries. Do not answer the question. Preserve the user's intent, keep important entities, and optimize for document retrieval.";

function buildSnippetContext(chunks: RetrievedChunk[]) {
  if (chunks.length === 0) {
    return "No retrieved snippets were available.";
  }

  return chunks
    .slice(0, 3)
    .map((chunk, index) => {
      const reference =
        typeof chunk.pageNumber === "number"
          ? `page ${chunk.pageNumber}, chunk ${chunk.chunkIndex + 1}`
          : `chunk ${chunk.chunkIndex + 1}`;
      const snippet = chunk.text.replace(/\s+/g, " ").slice(0, 220);
      return `Snippet ${index + 1} (${chunk.fileName}, ${reference}): ${snippet}`;
    })
    .join("\n");
}

function safeParseRewrite(raw: string) {
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
    return rewriteSchema.safeParse(JSON.parse(cleaned));
  } catch {
    return rewriteSchema.safeParse(null);
  }
}

function fallbackRewrite(originalQuestion: string, chunks: RetrievedChunk[]) {
  const normalizedQuestion = originalQuestion
    .replace(/^(can you|could you|would you|please)\s+/i, "")
    .replace(/[?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const snippetTerms = chunks
    .flatMap((chunk) => chunk.text.match(/\b[A-Z][A-Za-z0-9-]{2,}\b/g) ?? [])
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 3);

  if (snippetTerms.length === 0) {
    return {
      rewrittenQuery: normalizedQuestion || originalQuestion.trim(),
      reason: "Used a simplified version of the original question as the rewrite fallback.",
    };
  }

  const appendedTerms = snippetTerms.filter(
    (term) => !normalizedQuestion.toLowerCase().includes(term.toLowerCase()),
  );

  return {
    rewrittenQuery:
      appendedTerms.length > 0
        ? `${normalizedQuestion} ${appendedTerms.join(" ")}`
        : normalizedQuestion,
    reason:
      "Used a local rewrite fallback that emphasized key terms already present in the retrieved snippets.",
  };
}

export async function rewriteQueryForRetrieval({
  originalQuestion,
  retrievedChunks,
}: QueryRewriteParams): Promise<QueryRewriteResult> {
  const env = assertGeminiConfigured();
  const client = getGeminiClient();

  try {
    const response = await client.models.generateContent({
      model: env.geminiModel,
      contents: `Original question:
${originalQuestion}

Retrieved snippets:
${buildSnippetContext(retrievedChunks)}

Return only JSON with:
- rewrittenQuery: a concise query optimized for retrieving the right document chunks
- reason: one sentence explaining what changed

Do not answer the question.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
        maxOutputTokens: 180,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            rewrittenQuery: { type: "string" },
            reason: { type: "string" },
          },
          required: ["rewrittenQuery", "reason"],
        },
      },
    });

    const raw = typeof response.text === "string" ? response.text : "";
    const parsed = safeParseRewrite(raw);

    if (!parsed.success) {
      return fallbackRewrite(originalQuestion, retrievedChunks);
    }

    return {
      rewrittenQuery: parsed.data.rewrittenQuery.trim(),
      reason: parsed.data.reason.trim(),
    };
  } catch {
    return fallbackRewrite(originalQuestion, retrievedChunks);
  }
}
