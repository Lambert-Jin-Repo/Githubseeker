import { Skeleton } from "@/components/ui/skeleton";
import { RepoRowSkeleton } from "@/components/shared/LoadingSkeleton";

export default function ScoutResultsLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <div className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      {/* Meta bar skeleton */}
      <div className="sticky top-16 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-5 w-48" />
          <div className="ml-auto flex items-center gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-6 space-y-8">
        {/* Strategy chips skeleton */}
        <div className="flex flex-wrap gap-2 py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-28 rounded-full" />
          ))}
        </div>

        {/* Content grid skeleton */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
          {/* Table skeleton */}
          <div className="space-y-0 rounded-lg border border-border/60 bg-card">
            {/* Table header */}
            <div className="flex items-center gap-4 border-b border-border/40 px-4 py-3">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <RepoRowSkeleton key={i} />
            ))}
          </div>

          {/* Sidebar skeleton */}
          <div className="space-y-6">
            {/* Observations skeleton */}
            <div className="rounded-xl border border-border/60 bg-card p-6 space-y-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>

            {/* Curated lists skeleton */}
            <div className="rounded-xl border border-border/60 bg-card p-6 space-y-4">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
