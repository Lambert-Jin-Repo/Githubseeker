"use client";

import { ArrowRight, Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScoutStore } from "@/stores/scout-store";
import { cn } from "@/lib/utils";

interface DeepDiveCTAProps {
  onDeepDive?: () => void;
}

export function DeepDiveCTA({ onDeepDive }: DeepDiveCTAProps) {
  const phase1Complete = useScoutStore((s) => s.phase1Complete);
  const selectedRepoUrls = useScoutStore((s) => s.selectedRepoUrls);
  const isDeepDiving = useScoutStore((s) => s.isDeepDiving);
  const deepDiveResultsV2 = useScoutStore((s) => s.deepDiveResultsV2);

  const selectedCount = selectedRepoUrls.length;
  const hasExistingResults = deepDiveResultsV2.length > 0;
  const isEnabled = (phase1Complete && selectedCount > 0) || hasExistingResults;

  // Only show after phase 1 is complete or repos are selected
  if (!phase1Complete && selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur-md" role="region" aria-label="Deep dive selection">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="text-sm text-muted-foreground" aria-live="polite">
          {hasExistingResults ? (
            <span>Deep dive report ready — click to view</span>
          ) : selectedCount > 0 ? (
            <>
              <span className="font-semibold text-foreground">
                {selectedCount}
              </span>
              /5 repositories selected for deep dive
            </>
          ) : (
            <span>Select up to 5 repositories for deep analysis</span>
          )}
        </div>

        <Button
          disabled={!isEnabled}
          onClick={onDeepDive}
          className={cn(
            "gap-2 px-6 font-medium transition-all min-h-[44px]",
            isEnabled
              ? "bg-teal text-white hover:bg-teal/90 shadow-md shadow-teal/20"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isDeepDiving ? (
            <>
              <Search className="size-4 animate-pulse-soft" aria-hidden="true" />
              Analyzing...
            </>
          ) : hasExistingResults ? (
            <>
              View Deep Dive Report
              <Eye className="size-4" aria-hidden="true" />
            </>
          ) : (
            <>
              Deep Dive Selected ({selectedCount}/5)
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
