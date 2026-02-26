"use client";

import { Badge } from "@/components/ui/badge";
import { useScoutStore } from "@/stores/scout-store";
import type { ScoutMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const modeConfig: Record<
  ScoutMode,
  { label: string; className: string }
> = {
  LEARN: {
    label: "LEARN",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  BUILD: {
    label: "BUILD",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  SCOUT: {
    label: "SCOUT",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

export function SearchMetaBar() {
  const searchMeta = useScoutStore((s) => s.searchMeta);
  const mode = useScoutStore((s) => s.mode);
  const repos = useScoutStore((s) => s.repos);
  const phase1Complete = useScoutStore((s) => s.phase1Complete);

  const verifiedCount = repos.filter(
    (r) => r.verification.existence.status === "live"
  ).length;

  if (!searchMeta && !mode) return null;

  const currentMode = mode ?? searchMeta?.mode;
  const topic = searchMeta?.topic_extracted ?? searchMeta?.query ?? "";

  return (
    <div className="sticky top-16 z-40 border-b border-border/60 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          {currentMode && (
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 border px-2.5 py-0.5 text-xs font-semibold tracking-wider",
                modeConfig[currentMode].className
              )}
            >
              {modeConfig[currentMode].label}
            </Badge>
          )}

          {topic && (
            <h2 className="min-w-0 truncate font-serif text-lg text-foreground">
              {topic}
            </h2>
          )}
        </div>

        <div
          className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground sm:ml-auto"
          aria-live="polite"
          role="status"
        >
          <span>
            <span className="font-semibold text-foreground">
              {repos.length}
            </span>{" "}
            repos found
          </span>
          <span className="text-border" aria-hidden="true">|</span>
          <span>
            <span className="font-semibold text-foreground">
              {verifiedCount}
            </span>{" "}
            verified
          </span>
          {!phase1Complete && (
            <span className="inline-block h-2 w-2 animate-pulse-soft rounded-full bg-teal" aria-label="Searching in progress" />
          )}
        </div>
      </div>
    </div>
  );
}
