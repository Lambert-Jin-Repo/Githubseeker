import { SourceLink } from "./SourceLink";
import type { SourceLink as SourceLinkType } from "@/lib/types";

interface SourcesRowProps {
  sources: SourceLinkType[];
}

export function SourcesRow({ sources }: SourcesRowProps) {
  if (sources.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-2">
      <span className="text-xs text-muted-foreground/70">Sources:</span>
      {sources.map((source, idx) => (
        <SourceLink key={`${source.url}-${idx}`} {...source} />
      ))}
    </div>
  );
}
