export type VectorStoreMode = "qdrant" | "memory";

export type IndexingStage =
  | "extracting"
  | "chunking"
  | "embedding"
  | "storing"
  | "ready";

export type StepStatus = "pending" | "active" | "complete" | "error";

export interface ParsedPage {
  pageNumber?: number;
  text: string;
}

export interface ParsedDocument {
  fileName: string;
  fileType: string;
  pages: ParsedPage[];
  text: string;
  pageCount: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  sessionId: string;
  fileName: string;
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
  fileName: string;
  text: string;
  pageNumber?: number;
  chunkIndex: number;
  score?: number;
}

export interface UploadedDocument {
  sessionId: string;
  fileName: string;
  fileType: string;
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
}

export interface ChatApiResponse {
  answer: string;
  refused: boolean;
  sources: SourceSnippet[];
  citationIds: string[];
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
