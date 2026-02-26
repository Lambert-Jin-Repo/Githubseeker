"use client";

import { useRef } from "react";
import { useScoutStream } from "@/hooks/useScoutStream";
import { useDeepDiveStream } from "@/hooks/useDeepDiveStream";
import { useScoutStore } from "@/stores/scout-store";
import { Header } from "@/components/shared/Header";
import { SearchMetaBar } from "@/components/results/SearchMetaBar";
import { StreamingProgress } from "@/components/results/StreamingProgress";
import { QuickScanTable } from "@/components/results/QuickScanTable";
import { ObservationsPanel } from "@/components/results/ObservationsPanel";
import { CuratedListsSection } from "@/components/results/CuratedListsSection";
import { IndustryToolsSection } from "@/components/results/IndustryToolsSection";
import { DeepDiveCTA } from "@/components/results/DeepDiveCTA";
import { DeepDiveCard } from "@/components/deep-dive/DeepDiveCard";
import { SummaryPanel } from "@/components/deep-dive/SummaryPanel";
import { ExportButton } from "@/components/export/ExportButton";
import { AlertCircle } from "lucide-react";

interface ScoutResultsClientProps {
  searchId: string;
}

export function ScoutResultsClient({ searchId }: ScoutResultsClientProps) {
  const { error } = useScoutStream(searchId);
  const { startDeepDive, isStreaming: isDeepDiving, progress, error: deepDiveError } = useDeepDiveStream(searchId);
  const deepDiveRef = useRef<HTMLDivElement>(null);

  const repos = useScoutStore((s) => s.repos);
  const searchMeta = useScoutStore((s) => s.searchMeta);
  const phase1Complete = useScoutStore((s) => s.phase1Complete);
  const curatedLists = useScoutStore((s) => s.curatedLists);
  const industryTools = useScoutStore((s) => s.industryTools);
  const mode = useScoutStore((s) => s.mode);
  const selectedRepoUrls = useScoutStore((s) => s.selectedRepoUrls);
  const deepDiveResults = useScoutStore((s) => s.deepDiveResults);
  const summary = useScoutStore((s) => s.summary);
  const phase2Complete = useScoutStore((s) => s.phase2Complete);

  const handleDeepDive = () => {
    startDeepDive(selectedRepoUrls);
    setTimeout(() => {
      deepDiveRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  };

  const activeError = error || deepDiveError;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <SearchMetaBar />

      <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 space-y-8 sm:px-6">
        {/* Error banner */}
        {activeError && (
          <div role="alert" className="animate-slide-up flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {activeError}
          </div>
        )}

        {/* Streaming progress */}
        <StreamingProgress />

        {/* Export button — visible after Phase 1 completes */}
        {phase1Complete && repos.length > 0 && (
          <div className="flex justify-end">
            <ExportButton
              repos={repos}
              deepDiveResults={deepDiveResults.length > 0 ? deepDiveResults : undefined}
              query={searchMeta?.query || ""}
            />
          </div>
        )}

        {/* Main content grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
          {/* Left: Table */}
          <div className="min-w-0">
            <QuickScanTable />
          </div>

          {/* Right: Sidebar */}
          <aside className="space-y-6" aria-label="Search insights">
            <ObservationsPanel />
            {curatedLists.length > 0 && <CuratedListsSection />}
            {industryTools.length > 0 && <IndustryToolsSection />}
          </aside>
        </div>

        {/* Deep Dive Results */}
        {deepDiveResults.length > 0 && (
          <div ref={deepDiveRef} className="space-y-6 pt-4">
            <h2 className="font-serif text-3xl text-foreground">
              Deep Dive Analysis
            </h2>
            {isDeepDiving && progress.total > 0 && (
              <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
                Analyzing {progress.completed} of {progress.total} repositories...
              </p>
            )}
            {deepDiveResults.map((result, index) => (
              <DeepDiveCard
                key={result.repo_url}
                result={result}
                mode={mode || "SCOUT"}
                index={index}
              />
            ))}
          </div>
        )}

        {/* Summary Panel */}
        {summary && phase2Complete && (
          <SummaryPanel summary={summary} mode={mode || "SCOUT"} />
        )}
      </main>

      {/* Sticky bottom CTA */}
      <DeepDiveCTA onDeepDive={handleDeepDive} />
    </div>
  );
}
