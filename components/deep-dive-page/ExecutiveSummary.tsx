import {
  Lightbulb,
  Star,
  Route,
  Bot,
  ExternalLink,
} from "lucide-react";
import type { ScoutSummaryV2, ScoutMode } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ExecutiveSummaryProps {
  summary: ScoutSummaryV2;
  mode: ScoutMode;
}

export function ExecutiveSummary({ summary, mode }: ExecutiveSummaryProps) {
  const modeLabel = mode === "LEARN" ? "Learning" : mode === "BUILD" ? "Building" : "Scouting";

  return (
    <div className="rounded-lg border border-border/50 bg-card px-4 py-5 sm:p-6 space-y-6 sm:space-y-8">
      <h2 className="font-serif text-xl sm:text-2xl text-foreground">Executive Summary</h2>

      {/* Key Takeaways */}
      {summary.takeaways.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="size-4 text-amber-500" aria-hidden="true" />
            <h3 className="font-serif text-lg text-foreground">Key Takeaways</h3>
          </div>
          <ol className="space-y-3 pl-1">
            {summary.takeaways.map((takeaway, idx) => (
              <li key={idx} className="flex gap-3 text-sm leading-relaxed">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-teal/10 text-xs font-semibold text-teal">
                  {idx + 1}
                </span>
                <span className="text-muted-foreground">{takeaway}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Top Recommendation */}
      {summary.recommendation && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Star className="size-4 text-teal" aria-hidden="true" />
            <h3 className="font-serif text-lg text-foreground">
              Top Recommendation
            </h3>
          </div>
          <div className="rounded-lg border border-teal/30 bg-teal/5 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-teal/80">
              Recommended for {modeLabel}
            </p>
            <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-foreground">
              <span className="font-mono">{summary.recommendation.repo}</span>
              <Star className="size-4 fill-teal text-teal" aria-hidden="true" />
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              &ldquo;{summary.recommendation.reason}&rdquo;
            </p>
            <a
              href={summary.recommendation.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-teal transition-colors hover:text-teal/80"
            >
              View on GitHub
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      )}

      {/* Skills Roadmap */}
      {summary.skills_roadmap.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Route className="size-4 text-teal" aria-hidden="true" />
            <h3 className="font-serif text-lg text-foreground">
              Skills Roadmap
            </h3>
          </div>

          <div className="relative pl-8">
            {/* Vertical connecting line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-teal/20" />

            <div className="space-y-5">
              {summary.skills_roadmap.map((item, idx) => (
                <div key={idx} className="relative">
                  {/* Step circle */}
                  <div
                    className={cn(
                      "absolute -left-8 mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full border-2",
                      idx === 0
                        ? "border-teal bg-teal text-white"
                        : "border-teal/30 bg-card text-teal/60"
                    )}
                  >
                    <span className="text-[10px] font-bold">{item.step}</span>
                  </div>

                  {/* Content */}
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {item.skill}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Ecosystem Notes */}
      {summary.ai_ecosystem_notes && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-teal" aria-hidden="true" />
            <h3 className="font-serif text-lg text-foreground">
              AI Ecosystem Notes
            </h3>
          </div>
          <div className="rounded-lg border border-teal/20 bg-teal/5 p-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {summary.ai_ecosystem_notes}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
