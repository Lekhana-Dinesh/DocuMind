import type { ParsedDocument } from "@/lib/types";

interface ExtractWebPageParams {
  url: string;
  body: string;
  contentType?: string | null;
}

const ENTITY_MAP: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeHtmlEntities(text: string) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();

    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return ENTITY_MAP[normalized] ?? match;
  });
}

function cleanExtractedText(text: string) {
  return decodeHtmlEntities(
    text
      .replace(/\u0000/g, "")
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function stripHtml(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n");
}

function extractTitle(html: string, url: URL) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1] ? cleanExtractedText(titleMatch[1]) : "";

  if (title) {
    return title;
  }

  const path = url.pathname.replace(/\/+$/, "");
  return path ? `${url.hostname}${path}` : url.hostname;
}

export function extractTextFromWebPage({
  url,
  body,
  contentType,
}: ExtractWebPageParams): ParsedDocument {
  const parsedUrl = new URL(url);
  const normalizedContentType = contentType?.toLowerCase() ?? "";
  const isHtml =
    normalizedContentType.includes("text/html") ||
    /^<!doctype html/i.test(body) ||
    /<html[\s>]/i.test(body);

  const extractedText = isHtml ? stripHtml(body) : body;
  const text = cleanExtractedText(extractedText);

  if (!text) {
    throw new Error(
      "The web page was fetched successfully, but no readable text could be extracted.",
    );
  }

  return {
    fileName: extractTitle(body, parsedUrl),
    fileType: normalizedContentType || "text/html",
    sourceType: "web_page",
    sourceUrl: parsedUrl.toString(),
    pages: [{ text }],
    text,
    pageCount: 0,
  };
}
