import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { assertGeminiConfigured } from "@/lib/env";
import { getGeminiClient } from "@/lib/rag/embeddings";
import type { RetrievedChunk } from "@/lib/types";

export const REFUSAL_MESSAGE =
  "I could not find enough information in the uploaded document to answer that.";

const answerSchema = z.object({
  answer: z.string().min(1),
  citationIds: z.array(z.string()).default([]),
});

const SYSTEM_INSTRUCTION =
  "You are DocuMind, a document-grounded assistant. Answer only using the provided context. Do not use outside knowledge. If the answer is not available in the context, say: 'I could not find enough information in the uploaded document to answer that.' Keep the answer concise and cite page/chunk references where available.";

function buildCitationLabel(source: RetrievedChunk) {
  const pagePart =
    typeof source.pageNumber === "number" ? `page ${source.pageNumber}` : "text file";
  return `${pagePart}, chunk ${source.chunkIndex + 1}`;
}

function buildContext(sources: RetrievedChunk[]) {
  return sources
    .map(
      (source, index) =>
        `[S${index + 1}] ${source.fileName} | ${buildCitationLabel(source)}\n${source.text}`,
    )
    .join("\n\n---\n\n");
}

function safeParseModelOutput(raw: string) {
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
    return answerSchema.safeParse(JSON.parse(cleaned));
  } catch {
    return answerSchema.safeParse(null);
  }
}

export async function generateGroundedAnswer(params: {
  question: string;
  sources: RetrievedChunk[];
}) {
  if (params.sources.length === 0) {
    return {
      answer: REFUSAL_MESSAGE,
      refused: true,
      citationIds: [] as string[],
    };
  }

  const env = assertGeminiConfigured();
  const client: GoogleGenAI = getGeminiClient();
  const sourceIds = params.sources.map((_, index) => `S${index + 1}`);
  const sourceIdSet = new Set(sourceIds);

  const response = await client.models.generateContent({
    model: env.geminiModel,
    contents: `Question:
${params.question}

Context:
${buildContext(params.sources)}

Return only JSON with:
- answer: string
- citationIds: string[] containing only the source IDs that support the answer.
If the context is insufficient, return the refusal sentence and an empty citationIds array.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.1,
      maxOutputTokens: 400,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          answer: { type: "string" },
          citationIds: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["answer", "citationIds"],
      },
    },
  });

  const raw = typeof response.text === "string" ? response.text : "";
  if (!raw) {
    return {
      answer: REFUSAL_MESSAGE,
      refused: true,
      citationIds: [] as string[],
    };
  }

  const parsed = safeParseModelOutput(raw);

  if (!parsed.success) {
    return {
      answer: REFUSAL_MESSAGE,
      refused: true,
      citationIds: [] as string[],
    };
  }

  const answer = parsed.data.answer.trim();
  const citationIds = parsed.data.citationIds.filter((id) => sourceIdSet.has(id));
  const refused =
    answer === REFUSAL_MESSAGE ||
    /not found in the uploaded document/i.test(answer) ||
    citationIds.length === 0;

  if (refused) {
    return {
      answer: REFUSAL_MESSAGE,
      refused: true,
      citationIds: [] as string[],
    };
  }

  const citationLabels = citationIds
    .map((id) => {
      const index = Number(id.replace("S", "")) - 1;
      const source = params.sources[index];
      return source ? `${id} (${buildCitationLabel(source)})` : id;
    })
    .join(", ");

  const withReferences =
    /(page|chunk|S\d)/i.test(answer) ? answer : `${answer} References: ${citationLabels}.`;

  return {
    answer: withReferences,
    refused: false,
    citationIds,
  };
}
