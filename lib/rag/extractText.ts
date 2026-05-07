import pdf from "pdf-parse";
import type { ParsedDocument, ParsedPage } from "@/lib/types";

interface ExtractTextParams {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

interface PdfTextItem {
  str: string;
  transform: number[];
}

function cleanExtractedText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfText({
  fileName,
  mimeType,
  buffer,
}: ExtractTextParams): Promise<ParsedDocument> {
  const pages: ParsedPage[] = [];

  const pagerender = async (pageData: {
    getTextContent: (options: {
      normalizeWhitespace: boolean;
      disableCombineTextItems: boolean;
    }) => Promise<{ items: PdfTextItem[] }>;
  }) => {
    const textContent = await pageData.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false,
    });

    let text = "";
    let lastY: number | undefined;

    for (const item of textContent.items) {
      if (lastY === undefined || item.transform[5] === lastY) {
        text += item.str;
      } else {
        text += `\n${item.str}`;
      }

      lastY = item.transform[5];
    }

    const normalized = cleanExtractedText(text);
    pages.push({
      pageNumber: pages.length + 1,
      text: normalized,
    });

    return normalized;
  };

  const result = await pdf(buffer, { pagerender });
  const text = cleanExtractedText(result.text);

  if (!text) {
    throw new Error("The PDF was uploaded successfully, but no readable text could be extracted.");
  }

  return {
    fileName,
    fileType: mimeType || "application/pdf",
    pages: pages.filter((page) => page.text.length > 0),
    text,
    pageCount: result.numpages || pages.length,
  };
}

function extractTextFile({
  fileName,
  mimeType,
  buffer,
}: ExtractTextParams): ParsedDocument {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const text = cleanExtractedText(decoder.decode(buffer));

  if (!text) {
    throw new Error("The text file is empty, so there is nothing to index.");
  }

  return {
    fileName,
    fileType: mimeType || "text/plain",
    pages: [{ text }],
    text,
    pageCount: 0,
  };
}

export async function extractTextFromFile(
  params: ExtractTextParams,
): Promise<ParsedDocument> {
  const lowerName = params.fileName.toLowerCase();

  if (lowerName.endsWith(".pdf")) {
    return extractPdfText(params);
  }

  if (lowerName.endsWith(".txt")) {
    return extractTextFile(params);
  }

  throw new Error("Unsupported file type. Upload a PDF or plain text file.");
}
