# DocuMind

Chat with PDFs and text files using retrieval-augmented generation.

## Problem statement

Students and knowledge workers often need quick answers from long PDFs or notes, but manually scanning documents is slow and keyword search misses meaning. DocuMind solves that by indexing an uploaded document, retrieving the most relevant chunks semantically, and generating answers grounded only in those chunks.

## Features

- Upload `.pdf` and `.txt` files through a polished Next.js interface.
- Stream indexing progress across extraction, chunking, embedding, and storage.
- Preserve source file name, page number, chunk index, and session ID metadata.
- Use Gemini embeddings for semantic vector search.
- Use Qdrant Cloud when configured, with an in-memory fallback for local demos.
- Retrieve top relevant chunks before every answer.
- Refuse honestly when the answer is not supported by the uploaded document.
- Show source snippets with page/chunk references so grounding is easy to verify.
- Clear the current document session and upload another file.

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Gemini API via `@google/genai`
- Qdrant Cloud
- `pdf-parse` for PDF text extraction
- Lightweight custom chunking and retrieval logic

## Architecture diagram

```text
Browser UI
  -> /api/upload
     -> extract text
     -> recursive chunking
     -> Gemini embeddings
     -> Qdrant or in-memory store

Browser UI
  -> /api/chat
     -> Gemini query embedding
     -> semantic retrieval from Qdrant or memory
     -> Gemini grounded answer generation
     -> answer + source snippets
```

## RAG pipeline

`Upload -> Extract -> Chunk -> Gemini Embed -> Store -> Retrieve -> Gemini Generate`

1. The user uploads a PDF or text file.
2. The server extracts plain text and keeps page metadata for PDFs where available.
3. A lightweight custom chunker splits the text into overlapping chunks.
4. Gemini embeddings convert chunks into vectors.
5. Vectors are stored in Qdrant Cloud, or a local in-memory fallback for demos.
6. On each question, DocuMind embeds the query and retrieves the most relevant chunks.
7. Gemini generates an answer using only the retrieved context.

## Chunking strategy

- Implementation: custom chunking utility in `lib/rag/chunkDocument.ts`
- Chunk size: `900`
- Chunk overlap: `120`
- Metadata stored with each chunk:
  - source file name
  - page number when available
  - chunk index
  - session ID

This keeps chunks large enough for meaning, but small enough for focused retrieval.

The app intentionally uses a lightweight custom RAG pipeline rather than a heavier orchestration layer. That keeps the code easier to understand, debug, and explain in an interview or assignment demo.

## Vector database strategy

### Recommended production mode

Configure:

- `QDRANT_URL`
- `QDRANT_API_KEY`
- `QDRANT_COLLECTION`

In this mode, DocuMind stores chunk vectors in Qdrant Cloud and filters by `sessionId` so unrelated uploads do not mix.

### Demo/dev fallback mode

If `QDRANT_URL` is missing, DocuMind falls back to an in-memory store.

Important:

- This mode is useful for local demos only.
- It is not persistent.
- It is not production-grade.
- It can reset whenever the server restarts.

## Grounding and hallucination prevention

- Gemini receives only retrieved chunks, not the whole document by default.
- The system instruction explicitly forbids outside knowledge.
- If no chunks are retrieved, DocuMind refuses.
- If retrieved chunks are too weak or too short, DocuMind refuses.
- If Gemini returns an unsupported or uncited answer, DocuMind refuses.
- Source snippets are always shown in the UI for manual verification.

Refusal message:

`I could not find enough information in the uploaded document to answer that.`

## Gemini-only setup

This project uses Gemini only.

- Gemini is used for answer generation.
- Gemini embeddings are used for vector search.
- Qdrant is used as the vector database.
- No other model provider SDK or embedding pipeline is used in the app.

## Screenshots

- Add landing page screenshot here
- Add upload/indexing screenshot here
- Add chat + sources screenshot here

## Local setup

### 1. Clone and enter the project

```bash
git clone <YOUR_GITHUB_REPO_URL>
cd documind-rag
```

### 2. Create your environment file

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

### 3. Fill in the environment variables

At minimum:

- `GEMINI_API_KEY`

Recommended for production-style testing:

- `QDRANT_URL`
- `QDRANT_API_KEY`
- `QDRANT_COLLECTION`

### 4. Install and run

```bash
npm install
npm run dev
```

### 5. Build check

```bash
npm run build
```

## Environment variables

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
QDRANT_URL=
QDRANT_API_KEY=
QDRANT_COLLECTION=documind_rag
```

## Vercel deployment steps

1. Push the repository to GitHub.
2. Import the repo into Vercel.
3. Add the environment variables from `.env.example` in the Vercel dashboard.
4. Set `QDRANT_URL`, `QDRANT_API_KEY`, and `QDRANT_COLLECTION` for production mode.
5. Deploy.
6. Upload a document in the live app and verify source-grounded answers.

## Qdrant Cloud setup steps

1. Create a free cluster in Qdrant Cloud.
2. Copy the cluster URL into `QDRANT_URL`.
3. Create an API key and copy it into `QDRANT_API_KEY`.
4. Set `QDRANT_COLLECTION=documind_rag`.
5. Redeploy or restart the app after updating environment variables.

## Troubleshooting

- If Qdrant returns a vector size mismatch, delete the old collection or change `QDRANT_COLLECTION` to a fresh name.
- If `QDRANT_URL` is empty, DocuMind automatically falls back to the in-memory demo store.
- If `GEMINI_API_KEY` is missing, upload and chat requests will fail with a clear configuration error.

## How to test/demo

1. Start the app with `npm run dev`.
2. Upload a PDF or `.txt` file with enough content to ask multiple questions.
3. Watch the indexing status move through extraction, chunking, embedding, and storage.
4. Ask a question that is clearly answered in the document.
5. Ask a second question that is not covered by the document.
6. Verify that DocuMind refuses honestly and still shows grounding behavior.

## Assignment rubric mapping

### GitHub repository: 2 marks

- Clean folder structure
- Clear README
- Portfolio-ready commit history once pushed

### Live project: 2 marks

- Next.js app deployable on Vercel
- Qdrant Cloud supported for deployed usage

### RAG pipeline: 3 marks

- Upload
- Extract
- Chunk
- Gemini embed
- Store
- Retrieve
- Gemini generate

### Answer quality and grounding: 2 marks

- Retrieval-only context
- Honest refusal when context is weak
- Source snippets with metadata

### Code quality and documentation: 1 mark

- TypeScript types
- Modular `lib/rag` structure
- README explains design decisions

## Limitations

- Text extraction quality depends on the PDF structure.
- The in-memory vector store is only for local/demo use.
- Large uploads may be limited by your hosting platform's request size.
- Single-document session flow is optimized for clarity, not multi-user scale.

## Future improvements

- Multi-document workspaces
- Persisted document history
- Hybrid retrieval with metadata filtering
- Streaming chat responses
- OCR support for scanned PDFs
- Auth and per-user document libraries

## Live link

`Add your Vercel URL here`

## GitHub link

`Add your GitHub repo URL here`
