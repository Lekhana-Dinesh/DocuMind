# DocuMind

DocuMind is a Gemini-powered RAG application for asking grounded questions over indexed PDFs, text files, CSV files, and web pages.

It keeps the full retrieval pipeline visible end to end: ingest content, extract text, split it into overlapping chunks, create Gemini embeddings, store vectors in Qdrant, retrieve the most relevant chunks, and generate answers using only retrieved context.

## Live Project

https://documind-five-theta.vercel.app/

## GitHub Repository

https://github.com/Lekhana-Dinesh/DocuMind

## What’s New

- Corrective RAG flow with direct retrieval, query rewriting, and honest refusal when context is still weak
- Multi-source workspace support under one session
- CSV ingestion
- URL ingestion for pages you intentionally add to the workspace
- Source-type aware citations for PDF, text, CSV, and web page content

## Features

- Upload PDF, TXT, and CSV files
- Paste a URL to index a web page into the same workspace
- Extract readable text on the server
- Split content into overlapping chunks with a lightweight custom chunker
- Generate embeddings using Gemini
- Store and search vectors in Qdrant Cloud
- Fall back to in-memory local storage when `QDRANT_URL` is not configured
- Run a Corrective RAG loop before answering:
  - retrieve
  - evaluate retrieval quality
  - rewrite the query if needed
  - retrieve again
  - answer or refuse
- Answer only from indexed context
- Show source snippets, chunk numbers, page numbers, and source type
- Clear the current workspace and start again

## Tech Stack

| Area | Technology |
|---|---|
| Frontend | Next.js App Router, React, TypeScript |
| Styling | Tailwind CSS |
| Backend | Next.js route handlers |
| Generation | Gemini |
| Embeddings | Gemini embeddings |
| Vector Database | Qdrant Cloud |
| PDF Parsing | pdf-parse |
| Deployment | Vercel |

## Architecture

```text
File / URL source
        ↓
Server-side text extraction
        ↓
Custom overlapping chunker
        ↓
Gemini embeddings
        ↓
Qdrant vector storage
        ↓
Top-K retrieval
        ↓
Retrieval evaluation
        ↓
Query rewrite if needed
        ↓
Final retrieval
        ↓
Gemini answer generation from retrieved context only
        ↓
Answer + source snippets + retrieval mode
```

## Corrective RAG Flow

DocuMind uses a lightweight Corrective RAG loop instead of a single retrieval pass.

### 1. Direct retrieval

The app embeds the original user question and retrieves the top chunks from Qdrant.

### 2. Retrieval evaluation

Retrieved chunks are evaluated with deterministic checks:

- no chunks returned
- chunks too short
- combined context too small
- top similarity score below threshold
- weak lexical support when semantic scores are already low

### 3. Query rewrite when needed

If the first retrieval looks weak, Gemini rewrites the question into a retrieval-oriented query. The rewrite step never answers the question. It only tries to improve retrieval.

### 4. Second retrieval

The rewritten query is embedded and searched against the same indexed workspace.

### 5. Final behavior

- If the second retrieval is relevant enough, DocuMind answers with `Corrected retrieval`
- If the first retrieval was already strong, DocuMind answers with `Direct retrieval`
- If both retrieval passes are weak, DocuMind refuses with:

```text
I could not find enough information in the uploaded document to answer that.
```

## Ingestion Modes

### File ingestion

Supported file types:

- `.pdf`
- `.txt`
- `.csv`

### URL ingestion

Users can paste a URL to fetch and index a web page.

Important behavior:

- The page is fetched once during ingestion
- Readable text is extracted and indexed like any other source
- Chat answers can use that page only after it has been indexed
- DocuMind does not perform live web browsing during chat

## Chunking Strategy

DocuMind uses a lightweight custom chunker to keep the pipeline easy to read and explain.

Current configuration:

```text
Chunk size: 900 characters
Chunk overlap: 120 characters
```

Each chunk preserves:

```text
documentId
sessionId
sourceId
fileName
fileType
sourceType
sourceUrl
pageNumber
chunkIndex
text
```

## Vector Storage

Qdrant Cloud is the recommended storage mode.

The app stores:

- unnamed vectors
- cosine distance
- payload metadata for document filtering and source display

Retrieval is filtered by `documentId`, which maps to the active workspace session. That keeps answers restricted to the content the user indexed in the current workspace.

If `QDRANT_URL` is empty, the app uses an in-memory local store for development only.

## Grounding and Hallucination Prevention

DocuMind reduces hallucination with several guardrails:

- only retrieved chunks are sent to Gemini
- retrieval is filtered to the active indexed workspace
- retrieval quality is evaluated before answer generation
- a second retrieval pass happens only after a query rewrite
- if both passes are weak, the app refuses honestly
- source snippets are always shown for grounded answers
- answer generation is instructed not to use outside knowledge

## Project Structure

```text
documind-rag/
  app/
    api/
      chat/route.ts
      ingest-url/route.ts
      upload/route.ts
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
      correctiveRetrieve.ts
      embeddings.ts
      evaluateRetrieval.ts
      extractText.ts
      extractWebPage.ts
      generateAnswer.ts
      indexParsedDocument.ts
      queryRewrite.ts
      retrieve.ts
      vectorStore.ts
    env.ts
    types.ts
```

## Environment Variables

Create a `.env.local` file:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
DEBUG_RAG=
QDRANT_URL=
QDRANT_API_KEY=
QDRANT_COLLECTION=documind_rag
```

Notes:

- `DEBUG_RAG=true` enables verbose Qdrant diagnostics
- Leave `QDRANT_URL` blank to use in-memory local mode
- If `QDRANT_URL` is set, `QDRANT_API_KEY` must also be set

## Local Setup

```bash
git clone https://github.com/Lekhana-Dinesh/DocuMind.git
cd DocuMind
npm install
```

Create the environment file:

```bash
cp .env.example .env.local
```

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Start development:

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

Deploy on Vercel and configure:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
DEBUG_RAG=
QDRANT_URL=
QDRANT_API_KEY=
QDRANT_COLLECTION=documind_rag
```

## Testing Ideas

### Direct retrieval

Upload a document with a clearly stated fact and ask for that fact.

Expected behavior:

- retrieval mode shows `Direct retrieval`
- answer cites the retrieved chunk

### Corrected retrieval

Ask a vague question that still maps to the indexed content but is not phrased like the source.

Expected behavior:

- the app may refine the retrieval query
- retrieval mode shows `Corrected retrieval`
- source snippets still support the final answer

### Honest refusal

Ask something unrelated to the indexed workspace.

Expected behavior:

- retrieval mode shows `Insufficient context`
- the app refuses instead of inventing an answer

## Limitations

- Scanned PDFs are not supported unless they contain selectable text
- URL extraction uses a lightweight readable-text approach and may miss heavily scripted pages
- The current version does not include authentication or saved user workspaces
- Very large documents may still be constrained by hosting request limits

## Future Improvements

- OCR for scanned PDFs
- Better HTML readability extraction for complex web pages
- Workspace history and saved sessions
- Hybrid retrieval with keyword + vector search
- Streaming answer tokens
- User accounts and shared workspaces
