# DocuMind

DocuMind is a web-based document question-answering application that lets users upload a PDF or text file and ask questions grounded in the uploaded document.

It implements a complete Retrieval-Augmented Generation (RAG) pipeline: document upload, text extraction, chunking, embedding, vector storage, semantic retrieval, and grounded answer generation.

## Live Project

https://documind-five-theta.vercel.app/

## GitHub Repository

https://github.com/Lekhana-Dinesh/DocuMind

## Features

- Upload PDF and plain text documents.
- Extract document text on the server.
- Split extracted text into overlapping chunks.
- Generate semantic embeddings using Gemini.
- Store and retrieve embeddings using Qdrant Cloud.
- Ask natural language questions about the uploaded document.
- Generate answers using only retrieved document context.
- Refuse unsupported questions when the answer is not present in the document.
- Display source snippets with chunk/page metadata for verification.
- Clear the current document and upload another file.

## Tech Stack

| Area | Technology |
|---|---|
| Frontend | Next.js App Router, React, TypeScript |
| Styling | Tailwind CSS |
| Backend | Next.js API Routes |
| LLM | Gemini |
| Embeddings | Gemini Embeddings |
| Vector Database | Qdrant Cloud |
| PDF Parsing | pdf-parse |
| Deployment | Vercel |

## How It Works

```text
User uploads PDF/TXT
        ↓
Server extracts text
        ↓
Text is split into chunks
        ↓
Gemini creates embeddings
        ↓
Qdrant stores vectors + metadata
        ↓
User asks a question
        ↓
Question is embedded
        ↓
Relevant chunks are retrieved
        ↓
Gemini answers using retrieved context only
        ↓
Answer + source snippets are shown
```

## RAG Pipeline

### 1. Document Upload

The user uploads a `.pdf` or `.txt` file through the web interface. Upload processing happens on the server so API keys and database credentials are not exposed to the client.

### 2. Text Extraction

The app extracts readable text from the uploaded document. Text files are read directly, while PDFs are processed using `pdf-parse`.

### 3. Chunking Strategy

DocuMind uses a lightweight custom chunking utility.

Current configuration:

```text
Chunk size: 900 characters
Chunk overlap: 120 characters
```

Each chunk stores metadata:

```text
documentId
fileName
pageNumber
chunkIndex
text
```

The overlap helps preserve context across chunk boundaries and improves retrieval quality.

### 4. Embedding

Each document chunk is converted into a vector using Gemini embeddings.

Default embedding model:

```env
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
```

The same embedding model is used to embed user questions during retrieval.

### 5. Vector Storage

Embeddings are stored in Qdrant Cloud with payload metadata. The app filters retrieval by `documentId`, so each chat session only searches inside the currently uploaded document.

### 6. Retrieval

For every user question, DocuMind embeds the question and retrieves the most relevant chunks from Qdrant using semantic search.

### 7. Grounded Answer Generation

Only the retrieved chunks are passed to Gemini. The model is instructed to answer only from the provided context.

If the answer is not found in the uploaded document, DocuMind responds:

```text
I could not find enough information in the uploaded document to answer that.
```

## Grounding and Source Verification

DocuMind is designed to reduce hallucination by:

- Passing only retrieved chunks to the LLM.
- Filtering retrieval by the active document session.
- Refusing when context is missing or insufficient.
- Showing source snippets used for the answer.
- Including chunk/page metadata where available.

This makes each answer easier to verify against the original document.

## Project Structure

```text
DocuMind/
  app/
    api/
      upload/route.ts
      chat/route.ts
    page.tsx

  components/
    ChatPanel.tsx
    FileUpload.tsx
    HomePageClient.tsx
    HowItWorks.tsx
    SourceCard.tsx
    StatusSteps.tsx

  lib/
    rag/
      chunkDocument.ts
      embeddings.ts
      extractText.ts
      generateAnswer.ts
      retrieve.ts
      vectorStore.ts
    env.ts
    types.ts
```

## Environment Variables

Create a `.env.local` file for local development.

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

QDRANT_URL=
QDRANT_API_KEY=
QDRANT_COLLECTION=documind_rag_v3

DEBUG_RAG=
```

`DEBUG_RAG=true` enables detailed Qdrant diagnostics during local debugging. It should usually be left blank in production.

## Local Setup

Clone the repository:

```bash
git clone https://github.com/Lekhana-Dinesh/DocuMind.git
cd DocuMind
```

Install dependencies:

```bash
npm install
```

Create the environment file:

```bash
cp .env.example .env.local
```

For Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Build

```bash
npm run build
```

## Deployment

The project is deployed on Vercel.

Before deployment, add the required environment variables in the Vercel project settings:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
QDRANT_URL=
QDRANT_API_KEY=
QDRANT_COLLECTION=documind_rag_v3
DEBUG_RAG=
```

After adding environment variables, redeploy the project.

## Testing

Use a sample text file:

```text
DocuMind is a document question answering app.
It uses Gemini embeddings, Qdrant vector storage, and Gemini answer generation.
The app answers only from uploaded document content.
```

Ask:

```text
What vector storage does DocuMind use?
```

Expected behavior:

- The app answers from the document.
- The answer mentions Qdrant.
- A source snippet is shown.

Ask an unrelated question:

```text
Who is the CEO of Google?
```

Expected behavior:

- The app refuses because the answer is not present in the uploaded document.



## Limitations

- Scanned PDFs are not supported unless they contain selectable text.
- Very large documents may be limited by hosting request size limits.
- The current version focuses on one active document session at a time.
- Multi-document workspaces and user accounts are not included yet.

## Future Improvements

- OCR support for scanned PDFs
- Multi-document workspaces
- Persistent document history
- User authentication
- Streaming responses
- Hybrid keyword + vector search
- Exportable chat history
