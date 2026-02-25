import { Skeleton } from "@/components/ui/skeleton";

export function RepoRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-border/40 px-4 py-4">
      <Skeleton className="h-4 w-4 rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-72" />
      </div>
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
  );
}

export function DeepDiveSkeleton() {
  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-card p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="grid grid-cols-2 gap-4 pt-2">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </div>
  );
}

export function SearchSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <RepoRowSkeleton key={i} />
      ))}
    </div>
  );
}
