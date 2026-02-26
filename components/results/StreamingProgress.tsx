"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useScoutStore } from "@/stores/scout-store";
import { cn } from "@/lib/utils";

const strategyNames: Record<string, string> = {
  high_star: "Popular Repos",
  awesome_list: "Curated Lists",
  topic_page: "Topic Pages",
  editorial: "Expert Roundups",
  architecture: "Architecture",
  competitive: "Alternatives",
  ai_patterns: "AI Skills",
};

function getDisplayName(strategy: string): string {
  return strategyNames[strategy] ?? strategy;
}

export function StreamingProgress() {
  const searchProgress = useScoutStore((s) => s.searchProgress);
  const phase1Complete = useScoutStore((s) => s.phase1Complete);

  if (searchProgress.length === 0) return null;

  const completedCount = searchProgress.filter(
    (p) => p.status === "complete"
  ).length;
  const totalCount = searchProgress.length;

  if (phase1Complete) {
    return (
      <div className="animate-slide-up mx-auto max-w-6xl px-4 py-3 sm:px-6" role="status" aria-live="polite">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="size-4 text-success" aria-hidden="true" />
          <span>
            Scan complete &mdash;{" "}
            <span className="font-medium text-foreground">
              {completedCount} strategies
            </span>{" "}
            searched
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        {searchProgress.map((progress, idx) => {
          const isRunning = progress.status === "running";
          const isComplete = progress.status === "complete";
          const isFailed = progress.status === "failed";

          return (
            <Badge
              key={progress.strategy}
              variant="outline"
              className={cn(
                "animate-slide-in gap-1.5 border px-3 py-1 text-xs font-medium transition-colors",
                isComplete && "border-success/30 bg-success/5 text-success",
                isFailed && "border-destructive/30 bg-destructive/5 text-destructive",
                isRunning &&
                  "border-teal/30 bg-teal/5 text-teal animate-pulse-soft",
                !isComplete &&
                  !isRunning &&
                  !isFailed &&
                  "border-border bg-secondary text-muted-foreground",
                idx === 0 && "delay-1",
                idx === 1 && "delay-2",
                idx === 2 && "delay-3",
                idx === 3 && "delay-4",
                idx === 4 && "delay-5",
                idx === 5 && "delay-6",
                idx === 6 && "delay-7"
              )}
            >
              {isRunning && <Loader2 className="size-3 animate-spin" />}
              {isComplete && <Check className="size-3" />}
              {isFailed && <AlertCircle className="size-3" />}
              {getDisplayName(progress.strategy)}
              {isComplete && progress.repos_found > 0 && (
                <span className="ml-0.5 text-[10px] opacity-70">
                  +{progress.repos_found}
                </span>
              )}
            </Badge>
          );
        })}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {completedCount}/{totalCount} strategies complete
      </div>
    </div>
  );
}
