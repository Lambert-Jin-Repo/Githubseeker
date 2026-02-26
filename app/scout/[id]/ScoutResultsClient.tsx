"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import { ExportButton } from "@/components/export/ExportButton";
import { SearchLoadingScreen } from "@/components/results/SearchLoadingScreen";
import { motion } from "framer-motion";
import { SearchSkeleton } from "@/components/shared/LoadingSkeleton";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useSearchNotificationStore } from "@/stores/search-notification-store";

interface ScoutResultsClientProps {
  searchId: string;
}

export function ScoutResultsClient({ searchId }: ScoutResultsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isCached = searchParams.get("cached") === "true";
  const { error, isLoadingSaved, retrySearch } = useScoutStream(searchId);

  // Dismiss the global search notification when results page loads
  const dismissNotification = useSearchNotificationStore((s) => s.dismiss);
  useEffect(() => {
    dismissNotification();
  }, [dismissNotification]);

  const repos = useScoutStore((s) => s.repos);
  const searchMeta = useScoutStore((s) => s.searchMeta);
  const phase1Complete = useScoutStore((s) => s.phase1Complete);
  const curatedLists = useScoutStore((s) => s.curatedLists);
  const industryTools = useScoutStore((s) => s.industryTools);
  const selectedRepoUrls = useScoutStore((s) => s.selectedRepoUrls);

  // Cinematic transition state
  const [isContracting, setIsContracting] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // When phase1 completes (and we were showing the loading screen), trigger cinematic reveal
  useEffect(() => {
    if (phase1Complete && !showResults && !isLoadingSaved) {
      // If loaded from saved results, skip animation — show immediately
      if (isCached || repos.length === 0) {
        setShowResults(true);
        return;
      }

      // Step 1: Contract the radar (0.35s)
      setIsContracting(true);

      const flashTimer = setTimeout(() => {
        // Step 2: Flash pulse (0.2s into contract)
        setShowFlash(true);
      }, 250);

      const revealTimer = setTimeout(() => {
        // Step 3: Reveal results
        setShowFlash(false);
        setShowResults(true);
      }, 700);

      return () => {
        clearTimeout(flashTimer);
        clearTimeout(revealTimer);
      };
    }
  }, [phase1Complete, isLoadingSaved, isCached, repos.length, showResults]);

  // For cached / saved results, skip straight to results
  useEffect(() => {
    if (isLoadingSaved === false && phase1Complete && isCached) {
      setShowResults(true);
    }
  }, [isLoadingSaved, phase1Complete, isCached]);

  const handleDeepDive = () => {
    router.push(`/scout/${searchId}/deep-dive`);
  };

  const activeError = error;

  // Determine what to show
  const showLoadingScreen = !showResults && !isLoadingSaved && !phase1Complete;
  const showLoadingSaved = isLoadingSaved && !showResults;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <SearchMetaBar />

      {/* Flash overlay for cinematic transition */}
      {showFlash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none" aria-hidden="true">
          <div className="size-24 rounded-full bg-teal/40 animate-flash" />
        </div>
      )}

      {/* Loading screen (radar animation) */}
      {showLoadingScreen && (
        <main id="main-content">
          <SearchLoadingScreen isContracting={isContracting} />

          {/* Error banner overlaid on loading screen */}
          {activeError && (
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div role="alert" className="animate-slide-up flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">{activeError}</span>
                <button
                  type="button"
                  onClick={retrySearch}
                  className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
                >
                  <RefreshCw className="size-3" aria-hidden="true" />
                  Retry Search
                </button>
              </div>
            </div>
          )}
        </main>
      )}

      {/* Loading saved results skeleton */}
      {showLoadingSaved && (
        <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 space-y-8 sm:px-6">
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading saved results...
            </div>
            <SearchSkeleton />
          </div>
        </main>
      )}

      {/* Results page (revealed after loading) */}
      {showResults && (
        <motion.main
          id="main-content"
          className="mx-auto max-w-6xl px-4 py-6 space-y-8 sm:px-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Error banner */}
          {activeError && (
            <div role="alert" className="animate-slide-up flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">{activeError}</span>
              <button
                type="button"
                onClick={retrySearch}
                className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
              >
                <RefreshCw className="size-3" aria-hidden="true" />
                Retry Search
              </button>
            </div>
          )}

          {/* Cached results label */}
          {isCached && !activeError && (
            <div className="flex items-center gap-3 rounded-lg border border-teal/20 bg-teal/5 px-4 py-3 text-sm text-teal">
              <span className="flex-1">Showing cached results</span>
              <button
                type="button"
                onClick={retrySearch}
                className="inline-flex items-center gap-1.5 rounded-md bg-teal/10 px-3 py-1.5 text-xs font-medium text-teal transition-colors hover:bg-teal/20"
              >
                <RefreshCw className="size-3" aria-hidden="true" />
                Refresh
              </button>
            </div>
          )}

          {/* Streaming progress (completion summary) */}
          <StreamingProgress />

          {/* Export button — visible after Phase 1 completes */}
          {phase1Complete && repos.length > 0 && (
            <div className="flex justify-end">
              <ExportButton
                repos={repos}
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
            </aside>
          </div>

          {/* Curated Lists & Industry Tools — full-width row */}
          {(curatedLists.length > 0 || industryTools.length > 0) && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {curatedLists.length > 0 && <CuratedListsSection />}
              {industryTools.length > 0 && <IndustryToolsSection />}
            </div>
          )}

        </motion.main>
      )}

      {/* Sticky bottom CTA */}
      {showResults && <DeepDiveCTA onDeepDive={handleDeepDive} />}
    </div>
  );
}
