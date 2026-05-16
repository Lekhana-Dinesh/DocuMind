export type VectorStoreMode = "qdrant" | "memory";

export type IndexingStage =
  | "extracting"
  | "chunking"
  | "embedding"
  | "storing"
  | "ready";

export type StepStatus = "pending" | "active" | "complete" | "error";
export type SourceType = "pdf" | "text" | "csv" | "web_page";
export type RetrievalMode = "direct" | "corrected" | "insufficient";

export interface ParsedPage {
  pageNumber?: number;
  text: string;
}

export interface ParsedDocument {
  fileName: string;
  fileType: string;
  sourceType: SourceType;
  sourceUrl?: string;
  pages: ParsedPage[];
  text: string;
  pageCount: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  sessionId: string;
  sourceId: string;
  fileName: string;
  fileType: string;
  sourceType: SourceType;
  sourceUrl?: string;
  text: string;
  pageNumber?: number;
  chunkIndex: number;
  charCount: number;
}

export interface RetrievedChunk extends DocumentChunk {
  score?: number;
}

export interface SourceSnippet {
  id: string;
  sourceId: string;
  fileName: string;
  fileType: string;
  sourceType: SourceType;
  sourceUrl?: string;
  text: string;
  pageNumber?: number;
  chunkIndex: number;
  score?: number;
}

export interface UploadedDocument {
  sessionId: string;
  sourceId: string;
  fileName: string;
  fileType: string;
  sourceType: SourceType;
  sourceUrl?: string;
  pageCount: number;
  chunkCount: number;
  storageMode: VectorStoreMode;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  refused?: boolean;
  sources?: SourceSnippet[];
  retrievalMode?: RetrievalMode;
  finalQuery?: string;
  rewrittenQuery?: string;
  evaluationReason?: string;
}

export interface ChatApiResponse {
  answer: string;
  refused: boolean;
  sources: SourceSnippet[];
  citationIds: string[];
  retrievalMode: RetrievalMode;
  originalQuery: string;
  finalQuery: string;
  rewrittenQuery?: string;
  evaluationReason: string;
}

export interface UploadStatusEvent {
  type: "status";
  stage: IndexingStage;
  message: string;
}

export interface UploadCompleteEvent {
  type: "complete";
  data: UploadedDocument;
}

export interface UploadErrorEvent {
  type: "error";
  stage: IndexingStage;
  error: string;
}

export type UploadStreamEvent =
  | UploadStatusEvent
  | UploadCompleteEvent
  | UploadErrorEvent;

export interface IndexingStep {
  key: IndexingStage;
  label: string;
  description: string;
  status: StepStatus;
}
