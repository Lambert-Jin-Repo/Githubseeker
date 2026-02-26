"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useScoutStore } from "@/stores/scout-store";
import { useDeepDiveStreamV2 } from "@/hooks/useDeepDiveStreamV2";
import { DeepDiveHeader } from "@/components/deep-dive-page/DeepDiveHeader";
import { DeepDiveSidebar } from "@/components/deep-dive-page/DeepDiveSidebar";
import { SectionSkeleton } from "@/components/deep-dive-page/SectionSkeleton";
import { ExecutiveSummary } from "@/components/deep-dive-page/ExecutiveSummary";
import { ComparativeMatrix } from "@/components/deep-dive-page/ComparativeMatrix";
import { RepoAnalysisCard } from "@/components/deep-dive-page/RepoAnalysisCard";
import { EcosystemGaps } from "@/components/deep-dive-page/EcosystemGaps";
import { AlertCircle, Loader2 } from "lucide-react";

interface DeepDivePageClientProps {
  searchId: string;
}

/**
 * Converts a repo URL like "https://github.com/owner/repo" to a section ID
 * like "repo-owner-repo".
 */
function repoUrlToSectionId(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return `repo-${parts[0]}-${parts[1]}`;
    }
  } catch {
    // Fallback: strip protocol and special chars
  }
  return `repo-${url.replace(/[^a-zA-Z0-9-]/g, "-")}`;
}

/**
 * Extracts a short display name from a repo URL.
 * "https://github.com/owner/repo" -> "owner/repo"
 */
function repoUrlToDisplayName(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
  } catch {
    // Fallback
  }
  return url;
}

export function DeepDivePageClient({ searchId }: DeepDivePageClientProps) {
  const router = useRouter();
  const hasStartedRef = useRef(false);

  const selectedRepoUrls = useScoutStore((s) => s.selectedRepoUrls);
  const searchMeta = useScoutStore((s) => s.searchMeta);
  const deepDiveResultsV2 = useScoutStore((s) => s.deepDiveResultsV2);
  const summaryV2 = useScoutStore((s) => s.summaryV2);
  const mode = useScoutStore((s) => s.mode);

  const { startDeepDive, isStreaming, progress, error, isComplete, phase } =
    useDeepDiveStreamV2(searchId);

  // Redirect back if no repos selected and no existing V2 results
  useEffect(() => {
    if (
      selectedRepoUrls.length === 0 &&
      deepDiveResultsV2.length === 0 &&
      !isStreaming
    ) {
      router.push(`/scout/${searchId}`);
    }
  }, [selectedRepoUrls, deepDiveResultsV2, isStreaming, searchId, router]);

  // Auto-start deep dive if we have selected URLs but no results yet
  useEffect(() => {
    if (
      selectedRepoUrls.length > 0 &&
      deepDiveResultsV2.length === 0 &&
      !isStreaming &&
      !isComplete &&
      !hasStartedRef.current
    ) {
      hasStartedRef.current = true;
      startDeepDive(selectedRepoUrls);
    }
  }, [
    selectedRepoUrls,
    deepDiveResultsV2,
    isStreaming,
    isComplete,
    startDeepDive,
  ]);

  // Build the list of repo URLs to show sections for (selected or already analyzed)
  const repoUrls = useMemo(() => {
    if (selectedRepoUrls.length > 0) return selectedRepoUrls;
    return deepDiveResultsV2.map((r) => r.repo_url);
  }, [selectedRepoUrls, deepDiveResultsV2]);

  // Build sidebar items
  const sidebarItems = useMemo(() => {
    const items: { id: string; label: string; type: "section" | "repo" }[] = [
      { id: "overview", label: "Overview", type: "section" },
      { id: "compare", label: "Compare", type: "section" },
    ];

    for (const url of repoUrls) {
      items.push({
        id: repoUrlToSectionId(url),
        label: repoUrlToDisplayName(url),
        type: "repo",
      });
    }

    items.push({ id: "gaps", label: "Gaps & Opportunities", type: "section" });

    return items;
  }, [repoUrls]);

  // Check which repos have completed analysis
  const completedUrls = new Set(deepDiveResultsV2.map((r) => r.repo_url));

  // Phase label for progress indicator
  const phaseLabel = {
    idle: "",
    checking_db: "Checking for cached results...",
    fetching_data: "Fetching repository data...",
    analyzing: "Analyzing repositories...",
    summarizing: "Generating summary...",
    complete: "",
  }[phase];

  return (
    <div className="min-h-screen bg-background">
      <DeepDiveHeader
        searchId={searchId}
        query={searchMeta?.query}
        repoCount={repoUrls.length}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[200px_1fr] lg:gap-8">
        <DeepDiveSidebar items={sidebarItems} />

        <main className="space-y-8">
          {/* Error banner */}
          {error && (
            <div
              role="alert"
              className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {/* Progress indicator */}
          {isStreaming && phaseLabel && (
            <div
              className="flex items-center gap-3 rounded-lg border border-teal/20 bg-teal/5 px-4 py-3 text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <Loader2
                className="size-4 animate-spin text-teal"
                aria-hidden="true"
              />
              <span>
                {phaseLabel}
                {progress.total > 0 && (
                  <span className="ml-1.5 text-teal font-medium">
                    ({progress.completed}/{progress.total})
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Section: Overview */}
          <section id="overview" className="scroll-mt-24">
            {isComplete && summaryV2 ? (
              <ExecutiveSummary summary={summaryV2} mode={mode || "SCOUT"} />
            ) : (
              <SectionSkeleton title="Overview" />
            )}
          </section>

          {/* Section: Compare */}
          <section id="compare" className="scroll-mt-24">
            {isComplete && summaryV2 ? (
              <ComparativeMatrix summary={summaryV2} />
            ) : (
              <SectionSkeleton title="Comparative Analysis" />
            )}
          </section>

          {/* Section: Individual Repos */}
          {repoUrls.map((url, i) => {
            const sectionId = repoUrlToSectionId(url);
            const displayName = repoUrlToDisplayName(url);
            const result = deepDiveResultsV2.find((r) => r.repo_url === url);

            return (
              <section key={url} id={sectionId} className="scroll-mt-24">
                {result ? (
                  <RepoAnalysisCard
                    result={result}
                    mode={mode || "SCOUT"}
                    index={i}
                  />
                ) : (
                  <SectionSkeleton title={displayName} />
                )}
              </section>
            );
          })}

          {/* Section: Gaps & Opportunities */}
          <section id="gaps" className="scroll-mt-24">
            {isComplete && summaryV2 ? (
              <EcosystemGaps gaps={summaryV2.ecosystem_gaps} />
            ) : (
              <SectionSkeleton title="Gaps & Opportunities" />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
