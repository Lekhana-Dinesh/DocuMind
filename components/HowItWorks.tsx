const steps = [
  {
    title: "1. Upload",
    body: "The user uploads a PDF or plain text file through the Next.js interface.",
  },
  {
    title: "2. Extract",
    body: "Server-side code reads the file and extracts clean text, preserving page metadata for PDFs.",
  },
  {
    title: "3. Chunk",
    body: "A lightweight custom chunker splits the document into overlapping sections for better retrieval.",
  },
  {
    title: "4. Embed + Store",
    body: "Each chunk is embedded with Gemini and stored in Qdrant Cloud, or an in-memory store for local use.",
  },
  {
    title: "5. Retrieve",
    body: "At question time, DocuMind embeds the query and fetches the most relevant chunks by semantic similarity.",
  },
  {
    title: "6. Generate",
    body: "Only the retrieved context is sent to Gemini, which answers with source-backed grounding.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="fade-up glass-panel rounded-[32px] p-8 shadow-soft">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-pine/70">
          How it works
        </p>
        <h2 className="mt-2 text-3xl text-ink">
          Upload, retrieve, and answer with a transparent RAG pipeline
        </h2>
        <p className="mt-3 text-sm leading-7 text-ink/72">
          DocuMind keeps the flow transparent while still showing the full RAG
          chain end-to-end.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {steps.map((step, index) => (
          <article
            key={step.title}
            className="rounded-[24px] border border-ink/10 bg-white/78 p-5"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <h3 className="text-xl text-ink">{step.title}</h3>
            <p className="mt-3 text-sm leading-6 text-ink/76">{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
