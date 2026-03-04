interface SectionSkeletonProps {
  title: string;
}

export function SectionSkeleton({ title }: SectionSkeletonProps) {
  return (
    <div className="animate-pulse rounded-lg border border-border/50 bg-card px-4 py-5 sm:p-6 space-y-4">
      <h3 className="font-serif text-lg text-muted-foreground/50">{title}</h3>
      <div className="space-y-3">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
      </div>
    </div>
  );
}
