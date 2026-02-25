"use client";

import { useScoutStream } from "@/hooks/useScoutStream";
import { useScoutStore } from "@/stores/scout-store";
import { Header } from "@/components/shared/Header";
import { SearchMetaBar } from "@/components/results/SearchMetaBar";
import { StreamingProgress } from "@/components/results/StreamingProgress";
import { QuickScanTable } from "@/components/results/QuickScanTable";
import { ObservationsPanel } from "@/components/results/ObservationsPanel";
import { CuratedListsSection } from "@/components/results/CuratedListsSection";
import { IndustryToolsSection } from "@/components/results/IndustryToolsSection";
import { DeepDiveCTA } from "@/components/results/DeepDiveCTA";
import { AlertCircle } from "lucide-react";

interface ScoutResultsClientProps {
  searchId: string;
}

export function ScoutResultsClient({ searchId }: ScoutResultsClientProps) {
  const { isConnected, isComplete, error } = useScoutStream(searchId);
  const phase1Complete = useScoutStore((s) => s.phase1Complete);
  const repos = useScoutStore((s) => s.repos);
  const curatedLists = useScoutStore((s) => s.curatedLists);
  const industryTools = useScoutStore((s) => s.industryTools);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <SearchMetaBar />

      <main className="mx-auto max-w-6xl px-6 py-6 space-y-8">
        {/* Error banner */}
        {error && (
          <div className="animate-slide-up flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Streaming progress */}
        <StreamingProgress />

        {/* Main content grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
          {/* Left: Table */}
          <div className="min-w-0">
            <QuickScanTable />
          </div>

          {/* Right: Sidebar */}
          <aside className="space-y-6">
            <ObservationsPanel />
            {curatedLists.length > 0 && <CuratedListsSection />}
            {industryTools.length > 0 && <IndustryToolsSection />}
          </aside>
        </div>
      </main>

      {/* Sticky bottom CTA */}
      <DeepDiveCTA />
    </div>
  );
}
