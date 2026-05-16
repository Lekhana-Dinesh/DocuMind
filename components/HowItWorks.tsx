const steps = [
  {
    title: "1. Ingest",
    body: "Users add PDFs, text files, CSV files, or a web page URL through the Next.js interface.",
  },
  {
    title: "2. Extract",
    body: "Server-side code extracts readable text and preserves source metadata, including PDF page numbers and source labels.",
  },
  {
    title: "3. Chunk",
    body: "A lightweight custom chunker splits each source into overlapping sections for better semantic retrieval.",
  },
  {
    title: "4. Embed + Store",
    body: "Each chunk is embedded with Gemini and stored in Qdrant Cloud, or an in-memory store for local use.",
  },
  {
    title: "5. Retrieve",
    body: "At question time, DocuMind embeds the query and retrieves the most relevant chunks from the indexed workspace.",
  },
  {
    title: "6. Correct if needed",
    body: "If the first retrieval looks weak, Gemini rewrites the query for retrieval and DocuMind runs a second pass before answering.",
  },
  {
    title: "7. Generate",
    body: "Only the final retrieved context is sent to Gemini, which answers concisely and cites the supporting chunks.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="fade-up glass-panel rounded-[32px] p-8 shadow-soft"
    >
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-pine/70">
          How it works
        </p>
        <h2 className="mt-2 text-3xl text-ink">
          Corrective RAG with visible retrieval decisions
        </h2>
        <p className="mt-3 text-sm leading-7 text-ink/72">
          DocuMind keeps the pipeline transparent from ingestion through answer
          generation, and it retries retrieval only when the first pass looks weak.
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
