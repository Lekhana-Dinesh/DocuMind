import type { IndexingStep } from "@/lib/types";

interface StatusStepsProps {
  steps: IndexingStep[];
  summary?: string | null;
  isBusy: boolean;
}

function getStepStyles(status: IndexingStep["status"]) {
  if (status === "complete") {
    return "border-pine/20 bg-pine/10 text-pine";
  }

  if (status === "active") {
    return "border-surf/30 bg-surf/16 text-ink";
  }

  if (status === "error") {
    return "border-coral/30 bg-coral/10 text-coral";
  }

  return "border-ink/10 bg-white/68 text-ink/55";
}

function getIndicator(status: IndexingStep["status"]) {
  if (status === "complete") {
    return "OK";
  }

  if (status === "active") {
    return "...";
  }

  if (status === "error") {
    return "!";
  }

  return "-";
}

export function StatusSteps({ steps, summary, isBusy }: StatusStepsProps) {
  return (
    <div className="glass-panel rounded-[28px] p-6 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-pine/70">
            Indexing status
          </p>
          <h2 className="mt-2 text-2xl text-ink">Document pipeline</h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
            isBusy ? "bg-sand text-pine" : "bg-pine/12 text-pine"
          }`}
        >
          {isBusy ? "Processing" : "Ready"}
        </span>
      </div>

      <div className="mt-6 space-y-3">
        {steps.map((step) => (
          <div
            key={step.key}
            className={`flex items-start gap-4 rounded-2xl border px-4 py-4 transition ${getStepStyles(step.status)}`}
          >
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/20 text-xs font-bold">
              {getIndicator(step.status)}
            </div>
            <div>
              <p className="text-sm font-semibold">{step.label}</p>
              <p className="mt-1 text-sm leading-6 text-current/80">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 min-h-6 text-sm text-ink/70">
        {summary ?? "Ready to index a document."}
      </p>
    </div>
  );
}
