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
    throw new Error(
      "The PDF was uploaded successfully, but no readable text could be extracted.",
    );
  }

  return {
    fileName,
    fileType: mimeType || "application/pdf",
    sourceType: "pdf",
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
    sourceType: "text",
    pages: [{ text }],
    text,
    pageCount: 0,
  };
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function extractCsvText({
  fileName,
  mimeType,
  buffer,
}: ExtractTextParams): ParsedDocument {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const raw = decoder.decode(buffer).replace(/\u0000/g, "").trim();

  if (!raw) {
    throw new Error("The CSV file is empty, so there is nothing to index.");
  }

  const lines = raw
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("The CSV file did not contain any readable rows.");
  }

  const header = parseCsvLine(lines[0]);
  const hasHeader = header.some((value) => /[a-z]/i.test(value));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const formattedRows = dataLines.map((line, index) => {
    const values = parseCsvLine(line);
    const rowValues = values
      .map((value, columnIndex) => {
        const columnLabel =
          hasHeader && header[columnIndex]
            ? `${header[columnIndex]}: `
            : "";
        return `${columnLabel}${value}`.trim();
      })
      .filter(Boolean)
      .join(" | ");

    return `Row ${hasHeader ? index + 2 : index + 1}: ${rowValues}`;
  });

  const text = cleanExtractedText(formattedRows.join("\n"));

  if (!text) {
    throw new Error("The CSV file did not produce any readable text to index.");
  }

  return {
    fileName,
    fileType: mimeType || "text/csv",
    sourceType: "csv",
    pages: [{ text }],
    text,
    pageCount: 0,
  };
}

export async function extractTextFromFile(
  params: ExtractTextParams,
): Promise<ParsedDocument> {
  const lowerName = params.fileName.toLowerCase();
  const lowerMimeType = params.mimeType.toLowerCase();

  if (lowerName.endsWith(".pdf") || lowerMimeType === "application/pdf") {
    return extractPdfText(params);
  }

  if (lowerName.endsWith(".txt") || lowerMimeType === "text/plain") {
    return extractTextFile(params);
  }

  if (
    lowerName.endsWith(".csv") ||
    lowerMimeType === "text/csv" ||
    lowerMimeType === "application/csv" ||
    lowerMimeType === "application/vnd.ms-excel"
  ) {
    return extractCsvText(params);
  }

  throw new Error("Unsupported file type. Upload a PDF, plain text file, or CSV.");
}
