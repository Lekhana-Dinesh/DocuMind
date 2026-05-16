import type { SourceSnippet } from "@/lib/types";

interface SourceCardProps {
  source: SourceSnippet;
}

function formatSourceType(sourceType: SourceSnippet["sourceType"]) {
  if (sourceType === "web_page") {
    return "Web page";
  }

  if (sourceType === "csv") {
    return "CSV";
  }

  if (sourceType === "pdf") {
    return "PDF";
  }

  return "Text";
}

export function SourceCard({ source }: SourceCardProps) {
  return (
    <article className="rounded-2xl border border-ink/10 bg-white/82 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-pine/70">
        <span>{source.fileName}</span>
        <span className="rounded-full bg-sand px-2 py-1 text-pine">
          {formatSourceType(source.sourceType)}
        </span>
        <span className="rounded-full bg-sand px-2 py-1 text-pine">
          Chunk {source.chunkIndex + 1}
        </span>
        {typeof source.pageNumber === "number" ? (
          <span className="rounded-full bg-surf/14 px-2 py-1 text-ink">
            Page {source.pageNumber}
          </span>
        ) : null}
        {typeof source.score === "number" ? (
          <span className="rounded-full bg-ink/6 px-2 py-1 text-ink/70">
            Score {source.score.toFixed(3)}
          </span>
        ) : null}
      </div>

      {source.sourceUrl ? (
        <a
          href={source.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-xs font-medium text-pine underline-offset-4 hover:underline"
        >
          {source.sourceUrl}
        </a>
      ) : null}

      <p className="mt-3 text-sm leading-6 text-ink/80">{source.text}</p>
    </article>
  );
}
