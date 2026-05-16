import type { RetrievedChunk } from "@/lib/types";

interface EvaluateRetrievalParams {
  question: string;
  chunks: RetrievedChunk[];
}

interface RetrievalEvaluation {
  isRelevant: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
}

const MIN_SOURCE_TEXT_LENGTH = 80;
const MIN_COMBINED_CONTEXT_LENGTH = 180;
const MIN_TOP_SCORE = 0.18;
const MEDIUM_TOP_SCORE = 0.28;
const HIGH_TOP_SCORE = 0.42;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "who",
  "why",
  "with",
]);

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function countKeywordOverlap(question: string, chunks: RetrievedChunk[]) {
  const keywords = new Set(tokenize(question));

  if (keywords.size === 0) {
    return 0;
  }

  const combinedText = chunks
    .slice(0, 3)
    .map((chunk) => chunk.text.toLowerCase())
    .join(" ");

  return [...keywords].filter((keyword) => combinedText.includes(keyword)).length;
}

export function evaluateRetrieval({
  question,
  chunks,
}: EvaluateRetrievalParams): RetrievalEvaluation {
  if (chunks.length === 0) {
    return {
      isRelevant: false,
      confidence: "low",
      reason: "No document chunks were retrieved for this question.",
    };
  }

  const usableChunks = chunks.filter(
    (chunk) => chunk.text.trim().length >= MIN_SOURCE_TEXT_LENGTH,
  );
  const combinedLength = usableChunks.reduce(
    (sum, chunk) => sum + chunk.text.length,
    0,
  );
  const topScore = usableChunks[0]?.score ?? chunks[0]?.score ?? 0;
  const overlapCount = countKeywordOverlap(question, usableChunks);

  if (usableChunks.length === 0) {
    return {
      isRelevant: false,
      confidence: "low",
      reason: "Retrieved chunks were too short to support a grounded answer.",
    };
  }

  if (combinedLength < MIN_COMBINED_CONTEXT_LENGTH) {
    return {
      isRelevant: false,
      confidence: "low",
      reason: `Retrieved context was too limited (${combinedLength} characters) to support a reliable answer.`,
    };
  }

  if (topScore < MIN_TOP_SCORE) {
    return {
      isRelevant: false,
      confidence: "low",
      reason: `Top retrieval score ${topScore.toFixed(3)} was below the minimum relevance threshold.`,
    };
  }

  if (topScore < MEDIUM_TOP_SCORE && overlapCount === 0) {
    return {
      isRelevant: false,
      confidence: "low",
      reason:
        "Retrieved chunks had weak semantic scores and no clear keyword overlap with the question.",
    };
  }

  if (topScore >= HIGH_TOP_SCORE) {
    return {
      isRelevant: true,
      confidence: "high",
      reason: `Top retrieval score ${topScore.toFixed(3)} indicates strong context support.`,
    };
  }

  if (topScore >= MEDIUM_TOP_SCORE || overlapCount >= 2) {
    return {
      isRelevant: true,
      confidence: "medium",
      reason:
        "Retrieved chunks are relevant enough to answer, but the context is less explicit than a strong direct hit.",
    };
  }

  return {
    isRelevant: true,
    confidence: "low",
    reason:
      "Retrieved chunks are usable, but the support is still fairly weak and should be answered conservatively.",
  };
}
